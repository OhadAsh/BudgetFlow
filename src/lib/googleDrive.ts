import {
  DRIVE_BACKUP_FILE_NAME,
  DRIVE_BACKUP_VERSION,
  GOOGLE_DRIVE_APPDATA_SCOPE,
  GOOGLE_DRIVE_FILE_SCOPE,
} from './constants';
import type {
  BackupSettings,
  CategoryKind,
  CategoryTargets,
  CustomCategory,
  DriveBackupPayload,
  Expense,
  IncomeSource,
  MerchantMemory,
  MonthData,
} from '../types';
import { normalizeHourValue, HOUR_DARK_BEFORE, HOUR_DARK_FROM } from './colorScheme';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

/** True when the string looks like a Google OAuth Web client ID. */
export function isValidGoogleOAuthClientId(clientId: string): boolean {
  const trimmed = clientId.trim();
  return (
    trimmed.length > 0 &&
    trimmed.includes('-') &&
    trimmed.endsWith('.apps.googleusercontent.com') &&
    !trimmed.startsWith('YOUR_CLIENT_ID')
  );
}

export class DriveAuthError extends Error {
  constructor(message = 'פג תוקף ההרשאה ל-Google Drive. יש להתחבר מחדש.') {
    super(message);
    this.name = 'DriveAuthError';
  }
}

export class DriveNetworkError extends Error {
  constructor(message = 'שגיאת רשת בעת גישה ל-Google Drive. בדוק את החיבור ונסה שוב.') {
    super(message);
    this.name = 'DriveNetworkError';
  }
}

export class DriveNotFoundError extends Error {
  constructor(message = 'לא נמצא קובץ גיבוי ב-Google Drive.') {
    super(message);
    this.name = 'DriveNotFoundError';
  }
}

export class DriveParseError extends Error {
  constructor(message = 'קובץ הגיבוי ב-Drive אינו תקין או בפורמט לא נתמך.') {
    super(message);
    this.name = 'DriveParseError';
  }
}

/** The Drive file changed between the pre-check and the upload. Callers open the conflict modal. */
export class DriveConflictError extends Error {
  readonly remoteModifiedTime: string | null;

  constructor(remoteModifiedTime: string | null) {
    super('הגיבוי ב-Drive השתנה מאז הבדיקה האחרונה.');
    this.name = 'DriveConflictError';
    this.remoteModifiedTime = remoteModifiedTime;
  }
}

export class DriveApiDisabledError extends Error {
  constructor(
    message = 'יש להפעיל את Google Drive API בפרויקט ב-Google Cloud Console, ואז להמתין כמה דקות ולנסות שוב.'
  ) {
    super(message);
    this.name = 'DriveApiDisabledError';
  }
}

/** Token is missing drive.appdata (and/or drive.file) — caller must re-consent. */
export class DriveInsufficientScopeError extends Error {
  constructor(
    message = 'נדרשת הרשאה נוספת לתיקיית הנתונים הפרטית של האפליקציה ב-Google Drive. אשר את ההרשאה בחלון שיופיע.'
  ) {
    super(message);
    this.name = 'DriveInsufficientScopeError';
  }
}

/**
 * True when the GIS token response includes every scope BudgetFlow needs.
 * Prefers GIS hasGrantedAllScopes (handles incremental grants); falls back to the scope string.
 */
export function tokenHasRequiredDriveScopes(response: {
  scope?: string;
}): boolean {
  if (window.google?.accounts?.oauth2?.hasGrantedAllScopes) {
    return window.google.accounts.oauth2.hasGrantedAllScopes(
      response as GoogleTokenResponse,
      GOOGLE_DRIVE_APPDATA_SCOPE,
      GOOGLE_DRIVE_FILE_SCOPE
    );
  }
  const scopeField = response.scope;
  if (typeof scopeField !== 'string' || scopeField.trim().length === 0) {
    return false;
  }
  const granted = new Set(scopeField.split(/\s+/).filter((part) => part.length > 0));
  return granted.has(GOOGLE_DRIVE_APPDATA_SCOPE) && granted.has(GOOGLE_DRIVE_FILE_SCOPE);
}

