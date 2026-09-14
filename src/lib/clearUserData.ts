import { clearStoredDailyInsight } from './dailyInsight';
import {
  deleteBackupFromDrive,
  DriveAuthError,
  DriveNetworkError,
} from './googleDrive';
import type { DriveBackupPayload } from '../types';
import { useExpenseStore } from '../store/useExpenseStore';
import { useGoogleDriveStore } from '../store/useGoogleDriveStore';
import { useSettingsStore } from '../store/useSettingsStore';

export type DriveWipeStatus = 'deleted' | 'not_found' | 'skipped' | 'failed';

export interface ClearAllResult {
  /** Outcome of attempting to remove the cloud backup file. */
  driveBackup: DriveWipeStatus;
  /** Present when driveBackup is 'failed'. */
  driveError: string | null;
}

/**
 * Wipes every user-owned artifact from the app: expense months, selected
 * period, OpenRouter API key, Google OAuth client ID, local backup settings,
 * the cached daily insight, and the in-memory Google Drive session token.
 */
export function clearAllUserData(): void {
  useExpenseStore.getState().clearAll();
  useSettingsStore.getState().clearSettings();
  useGoogleDriveStore.getState().clearSession();
  clearStoredDailyInsight();
}

/**
 * Full device wipe: deletes the Google Drive backup when a live session token
 * is available, then clears all local state. Local wipe always completes even
 * if the Drive delete fails.
 */
export async function clearAllUserDataIncludingDrive(): Promise<ClearAllResult> {
  const session = useGoogleDriveStore.getState();
  const token = session.accessToken;
  const hasLiveToken =
    token !== null && token.length > 0 && session.expiresAt > Date.now();

  let driveBackup: DriveWipeStatus = 'skipped';
  let driveError: string | null = null;

  if (hasLiveToken && token !== null) {
    try {
      driveBackup = await deleteBackupFromDrive(token);
    } catch (error) {
      driveBackup = 'failed';
      if (error instanceof DriveAuthError || error instanceof DriveNetworkError) {
        driveError = error.message;
      } else if (error instanceof Error && error.message.trim().length > 0) {
        driveError = error.message;
      } else {
        driveError = 'מחיקת גיבוי Google Drive נכשלה.';
      }
    }
  }

  clearAllUserData();
  return { driveBackup, driveError };
}

/**
 * Full overwrite restore from a Drive (or local JSON) snapshot — replaces
 * expense-tracker-v1 entirely and restores only the OpenRouter key from
 * expense-settings-v1. Does not touch Google Client ID.
 */
export function applyFullBackupRestore(payload: DriveBackupPayload): void {
  useExpenseStore.getState().restoreFromBackup(payload);
  useSettingsStore.getState().setOpenRouterApiKey(payload.openRouterApiKey);
}
