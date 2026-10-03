import type { LocalBackupSnapshotInput } from './localBackup';
import { useExpenseStore } from '../store/useExpenseStore';
import { readBackupSettings, useSettingsStore } from '../store/useSettingsStore';

export interface BackupSnapshotOptions {
  /**
   * Writes the OpenRouter key into the file. Always on for Google Drive
   * (private app folder), opt-in for a manual download.
   */
  includeApiKey?: boolean;
}

/** The one snapshot every backup path uses — Drive upload and local file alike. */
export function readBackupSnapshot(
  options: BackupSnapshotOptions = {}
): LocalBackupSnapshotInput {
  const settings = readBackupSettings(options.includeApiKey === true);
  const state = useExpenseStore.getState();

  return {
    months: state.months,
    selectedYear: state.selectedYear,
    selectedMonth: state.selectedMonth,
    customCategories: state.customCategories,
    merchantMemory: state.merchantMemory,
    categoryTargets: state.categoryTargets,
    excludedTransactions: state.excludedTransactions,
    openRouterApiKey: settings.openRouterApiKey,
    settings,
  };
}

type ExpenseSnapshot = ReturnType<typeof useExpenseStore.getState>;
type SettingsSnapshot = ReturnType<typeof useSettingsStore.getState>;

/** Expense-store fields that belong in a backup — a change here needs a new sync. */
const TRACKED_EXPENSE_KEYS: Array<keyof ExpenseSnapshot> = [
  'months',
  'selectedYear',
  'selectedMonth',
  'customCategories',
  'merchantMemory',
  'categoryTargets',
  'excludedTransactions',
];

/**
 * Settings fields that belong in a backup. The sync bookkeeping itself
 * (`lastSyncedRemoteModifiedTime`, `localDirtyAt`, `lastLocalBackupAt`) is left
 * out so recording a sync cannot mark the state dirty again.
 */
const TRACKED_SETTINGS_KEYS: Array<keyof SettingsSnapshot> = [
  'openRouterApiKey',
  'googleOAuthClientId',
  'autoBackupEnabled',
  'autoBackupIntervalDays',
  'autoBackupFormat',
  'excludeOutliersFromStats',
  'colorSchemeMode',
  'hourDarkBefore',
  'hourDarkFrom',
];

let trackingStarted = false;

/**
 * Starts flagging local edits so an upload can tell "nothing changed here" from
 * "both sides changed". Safe to call more than once.
 *
 * Must run after the persist middleware hydrated (it does, synchronously at
 * module load) so restoring localStorage never counts as a local change.
 */
export function startLocalChangeTracking(): void {
  if (trackingStarted) return;
  trackingStarted = true;

  const markDirty = (): void => {
    useSettingsStore.getState().markLocalDirty();
  };

  useExpenseStore.subscribe((state, previous) => {
    if (TRACKED_EXPENSE_KEYS.some((key) => state[key] !== previous[key])) {
      markDirty();
    }
  });

  useSettingsStore.subscribe((state, previous) => {
    if (TRACKED_SETTINGS_KEYS.some((key) => state[key] !== previous[key])) {
      markDirty();
    }
  });
}