interface DriveFileListResponse {
  files?: DriveFileResource[];
}

interface DriveFileResource {
  id: string;
  name: string;
  /** RFC 3339 timestamp of the last content change on Drive. */
  modifiedTime?: string;
}

/** Drive-side identity of the backup file — used to detect a newer remote copy. */
export interface DriveBackupFileMeta {
  id: string;
  modifiedTime: string | null;
}

/** A downloaded backup plus the Drive stamp it was read at. */
export interface DriveBackupDownload {
  payload: DriveBackupPayload;
  modifiedTime: string | null;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

interface GoogleApiErrorBody {
  error?: {
    status?: string;
    message?: string;
    errors?: Array<{ reason?: string }>;
    details?: Array<{ reason?: string }>;
  };
}

async function throwIfDriveApiDisabled(response: Response): Promise<void> {
  if (response.status !== 403) {
    return;
  }
  let body: GoogleApiErrorBody;
  try {
    body = (await response.clone().json()) as GoogleApiErrorBody;
  } catch {
    return;
  }
  const reason =
    body.error?.errors?.[0]?.reason ??
    body.error?.details?.find((d) => d.reason)?.reason;
  const message = body.error?.message ?? '';
  if (
    reason === 'accessNotConfigured' ||
    reason === 'SERVICE_DISABLED' ||
    message.includes('has not been used') ||
    message.includes('is disabled')
  ) {
    throw new DriveApiDisabledError();
  }
  if (
    reason === 'insufficientPermissions' ||
    reason === 'insufficientPermission' ||
    reason === 'ACCESS_TOKEN_SCOPE_INSUFFICIENT' ||
    message.includes('insufficient authentication scopes') ||
    message.includes('Insufficient Permission')
  ) {
    throw new DriveInsufficientScopeError();
  }
}

async function driveFetch(url: string, init: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new DriveNetworkError();
  }

  if (response.status === 401) {
    throw new DriveAuthError();
  }

  await throwIfDriveApiDisabled(response);

  return response;
}

async function findBackupFileInSpace(
  token: string,
  spaces: 'appDataFolder' | 'drive'
): Promise<DriveBackupFileMeta | null> {
  const query = `name='${DRIVE_BACKUP_FILE_NAME}' and trashed=false`;
  const params = new URLSearchParams({
    q: query,
    spaces,
    fields: 'files(id,name,modifiedTime)',
    pageSize: '1',
  });

  const response = await driveFetch(`${DRIVE_API}/files?${params.toString()}`, {
    method: 'GET',
    headers: authHeaders(token),
  });

  if (!response.ok) {
    throw new DriveNetworkError(`חיפוש קובץ הגיבוי נכשל (${response.status}).`);
  }

  const data = (await response.json()) as DriveFileListResponse;
  const file = data.files?.[0];
  if (file === undefined) {
    return null;
  }
  return { id: file.id, modifiedTime: file.modifiedTime ?? null };
}

/**
 * Metadata-only lookup of the live backup in the private appDataFolder.
 * Returns null when the user has no backup there yet.
 */
export async function findBackupFile(token: string): Promise<DriveBackupFileMeta | null> {
  return findBackupFileInSpace(token, 'appDataFolder');
}

/**
 * Legacy My Drive copy created by older builds (drive.file). Used only for migration.
 */
export async function findLegacyMyDriveBackupFile(
  token: string
): Promise<DriveBackupFileMeta | null> {
  return findBackupFileInSpace(token, 'drive');
}

/** Finds the appDataFolder backup file id, or null if it does not exist. */
export async function findBackupFileId(token: string): Promise<string | null> {
  const file = await findBackupFile(token);
  return file?.id ?? null;
}

