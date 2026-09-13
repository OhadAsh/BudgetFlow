import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AutoBackupFormat } from '../lib/localBackup';
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
        }),
    }),
    {
      name: SETTINGS_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 6,
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
      }),
    }
  )
);
