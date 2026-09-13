/** User-facing theme preference (persisted). */
export type ColorSchemeMode = 'light' | 'dark' | 'system' | 'hour';

/** Resolved scheme applied to the UI. */
export type ResolvedColorScheme = 'light' | 'dark';

export interface HourDarkWindow {
  /** Local hour (0–23): dark strictly before this morning hour. */
  darkBefore: number;
  /** Local hour (0–23): dark from this evening hour onward. */
  darkFrom: number;
}

export const COLOR_SCHEME_MODE_OPTIONS: Array<{ value: ColorSchemeMode; label: string }> = [
  { value: 'light', label: 'בהיר' },
  { value: 'dark', label: 'כהה' },
  { value: 'system', label: 'לפי המערכת' },
  { value: 'hour', label: 'אוטומטי לפי שעה' },
];

/** Default local hour window: dark before 06:00 and from 19:00 onward. */
export const HOUR_DARK_BEFORE = 6;
export const HOUR_DARK_FROM = 19;

export const DEFAULT_HOUR_DARK_WINDOW: HourDarkWindow = {
  darkBefore: HOUR_DARK_BEFORE,
  darkFrom: HOUR_DARK_FROM,
};

export function normalizeColorSchemeMode(value: unknown): ColorSchemeMode {
  if (value === 'light' || value === 'dark' || value === 'system' || value === 'hour') {
    return value;
  }
  return 'system';
}

/** Clamps a wall-clock hour to an integer in 0–23. */
export function normalizeHourValue(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  const rounded = Math.round(value);
  if (rounded < 0) return 0;
  if (rounded > 23) return 23;
  return rounded;
}

export function normalizeHourDarkWindow(
  darkBefore: unknown,
  darkFrom: unknown
): HourDarkWindow {
  return {
    darkBefore: normalizeHourValue(darkBefore, HOUR_DARK_BEFORE),
    darkFrom: normalizeHourValue(darkFrom, HOUR_DARK_FROM),
  };
}

/**
 * True when "hour" mode should use dark (local wall clock).
 * Dark before `darkBefore`, and from `darkFrom` inclusive onward.
 */
export function isDarkByHour(
  now: Date = new Date(),
  window: HourDarkWindow = DEFAULT_HOUR_DARK_WINDOW
): boolean {
  const hour = now.getHours();
  return hour < window.darkBefore || hour >= window.darkFrom;
}

export function getSystemPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Resolves the effective light/dark scheme from the user mode.
 * `system` follows OS; `hour` follows local time + window; light/dark are forced.
 */
export function resolveColorScheme(
  mode: ColorSchemeMode,
  now: Date = new Date(),
  systemPrefersDark: boolean = getSystemPrefersDark(),
  hourWindow: HourDarkWindow = DEFAULT_HOUR_DARK_WINDOW
): ResolvedColorScheme {
  switch (mode) {
    case 'light':
      return 'light';
    case 'dark':
      return 'dark';
    case 'hour':
      return isDarkByHour(now, hourWindow) ? 'dark' : 'light';
    case 'system':
    default:
      return systemPrefersDark ? 'dark' : 'light';
  }
}