type DriveUploadMetadata = {
  name?: string;
  mimeType: string;
  parents?: string[];
};

function buildMultipartBody(
  metadata: DriveUploadMetadata,
  jsonBody: string
): { body: string; contentType: string } {
  const boundary = `budgetflow_${crypto.randomUUID().replace(/-/g, '')}`;
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    jsonBody,
    `--${boundary}--`,
    '',
  ].join('\r\n');

  return {
    body,
    contentType: `multipart/related; boundary=${boundary}`,
  };
}

export function buildDriveBackupPayload(input: {
  months: MonthData[];
  selectedYear: number;
  selectedMonth: number;
  customCategories: CustomCategory[];
  merchantMemory: MerchantMemory;
  categoryTargets: CategoryTargets;
  excludedTransactions?: string[];
  openRouterApiKey?: string | null;
  settings?: BackupSettings;
}): DriveBackupPayload {
  const openRouterApiKey =
    typeof input.openRouterApiKey === 'string' && input.openRouterApiKey.trim().length > 0
      ? input.openRouterApiKey
      : null;

  return {
    version: DRIVE_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    months: input.months,
    selectedYear: input.selectedYear,
    selectedMonth: input.selectedMonth,
    customCategories: input.customCategories,
    merchantMemory: input.merchantMemory,
    categoryTargets: input.categoryTargets,
    excludedTransactions: Array.isArray(input.excludedTransactions)
      ? [...input.excludedTransactions]
      : [],
    openRouterApiKey,
    ...(input.settings !== undefined
      ? { settings: { ...input.settings, openRouterApiKey } }
      : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseIncome(value: unknown): IncomeSource | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== 'string' || typeof value.label !== 'string') return null;
  if (typeof value.amount !== 'number' || !Number.isFinite(value.amount)) return null;
  const source: IncomeSource = {
    id: value.id,
    label: value.label,
    amount: value.amount,
  };
  if (typeof value.date === 'string') source.date = value.date;
  if (typeof value.hash === 'string') source.hash = value.hash;
  return source;
}

function parseExpense(value: unknown): Expense | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== 'string' || typeof value.category !== 'string') return null;
  if (typeof value.description !== 'string') return null;
  if (typeof value.amount !== 'number' || !Number.isFinite(value.amount)) return null;
  const expense: Expense = {
    id: value.id,
    category: value.category,
    description: value.description,
    amount: value.amount,
  };
  if (typeof value.date === 'string') expense.date = value.date;
  if (typeof value.note === 'string') expense.note = value.note;
  if (typeof value.hash === 'string') expense.hash = value.hash;
  if (value.source === null || typeof value.source === 'string') {
    expense.source = value.source as Expense['source'];
  }
  if (value.cardLast4 === null || typeof value.cardLast4 === 'string') {
    expense.cardLast4 = value.cardLast4;
  }
  return expense;
}

interface ParsedMonth {
  month: MonthData | null;
  /** Invalid month, or income/expense rows inside a valid month, that were dropped. */
  skipped: number;
}

function parseMonth(value: unknown): ParsedMonth {
  if (
    !isRecord(value) ||
    typeof value.year !== 'number' ||
    typeof value.month !== 'number' ||
    !Array.isArray(value.income) ||
    !Array.isArray(value.expenses)
  ) {
    return { month: null, skipped: 1 };
  }

  let skipped = 0;
  const income: IncomeSource[] = [];
  value.income.forEach((row) => {
    const parsed = parseIncome(row);
    if (parsed === null) skipped += 1;
    else income.push(parsed);
  });
  const expenses: Expense[] = [];
  value.expenses.forEach((row) => {
    const parsed = parseExpense(row);
    if (parsed === null) skipped += 1;
    else expenses.push(parsed);
  });

  return {
    month: {
      year: value.year,
      month: value.month,
      income,
      expenses,
      ...(value.isOutlier === true ? { isOutlier: true as const } : {}),
      ...(typeof value.outlierNote === 'string' && value.outlierNote.trim().length > 0
        ? { outlierNote: value.outlierNote.trim() }
        : {}),
    },
    skipped,
  };
}

