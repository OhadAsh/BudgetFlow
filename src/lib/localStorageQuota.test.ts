import { describe, expect, it } from 'vitest';
import {
  formatStorageBytes,
  getLocalStorageUsage,
  measureLocalStorageUsedBytes,
  resolveUsageLevel,
} from './localStorageQuota';
import {
  buildLocalJsonBackupFileName,
  formatLastBackupLabel,
  isAutoBackupDue,
  shouldNudgeLocalBackup,
} from './localBackup';

class MemoryStorage implements Storage {
  private readonly map = new Map<string, string>();

  get length(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }

  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }

  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

describe('localStorageQuota', () => {
  it('measures UTF-16 byte usage of keys and values', () => {
    const storage = new MemoryStorage();
    storage.setItem('ab', 'cd'); // (2 + 2) * 2 = 8
    expect(measureLocalStorageUsedBytes(storage)).toBe(8);
  });

  it('classifies warn and critical levels by ratio', () => {
    expect(resolveUsageLevel(0.69)).toBe('ok');
    expect(resolveUsageLevel(0.7)).toBe('warn');
    expect(resolveUsageLevel(0.9)).toBe('critical');
  });

  it('computes usage percent against the default quota', () => {
    const storage = new MemoryStorage();
    storage.setItem('small', 'hello');
    const usage = getLocalStorageUsage(storage, 10_000);
    expect(usage.level).toBe('ok');
    expect(usage.usedBytes).toBe(('small'.length + 'hello'.length) * 2);
    expect(usage.quotaBytes).toBe(10_000);
    expect(usage.percentUsed).toBeGreaterThanOrEqual(0);
  });

  it('marks critical when usage crosses 90%', () => {
    const storage = new MemoryStorage();
    storage.setItem('k', 'x'.repeat(450)); // (1+450)*2 = 902 bytes
    const usage = getLocalStorageUsage(storage, 1000);
    expect(usage.level).toBe('critical');
    expect(usage.percentUsed).toBe(90);
  });

  it('formats byte sizes for Hebrew UI', () => {
    expect(formatStorageBytes(500)).toBe('500 B');
    expect(formatStorageBytes(2048)).toBe('2.0 KB');
    expect(formatStorageBytes(2 * 1024 * 1024)).toBe('2.00 MB');
  });
});

describe('localBackup schedule helpers', () => {
  it('does not auto-schedule before the first successful backup', () => {
    expect(isAutoBackupDue(null, 7)).toBe(false);
    expect(isAutoBackupDue('', 7)).toBe(false);
  });

  it('nudges when never backed up, even if auto schedule has not started', () => {
    expect(shouldNudgeLocalBackup(null, 7)).toBe(true);
  });

  it('is due only after the configured interval', () => {
    const now = new Date('2026-09-13T12:00:00.000Z');
    const sixDaysAgo = '2026-09-07T12:00:00.000Z';
    const eightDaysAgo = '2026-09-05T12:00:00.000Z';
    expect(isAutoBackupDue(sixDaysAgo, 7, now)).toBe(false);
    expect(isAutoBackupDue(eightDaysAgo, 7, now)).toBe(true);
    expect(shouldNudgeLocalBackup(eightDaysAgo, 7, now)).toBe(true);
  });

  it('builds a dated JSON file name', () => {
    expect(buildLocalJsonBackupFileName(new Date('2026-09-13T15:00:00'))).toBe(
      'budgetflow-backup-2026-09-13.json'
    );
  });

  it('formats last-backup labels in Hebrew', () => {
    expect(formatLastBackupLabel(null)).toBe('עדיין לא בוצע גיבוי מקומי');
    const now = new Date('2026-09-13T12:00:00.000Z');
    expect(formatLastBackupLabel('2026-09-13T11:30:00.000Z', now)).toBe(
      'גיבוי אחרון: לפני 30 דק׳'
    );
  });
});
