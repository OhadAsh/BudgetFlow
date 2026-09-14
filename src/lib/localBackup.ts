import type { DriveBackupPayload } from '../types';
import { DRIVE_BACKUP_FILE_NAME } from './constants';
import {
  buildExportFileName,
  downloadWorkbook,
  exportBackupWorkbook,
} from './excelParser';
import { buildDriveBackupPayload } from './googleDrive';

export type AutoBackupFormat = 'json' | 'xlsx' | 'both';

export const AUTO_BACKUP_INTERVAL_OPTIONS = [
  { value: '1', label: 'כל יום' },
  { value: '7', label: 'כל שבוע' },
  { value: '14', label: 'כל שבועיים' },
  { value: '30', label: 'כל חודש' },
] as const;

export const DEFAULT_AUTO_BACKUP_INTERVAL_DAYS = 7;

export interface LocalBackupSnapshotInput {
  months: DriveBackupPayload['months'];
  selectedYear: number;
  selectedMonth: number;
  customCategories: DriveBackupPayload['customCategories'];
  merchantMemory: DriveBackupPayload['merchantMemory'];
  categoryTargets: DriveBackupPayload['categoryTargets'];
  openRouterApiKey?: string | null;
}

/** True when a prior backup exists and the configured interval has elapsed. */
export function isAutoBackupDue(
  lastLocalBackupAt: string | null,
  intervalDays: number,
  now: Date = new Date()
): boolean {
  const safeInterval =
    Number.isFinite(intervalDays) && intervalDays > 0
      ? intervalDays
      : DEFAULT_AUTO_BACKUP_INTERVAL_DAYS;
  // Never auto-download on a fresh install — wait for the first successful backup
  // to start the weekly (or configured) clock.
  if (lastLocalBackupAt === null || lastLocalBackupAt.trim().length === 0) {
    return false;
  }
  const lastMs = Date.parse(lastLocalBackupAt);
  if (!Number.isFinite(lastMs)) {
    return false;
  }
  const elapsedMs = now.getTime() - lastMs;
  return elapsedMs >= safeInterval * 24 * 60 * 60 * 1000;
}

/** True when the user should be nudged (never backed up, or interval elapsed). */
export function shouldNudgeLocalBackup(
  lastLocalBackupAt: string | null,
  intervalDays: number,
  now: Date = new Date()
): boolean {
  if (lastLocalBackupAt === null || lastLocalBackupAt.trim().length === 0) {
    return true;
  }
  return isAutoBackupDue(lastLocalBackupAt, intervalDays, now);
}

export function buildLocalJsonBackupFileName(now: Date = new Date()): string {
  const stamp = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now
    .getDate()
    .toString()
    .padStart(2, '0')}`;
  const base = DRIVE_BACKUP_FILE_NAME.replace(/\.json$/i, '');
  return `${base}-${stamp}.json`;
}

/** Builds the same JSON snapshot used for Google Drive — local file only. */
export function buildLocalBackupPayload(input: LocalBackupSnapshotInput): DriveBackupPayload {
  return buildDriveBackupPayload(input);
}

function triggerBrowserDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}

export function downloadJsonBackup(payload: DriveBackupPayload, fileName?: string): void {
  const body = JSON.stringify(payload, null, 2);
  const blob = new Blob([body], { type: 'application/json;charset=utf-8' });
  triggerBrowserDownload(blob, fileName ?? buildLocalJsonBackupFileName());
}

export function downloadExcelBackup(input: LocalBackupSnapshotInput): void {
  downloadWorkbook(
    exportBackupWorkbook(
      input.months,
      input.customCategories,
      input.merchantMemory,
      input.categoryTargets
    ),
    buildExportFileName()
  );
}

/**
 * Triggers browser downloads for the selected format(s).
 * May be blocked by the browser when not tied to a user gesture — callers
 * should offer a manual button as a reliable fallback.
 */
export function runLocalBackupDownload(
  input: LocalBackupSnapshotInput,
  format: AutoBackupFormat
): void {
  const payload = buildLocalBackupPayload(input);
  if (format === 'json' || format === 'both') {
    downloadJsonBackup(payload);
  }
  if (format === 'xlsx' || format === 'both') {
    downloadExcelBackup(input);
  }
}

/** Relative Hebrew label for the last successful local backup. */
export function formatLastBackupLabel(
  lastLocalBackupAt: string | null,
  now: Date = new Date()
): string {
  if (lastLocalBackupAt === null || lastLocalBackupAt.trim().length === 0) {
    return 'עדיין לא בוצע גיבוי מקומי';
  }
  const lastMs = Date.parse(lastLocalBackupAt);
  if (!Number.isFinite(lastMs)) {
    return 'עדיין לא בוצע גיבוי מקומי';
  }

  const diffMs = Math.max(0, now.getTime() - lastMs);
  const minutes = Math.floor(diffMs / (60 * 1000));
  if (minutes < 1) return 'גיבוי אחרון: לפני רגע';
  if (minutes < 60) return `גיבוי אחרון: לפני ${minutes} דק׳`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `גיבוי אחרון: לפני ${hours} שע׳`;

  const days = Math.floor(hours / 24);
  if (days === 1) return 'גיבוי אחרון: אתמול';
  if (days < 30) return `גיבוי אחרון: לפני ${days} ימים`;

  const formatted = new Intl.DateTimeFormat('he-IL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(lastMs));
  return `גיבוי אחרון: ${formatted}`;
}