function parseCustomCategory(value: unknown): CustomCategory | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== 'string' || typeof value.name !== 'string') return null;
  if (typeof value.emoji !== 'string' || typeof value.color !== 'string') return null;
  return {
    id: value.id,
    name: value.name,
    emoji: value.emoji,
    color: value.color,
    kind: parseCategoryKind(value.kind),
  };
}

/** Backups written before category kinds existed restore as ordinary spending. */
function parseCategoryKind(value: unknown): CategoryKind {
  return value === 'savings' || value === 'outOfFlow' ? value : 'spending';
}

function parseMerchantMemory(value: unknown): MerchantMemory {
  if (!isRecord(value)) return {};
  const result: MerchantMemory = {};
  Object.entries(value).forEach(([merchant, category]) => {
    if (typeof category === 'string' && category.trim().length > 0) {
      result[merchant] = category;
    }
  });
  return result;
}

function parseCategoryTargets(value: unknown): CategoryTargets {
  if (!isRecord(value)) return {};
  const result: CategoryTargets = {};
  Object.entries(value).forEach(([category, target]) => {
    if (typeof target === 'number' && Number.isFinite(target) && target >= 0) {
      result[category] = target;
    }
  });
  return result;
}

function parseIntervalDays(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(365, Math.max(1, Math.round(value)));
}

function parseOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

const COLOR_SCHEME_MODES = ['light', 'dark', 'system', 'hour'] as const;

/**
 * Copies only fields the file actually contains. Missing fields stay off the
 * object so restore keeps the current value instead of a parser default.
 * A version 1–3 file has no settings block; its top-level API key, when
 * present, is the one field that still comes across.
 */
function parseBackupSettings(value: unknown, topLevelApiKey: string | null): Partial<BackupSettings> {
  const raw = isRecord(value) ? value : {};
  const settings: Partial<BackupSettings> = {};

  const settingsKey = parseOptionalString(raw.openRouterApiKey);
  if (settingsKey !== null) {
    settings.openRouterApiKey = settingsKey;
  } else if (!('openRouterApiKey' in raw) && topLevelApiKey !== null) {
    settings.openRouterApiKey = topLevelApiKey;
  }

  const clientId = parseOptionalString(raw.googleOAuthClientId);
  if ('googleOAuthClientId' in raw && clientId !== null) {
    settings.googleOAuthClientId = clientId;
  }

  if (typeof raw.autoBackupEnabled === 'boolean') {
    settings.autoBackupEnabled = raw.autoBackupEnabled;
  }
  if (typeof raw.autoBackupIntervalDays === 'number' && Number.isFinite(raw.autoBackupIntervalDays)) {
    settings.autoBackupIntervalDays = parseIntervalDays(raw.autoBackupIntervalDays, 7);
  }
  if (raw.autoBackupFormat === 'json' || raw.autoBackupFormat === 'xlsx' || raw.autoBackupFormat === 'both') {
    settings.autoBackupFormat = raw.autoBackupFormat;
  }
  const lastLocalBackupAt = parseOptionalString(raw.lastLocalBackupAt);
  if ('lastLocalBackupAt' in raw && lastLocalBackupAt !== null) {
    settings.lastLocalBackupAt = lastLocalBackupAt;
  }
  if (typeof raw.excludeOutliersFromStats === 'boolean') {
    settings.excludeOutliersFromStats = raw.excludeOutliersFromStats;
  }
  if (
    typeof raw.colorSchemeMode === 'string' &&
    (COLOR_SCHEME_MODES as readonly string[]).includes(raw.colorSchemeMode)
  ) {
    settings.colorSchemeMode = raw.colorSchemeMode as BackupSettings['colorSchemeMode'];
  }
  if (typeof raw.hourDarkBefore === 'number' && Number.isFinite(raw.hourDarkBefore)) {
    settings.hourDarkBefore = normalizeHourValue(raw.hourDarkBefore, HOUR_DARK_BEFORE);
  }
  if (typeof raw.hourDarkFrom === 'number' && Number.isFinite(raw.hourDarkFrom)) {
    settings.hourDarkFrom = normalizeHourValue(raw.hourDarkFrom, HOUR_DARK_FROM);
  }

  return settings;
}

