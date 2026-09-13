import { describe, expect, it } from 'vitest';
import {
  isDarkByHour,
  normalizeColorSchemeMode,
  normalizeHourValue,
  resolveColorScheme,
} from './colorScheme';

describe('colorScheme', () => {
  it('normalizes unknown values to system', () => {
    expect(normalizeColorSchemeMode('nope')).toBe('system');
    expect(normalizeColorSchemeMode('dark')).toBe('dark');
  });

  it('normalizes hour values to 0–23', () => {
    expect(normalizeHourValue(7.6, 6)).toBe(8);
    expect(normalizeHourValue(-1, 6)).toBe(0);
    expect(normalizeHourValue(30, 6)).toBe(23);
    expect(normalizeHourValue('x', 6)).toBe(6);
  });

  it('hour mode is dark before 06:00 and from 19:00 by default', () => {
    expect(isDarkByHour(new Date(2026, 0, 1, 5, 59))).toBe(true);
    expect(isDarkByHour(new Date(2026, 0, 1, 6, 0))).toBe(false);
    expect(isDarkByHour(new Date(2026, 0, 1, 12, 0))).toBe(false);
    expect(isDarkByHour(new Date(2026, 0, 1, 19, 0))).toBe(true);
    expect(isDarkByHour(new Date(2026, 0, 1, 23, 0))).toBe(true);
  });

  it('hour mode respects a custom window from the store', () => {
    const window = { darkBefore: 8, darkFrom: 21 };
    expect(isDarkByHour(new Date(2026, 0, 1, 7, 0), window)).toBe(true);
    expect(isDarkByHour(new Date(2026, 0, 1, 8, 0), window)).toBe(false);
    expect(isDarkByHour(new Date(2026, 0, 1, 20, 0), window)).toBe(false);
    expect(isDarkByHour(new Date(2026, 0, 1, 21, 0), window)).toBe(true);
  });

  it('resolves light / dark / system / hour', () => {
    expect(resolveColorScheme('light', new Date(), true)).toBe('light');
    expect(resolveColorScheme('dark', new Date(), false)).toBe('dark');
    expect(resolveColorScheme('system', new Date(), true)).toBe('dark');
    expect(resolveColorScheme('system', new Date(), false)).toBe('light');
    expect(resolveColorScheme('hour', new Date(2026, 0, 1, 21, 0), false)).toBe('dark');
    expect(resolveColorScheme('hour', new Date(2026, 0, 1, 10, 0), true)).toBe('light');
    expect(
      resolveColorScheme('hour', new Date(2026, 0, 1, 20, 0), false, {
        darkBefore: 8,
        darkFrom: 21,
      })
    ).toBe('light');
  });
});
