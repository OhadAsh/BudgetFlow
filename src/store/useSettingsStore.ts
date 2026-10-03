import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AutoBackupFormat, BackupSettings } from '../types';
import { DEFAULT_AUTO_BACKUP_INTERVAL_DAYS } from '../lib/localBackup';
import {
  HOUR_DARK_BEFORE,
  HOUR_DARK_FROM,
  normalizeColorSchemeMode,
  normalizeHourValue,
  type ColorSchemeMode,
} from '../lib/colorScheme';

interface SettingsState {
  openRouterApiKey: string | null;
  /** Public Google OAuth Web client ID — user-supplied, stored only in this browser. */
  googleOAuthClientId: string | null;
  /** When true, the app offers/triggers a local file download on a schedule. */
  autoBackupEnabled: boolean;
  /** Days between local auto-backup attempts. */
  autoBackupIntervalDays: number;
  /** File format(s) written to the browser Downloads folder. */
  autoBackupFormat: AutoBackupFormat;
  /** ISO timestamp of the last successful local backup download. */
  lastLocalBackupAt: string | null;
  /**
   * When true, annual stats / trend / savings charts ignore months tagged as outliers.
   * Default true — one-off months should not skew averages.
   */
  excludeOutliersFromStats: boolean;
  /** Appearance: light / dark / OS / time-of-day. */
  colorSchemeMode: ColorSchemeMode;
  /** Hour mode: dark strictly before this local hour (0–23). */
  hourDarkBefore: number;
  /** Hour mode: dark from this local hour inclusive (0–23). */
  hourDarkFrom: number;
  /** Drive `modifiedTime` of the backup file as of the last successful upload/download. */
  lastSyncedRemoteModifiedTime: string | null;
  /** ISO timestamp of the first local change made after that sync — null when in sync. */
  localDirtyAt: string | null;
  setOpenRouterApiKey: (key: string | null) => void;
  setGoogleOAuthClientId: (clientId: string | null) => void;
  setAutoBackupEnabled: (enabled: boolean) => void;
  setAutoBackupIntervalDays: (days: number) => void;
  setAutoBackupFormat: (format: AutoBackupFormat) => void;
  markLocalBackupDone: (at?: string) => void;
  setExcludeOutliersFromStats: (exclude: boolean) => void;
  setColorSchemeMode: (mode: ColorSchemeMode) => void;
  setHourDarkBefore: (hour: number) => void;
  setHourDarkFrom: (hour: number) => void;
  /** Records a finished Drive sync: remote stamp stored, local dirty marker cleared. */
  markDriveSynced: (remoteModifiedTime: string | null) => void;
  /** Flags that local data changed since the last Drive sync (first change wins). */
  markLocalDirty: () => void;
  /** Applies a settings snapshot from a backup; absent fields keep their current value. */
  restoreSettingsFromBackup: (settings: Partial<BackupSettings> | undefined) => void;
  clearSettings: () => void;
}

export const SETTINGS_STORAGE_KEY = 'expense-settings-v1';

function normalizeIntervalDays(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_AUTO_BACKUP_INTERVAL_DAYS;
  }
  const rounded = Math.round(value);
  if (rounded < 1) return 1;
  if (rounded > 365) return 365;
  return rounded;
}

function normalizeFormat(value: unknown): AutoBackupFormat {
  if (value === 'json' || value === 'xlsx' || value === 'both') {
    return value;
  }
  return 'json';
}

/**
 * Snapshot of every persisted preference for a backup file.
 * The OpenRouter key is opt-in so a manual export never leaks a secret by default.
 */