function parseExcludedTransactions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const keys = new Set<string>();
  value.forEach((entry) => {
    if (typeof entry === 'string' && entry.trim().length > 0) {
      keys.add(entry);
    }
  });
  return Array.from(keys);
}

/** Validates and normalizes JSON downloaded from Drive. */
export function parseDriveBackupPayload(raw: unknown): DriveBackupPayload {
  if (!isRecord(raw)) {
    throw new DriveParseError();
  }

  if (!Array.isArray(raw.months)) {
    throw new DriveParseError('קובץ הגיבוי אינו מכיל רשימת חודשים.');
  }

  let skippedRows = 0;
  const months: MonthData[] = [];
  raw.months.forEach((entry) => {
    const parsed = parseMonth(entry);
    skippedRows += parsed.skipped;
    if (parsed.month !== null) months.push(parsed.month);
  });
  const selectedYear =
    typeof raw.selectedYear === 'number' && Number.isFinite(raw.selectedYear)
      ? raw.selectedYear
      : new Date().getFullYear();
  const selectedMonth =
    typeof raw.selectedMonth === 'number' && Number.isFinite(raw.selectedMonth)
      ? raw.selectedMonth
      : new Date().getMonth() + 1;

  const customCategories: CustomCategory[] = [];
  if (Array.isArray(raw.customCategories)) {
    raw.customCategories.forEach((entry) => {
      const parsed = parseCustomCategory(entry);
      if (parsed === null) skippedRows += 1;
      else customCategories.push(parsed);
    });
  }

  const openRouterApiKey =
    typeof raw.openRouterApiKey === 'string' && raw.openRouterApiKey.trim().length > 0
      ? raw.openRouterApiKey
      : null;

  return {
    version: typeof raw.version === 'number' ? raw.version : DRIVE_BACKUP_VERSION,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : new Date().toISOString(),
    months,
    selectedYear,
    selectedMonth,
    customCategories,
    merchantMemory: parseMerchantMemory(raw.merchantMemory),
    categoryTargets: parseCategoryTargets(raw.categoryTargets),
    excludedTransactions: parseExcludedTransactions(raw.excludedTransactions),
    openRouterApiKey,
    settings: parseBackupSettings(raw.settings, openRouterApiKey),
    skippedRows,
  };
}

