import {
  DRIVE_BACKUP_FILE_NAME,
  DRIVE_BACKUP_VERSION,
} from './constants';
import type {
  CategoryTargets,
  CustomCategory,
  DriveBackupPayload,
  Expense,
  IncomeSource,
  MerchantMemory,
  MonthData,
} from '../types';

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

interface DriveFileListResponse {
  files?: Array<{ id: string; name: string }>;
}

interface DriveFileResource {
  id: string;
  name: string;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
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

  return response;
}

/** Finds the app backup file id, or null if it does not exist. */
export async function findBackupFileId(token: string): Promise<string | null> {
  const query = `name='${DRIVE_BACKUP_FILE_NAME}' and trashed=false`;
  const params = new URLSearchParams({
    q: query,
    spaces: 'drive',
    fields: 'files(id,name)',
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
  return file?.id ?? null;
}

function buildMultipartBody(
  metadata: Record<string, string>,
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
}): DriveBackupPayload {
  return {
    version: DRIVE_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    months: input.months,
    selectedYear: input.selectedYear,
    selectedMonth: input.selectedMonth,
    customCategories: input.customCategories,
    merchantMemory: input.merchantMemory,
    categoryTargets: input.categoryTargets,
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
  if (value.cardBrand === null || typeof value.cardBrand === 'string') {
    expense.cardBrand = value.cardBrand;
  }
  return expense;
}

function parseMonth(value: unknown): MonthData | null {
  if (!isRecord(value)) return null;
  if (typeof value.year !== 'number' || typeof value.month !== 'number') return null;
  if (!Array.isArray(value.income) || !Array.isArray(value.expenses)) return null;

  const income = value.income.map(parseIncome).filter((row): row is IncomeSource => row !== null);
  const expenses = value.expenses
    .map(parseExpense)
    .filter((row): row is Expense => row !== null);

  return {
    year: value.year,
    month: value.month,
    income,
    expenses,
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
  };
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

/** Validates and normalizes JSON downloaded from Drive. */
export function parseDriveBackupPayload(raw: unknown): DriveBackupPayload {
  if (!isRecord(raw)) {
    throw new DriveParseError();
  }

  if (!Array.isArray(raw.months)) {
    throw new DriveParseError('קובץ הגיבוי אינו מכיל רשימת חודשים.');
  }

  const months = raw.months.map(parseMonth).filter((row): row is MonthData => row !== null);
  const selectedYear =
    typeof raw.selectedYear === 'number' && Number.isFinite(raw.selectedYear)
      ? raw.selectedYear
      : new Date().getFullYear();
  const selectedMonth =
    typeof raw.selectedMonth === 'number' && Number.isFinite(raw.selectedMonth)
      ? raw.selectedMonth
      : new Date().getMonth() + 1;

  const customCategories = Array.isArray(raw.customCategories)
    ? raw.customCategories
        .map(parseCustomCategory)
        .filter((row): row is CustomCategory => row !== null)
    : [];

  return {
    version: typeof raw.version === 'number' ? raw.version : DRIVE_BACKUP_VERSION,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : new Date().toISOString(),
    months,
    selectedYear,
    selectedMonth,
    customCategories,
    merchantMemory: parseMerchantMemory(raw.merchantMemory),
    categoryTargets: parseCategoryTargets(raw.categoryTargets),
  };
}

/**
 * Uploads (or updates) the fixed-name backup JSON on Google Drive.
 * Uses multipart/related so metadata + content travel in one request.
 */
export async function uploadBackupToDrive(
  token: string,
  data: DriveBackupPayload
): Promise<DriveFileResource> {
  const jsonBody = JSON.stringify(data);
  const existingId = await findBackupFileId(token);
  const metadata = existingId
    ? { mimeType: 'application/json' }
    : { name: DRIVE_BACKUP_FILE_NAME, mimeType: 'application/json' };

  const multipart = buildMultipartBody(metadata, jsonBody);
  const url = existingId
    ? `${DRIVE_UPLOAD_API}/files/${encodeURIComponent(existingId)}?uploadType=multipart`
    : `${DRIVE_UPLOAD_API}/files?uploadType=multipart`;

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
  return file;
}

/** Locates the backup file and returns its decoded JSON payload. */
export async function downloadBackupFromDrive(token: string): Promise<DriveBackupPayload> {
  const fileId = await findBackupFileId(token);
  if (fileId === null) {
    throw new DriveNotFoundError();
  }

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

  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    throw new DriveParseError('לא ניתן לפענח את תוכן קובץ הגיבוי.');
  }

  return parseDriveBackupPayload(raw);
}