export function readBackupSettings(includeApiKey: boolean): BackupSettings {
  const state = useSettingsStore.getState();
  return {
    openRouterApiKey: includeApiKey ? state.openRouterApiKey : null,
    googleOAuthClientId: state.googleOAuthClientId,
    autoBackupEnabled: state.autoBackupEnabled,
    autoBackupIntervalDays: state.autoBackupIntervalDays,
    autoBackupFormat: state.autoBackupFormat,
    lastLocalBackupAt: state.lastLocalBackupAt,
    excludeOutliersFromStats: state.excludeOutliersFromStats,
    colorSchemeMode: state.colorSchemeMode,
    hourDarkBefore: state.hourDarkBefore,
    hourDarkFrom: state.hourDarkFrom,
  };
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      openRouterApiKey: null,
      googleOAuthClientId: null,
      autoBackupEnabled: true,
      autoBackupIntervalDays: DEFAULT_AUTO_BACKUP_INTERVAL_DAYS,
      autoBackupFormat: 'json',
      lastLocalBackupAt: null,
      excludeOutliersFromStats: true,
      colorSchemeMode: 'system',
      hourDarkBefore: HOUR_DARK_BEFORE,
      hourDarkFrom: HOUR_DARK_FROM,
      lastSyncedRemoteModifiedTime: null,
      localDirtyAt: null,
      setOpenRouterApiKey: (key) => set({ openRouterApiKey: key }),
      setGoogleOAuthClientId: (clientId) => set({ googleOAuthClientId: clientId }),
      setAutoBackupEnabled: (enabled) => set({ autoBackupEnabled: enabled }),
      setAutoBackupIntervalDays: (days) =>
        set({ autoBackupIntervalDays: normalizeIntervalDays(days) }),
      setAutoBackupFormat: (format) => set({ autoBackupFormat: normalizeFormat(format) }),
      markLocalBackupDone: (at) =>
        set({ lastLocalBackupAt: at ?? new Date().toISOString() }),
      setExcludeOutliersFromStats: (exclude) => set({ excludeOutliersFromStats: exclude }),
      setColorSchemeMode: (mode) => set({ colorSchemeMode: normalizeColorSchemeMode(mode) }),
      setHourDarkBefore: (hour) =>
        set({ hourDarkBefore: normalizeHourValue(hour, HOUR_DARK_BEFORE) }),
      setHourDarkFrom: (hour) => set({ hourDarkFrom: normalizeHourValue(hour, HOUR_DARK_FROM) }),
      markDriveSynced: (remoteModifiedTime) =>
        set({
          lastSyncedRemoteModifiedTime:
            typeof remoteModifiedTime === 'string' && remoteModifiedTime.length > 0
              ? remoteModifiedTime
              : null,
          localDirtyAt: null,
        }),
      markLocalDirty: () =>
        set((state) =>
          state.localDirtyAt === null ? { localDirtyAt: new Date().toISOString() } : state
        ),
      restoreSettingsFromBackup: (settings) => {
        if (settings === undefined || settings === null) return;
        set((state) => ({
          // An absent key means "the export did not carry one" — never wipe the local key.
          openRouterApiKey:
            typeof settings.openRouterApiKey === 'string' &&
            settings.openRouterApiKey.trim().length > 0
              ? settings.openRouterApiKey
              : state.openRouterApiKey,
          googleOAuthClientId:
            typeof settings.googleOAuthClientId === 'string' &&
            settings.googleOAuthClientId.trim().length > 0
              ? settings.googleOAuthClientId
              : state.googleOAuthClientId,
          autoBackupEnabled:
            typeof settings.autoBackupEnabled === 'boolean'
              ? settings.autoBackupEnabled
              : state.autoBackupEnabled,
          autoBackupIntervalDays:
            settings.autoBackupIntervalDays === undefined
              ? state.autoBackupIntervalDays
              : normalizeIntervalDays(settings.autoBackupIntervalDays),
          autoBackupFormat:
            settings.autoBackupFormat === undefined
              ? state.autoBackupFormat
              : normalizeFormat(settings.autoBackupFormat),
          lastLocalBackupAt:
            typeof settings.lastLocalBackupAt === 'string'
              ? settings.lastLocalBackupAt
              : state.lastLocalBackupAt,
          excludeOutliersFromStats:
            typeof settings.excludeOutliersFromStats === 'boolean'
              ? settings.excludeOutliersFromStats
              : state.excludeOutliersFromStats,
          colorSchemeMode:
            settings.colorSchemeMode === undefined
              ? state.colorSchemeMode
              : normalizeColorSchemeMode(settings.colorSchemeMode),
          hourDarkBefore:
            settings.hourDarkBefore === undefined
              ? state.hourDarkBefore
              : normalizeHourValue(settings.hourDarkBefore, HOUR_DARK_BEFORE),
          hourDarkFrom:
            settings.hourDarkFrom === undefined
              ? state.hourDarkFrom
              : normalizeHourValue(settings.hourDarkFrom, HOUR_DARK_FROM),
        }));
      },
      clearSettings: () =>
        set({
          openRouterApiKey: null,
          googleOAuthClientId: null,
          autoBackupEnabled: true,
          autoBackupIntervalDays: DEFAULT_AUTO_BACKUP_INTERVAL_DAYS,
          autoBackupFormat: 'json',
          lastLocalBackupAt: null,
          excludeOutliersFromStats: true,
          colorSchemeMode: 'system',
          hourDarkBefore: HOUR_DARK_BEFORE,
          hourDarkFrom: HOUR_DARK_FROM,
          lastSyncedRemoteModifiedTime: null,
          localDirtyAt: null,
        }),
    }),
    {
      name: SETTINGS_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 7,
      migrate: (persisted) => {
        const state = (persisted ?? {}) as Record<string, unknown>;
        return {
          openRouterApiKey:
            typeof state.openRouterApiKey === 'string' ? state.openRouterApiKey : null,
          googleOAuthClientId:
            typeof state.googleOAuthClientId === 'string' ? state.googleOAuthClientId : null,
          autoBackupEnabled:
            typeof state.autoBackupEnabled === 'boolean' ? state.autoBackupEnabled : true,
          autoBackupIntervalDays: normalizeIntervalDays(state.autoBackupIntervalDays),
          autoBackupFormat: normalizeFormat(state.autoBackupFormat),
          lastLocalBackupAt:
            typeof state.lastLocalBackupAt === 'string' ? state.lastLocalBackupAt : null,
          excludeOutliersFromStats:
            typeof state.excludeOutliersFromStats === 'boolean'
              ? state.excludeOutliersFromStats
              : true,
          colorSchemeMode: normalizeColorSchemeMode(state.colorSchemeMode),
          hourDarkBefore: normalizeHourValue(state.hourDarkBefore, HOUR_DARK_BEFORE),
          hourDarkFrom: normalizeHourValue(state.hourDarkFrom, HOUR_DARK_FROM),
          lastSyncedRemoteModifiedTime:
            typeof state.lastSyncedRemoteModifiedTime === 'string'
              ? state.lastSyncedRemoteModifiedTime
              : null,
          localDirtyAt: typeof state.localDirtyAt === 'string' ? state.localDirtyAt : null,
        };
      },
      partialize: (state) => ({
        openRouterApiKey: state.openRouterApiKey,
        googleOAuthClientId: state.googleOAuthClientId,
        autoBackupEnabled: state.autoBackupEnabled,
        autoBackupIntervalDays: state.autoBackupIntervalDays,
        autoBackupFormat: state.autoBackupFormat,
        lastLocalBackupAt: state.lastLocalBackupAt,
        excludeOutliersFromStats: state.excludeOutliersFromStats,
        colorSchemeMode: state.colorSchemeMode,
        hourDarkBefore: state.hourDarkBefore,
        hourDarkFrom: state.hourDarkFrom,
        lastSyncedRemoteModifiedTime: state.lastSyncedRemoteModifiedTime,
        localDirtyAt: state.localDirtyAt,
      }),
    }
  )
);