/** Hebrew label for a backup's exportedAt timestamp (for restore confirmation copy). */
export function formatDriveBackupExportedAt(exportedAt: string): string {
  const ms = Date.parse(exportedAt);
  if (!Number.isFinite(ms)) {
    return exportedAt;
  }
  return new Intl.DateTimeFormat('he-IL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ms));
}

/**
 * Uploads (or updates) the fixed-name backup JSON on Google Drive.
 * Uses multipart/related so metadata + content travel in one request.
 */
/** What the caller saw on the metadata check that decided this upload was safe. */
export interface DriveUploadBaseline {
  exists: boolean;
  modifiedTime: string | null;
}

function remoteChangedSinceBaseline(
  baseline: DriveUploadBaseline,
  current: DriveBackupFileMeta | null
): boolean {
  const existsNow = current !== null;
  if (baseline.exists !== existsNow) return true;
  if (!existsNow || current === null) return false;
  return (current.modifiedTime ?? null) !== baseline.modifiedTime;
}

/** Metadata-only read of one file. Failures return null so a finished upload is not retried. */
async function readModifiedTime(token: string, fileId: string): Promise<string | null> {
  try {
    const response = await fetch(
      `${DRIVE_API}/files/${encodeURIComponent(fileId)}?fields=modifiedTime`,
      { method: 'GET', headers: authHeaders(token) }
    );
    if (!response.ok) return null;
    const data = (await response.json()) as { modifiedTime?: unknown };
    return typeof data.modifiedTime === 'string' && data.modifiedTime.length > 0
      ? data.modifiedTime
      : null;
  } catch {
    return null;
  }
}

async function uploadJsonToAppDataFolder(
  token: string,
  jsonBody: string,
  existingId: string | null
): Promise<DriveFileResource> {
  const metadata: DriveUploadMetadata = existingId
    ? { mimeType: 'application/json' }
    : {
        name: DRIVE_BACKUP_FILE_NAME,
        mimeType: 'application/json',
        parents: ['appDataFolder'],
      };

  const multipart = buildMultipartBody(metadata, jsonBody);
  const fields = 'fields=id,name,modifiedTime';
  const url = existingId
    ? `${DRIVE_UPLOAD_API}/files/${encodeURIComponent(existingId)}?uploadType=multipart&${fields}`
    : `${DRIVE_UPLOAD_API}/files?uploadType=multipart&${fields}`;

  const response = await driveFetch(url, {
    method: existingId ? 'PATCH' : 'POST',
    headers: {
      ...authHeaders(token),
      'Content-Type': multipart.contentType,
    },
    body: multipart.body,
  });

  if (!response.ok) {
    throw new DriveNetworkError(`העלאת הגיבוי נכשלה (${response.status}).`);
  }

  const file = (await response.json()) as DriveFileResource;
  let modifiedTime =
    typeof file.modifiedTime === 'string' && file.modifiedTime.length > 0 ? file.modifiedTime : null;
  if (modifiedTime === null && typeof file.id === 'string' && file.id.length > 0) {
    modifiedTime = await readModifiedTime(token, file.id);
  }
  return modifiedTime === null ? file : { ...file, modifiedTime };
}

export async function uploadBackupToDrive(
  token: string,
  data: DriveBackupPayload,
  baseline?: DriveUploadBaseline
): Promise<DriveFileResource> {
  const jsonBody = JSON.stringify(data);
  const current = await findBackupFile(token);
  if (baseline !== undefined && remoteChangedSinceBaseline(baseline, current)) {
    throw new DriveConflictError(current?.modifiedTime ?? null);
  }
  return uploadJsonToAppDataFolder(token, jsonBody, current?.id ?? null);
}

async function downloadDriveFileText(token: string, fileId: string): Promise<string> {
  const response = await driveFetch(
    `${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`,
    {
      method: 'GET',
      headers: authHeaders(token),
    }
  );

  if (!response.ok) {
    throw new DriveNetworkError(`הורדת הגיבוי נכשלה (${response.status}).`);
  }

  try {
    return await response.text();
  } catch {
    throw new DriveParseError('לא ניתן לפענח את תוכן קובץ הגיבוי.');
  }
}

async function deleteDriveFileById(token: string, fileId: string): Promise<'deleted' | 'not_found'> {
  const response = await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });

  if (response.status === 404) {
    return 'not_found';
  }
  if (!response.ok) {
    throw new DriveNetworkError(`מחיקת הגיבוי מ-Drive נכשלה (${response.status}).`);
  }
  return 'deleted';
}

/**
 * Copies a legacy My Drive backup into appDataFolder.
 * Never overwrites an existing appDataFolder file (conflict instead).
 */
