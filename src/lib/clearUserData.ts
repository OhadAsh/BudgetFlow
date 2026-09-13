import { clearStoredDailyInsight } from './dailyInsight';
import { useExpenseStore } from '../store/useExpenseStore';
import { useGoogleDriveStore } from '../store/useGoogleDriveStore';
import { useSettingsStore } from '../store/useSettingsStore';

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
