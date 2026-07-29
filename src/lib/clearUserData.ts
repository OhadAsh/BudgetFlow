import { clearStoredDailyInsight } from './dailyInsight';
import { useExpenseStore } from '../store/useExpenseStore';
import { useSettingsStore } from '../store/useSettingsStore';

/**
 * Wipes every user-owned artifact from the app: expense months, selected
 * period, OpenRouter API key, and the cached daily insight.
 */
export function clearAllUserData(): void {
  useExpenseStore.getState().clearAll();
  useSettingsStore.getState().clearSettings();
  clearStoredDailyInsight();
}