export async function migrateLegacyBackupToAppDataFolder(
  token: string,
  options: { deleteLegacy: boolean }
): Promise<DriveBackupFileMeta> {
  const existing = await findBackupFile(token);
  if (existing !== null) {
    throw new DriveConflictError(existing.modifiedTime);
  }

  const legacy = await findLegacyMyDriveBackupFile(token);
  if (legacy === null) {
    throw new DriveNotFoundError('לא נמצא גיבוי ישן להעברה מ-Drive.');
  }

  const jsonBody = await downloadDriveFileText(token, legacy.id);

  // Race: another device may have written appDataFolder between the checks.
  const raced = await findBackupFile(token);
  if (raced !== null) {
    throw new DriveConflictError(raced.modifiedTime);
  }

  const created = await uploadJsonToAppDataFolder(token, jsonBody, null);
  if (typeof created.id !== 'string' || created.id.length === 0) {
    throw new DriveNetworkError('העברת הגיבוי לתיקייה הפרטית נכשלה.');
  }

  if (options.deleteLegacy) {
    await deleteDriveFileById(token, legacy.id);
  }

  return {
    id: created.id,
    modifiedTime: created.modifiedTime ?? null,
  };
}

/** Locates the appDataFolder backup and returns its decoded JSON plus Drive stamp. */
export async function downloadBackupFromDrive(token: string): Promise<DriveBackupDownload> {
  const file = await findBackupFile(token);
  if (file === null) {
    throw new DriveNotFoundError();
  }

  const text = await downloadDriveFileText(token, file.id);
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    throw new DriveParseError('לא ניתן לפענח את תוכן קובץ הגיבוי.');
  }

  return { payload: parseDriveBackupPayload(raw), modifiedTime: file.modifiedTime };
}

/**
 * True when Drive's modifiedTime is later than the stamp from the last sync.
 * A missing remote timestamp is not "newer". A missing local stamp is handled
 * by `remoteNeedsConflictPrompt`, because that case means "a file exists and
 * this device has never synced", which must always be a conflict.
 */
export function isRemoteNewer(
  remoteModifiedTime: string | null,
  lastSyncedRemoteModifiedTime: string | null
): boolean {
  if (remoteModifiedTime === null) return false;
  if (lastSyncedRemoteModifiedTime === null || lastSyncedRemoteModifiedTime.length === 0) {
    return true;
  }
  const remoteMs = Date.parse(remoteModifiedTime);
  const syncedMs = Date.parse(lastSyncedRemoteModifiedTime);
  if (!Number.isFinite(remoteMs) || !Number.isFinite(syncedMs)) return true;
  return remoteMs > syncedMs;
}

/**
 * True when an upload must stop and ask the user. A remote file with no local
 * sync stamp is always a conflict, even when Drive did not return a modifiedTime.
 */
export function remoteNeedsConflictPrompt(
  hasRemoteFile: boolean,
  remoteModifiedTime: string | null,
  lastSyncedRemoteModifiedTime: string | null
): boolean {
  if (!hasRemoteFile) return false;
  if (lastSyncedRemoteModifiedTime === null || lastSyncedRemoteModifiedTime.length === 0) {
    return true;
  }
  return isRemoteNewer(remoteModifiedTime, lastSyncedRemoteModifiedTime);
}

/**
 * The quiet "load the newer file" offer is only safe after a real sync, and
 * only when nothing local has changed since then.
 */
export function allowRemoteLoadNotification(
  lastSyncedRemoteModifiedTime: string | null,
  localDirtyAt: string | null
): boolean {
  return (
    lastSyncedRemoteModifiedTime !== null &&
    lastSyncedRemoteModifiedTime.length > 0 &&
    localDirtyAt === null
  );
}

/**
 * Permanently deletes the appDataFolder backup when present.
 * Returns not_found when there is nothing to delete.
 */
export async function deleteBackupFromDrive(token: string): Promise<'deleted' | 'not_found'> {
  const fileId = await findBackupFileId(token);
  if (fileId === null) {
    return 'not_found';
  }
  return deleteDriveFileById(token, fileId);
}
