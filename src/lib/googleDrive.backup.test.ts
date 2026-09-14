import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildDriveBackupPayload,
  formatDriveBackupExportedAt,
  parseDriveBackupPayload,
} from './googleDrive';
import { applyFullBackupRestore } from './clearUserData';
import { useExpenseStore } from '../store/useExpenseStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { DRIVE_BACKUP_VERSION } from './constants';

describe('Drive backup payload', () => {
  it('includes expense-tracker fields plus OpenRouter key, not Google Client ID', () => {
    const payload = buildDriveBackupPayload({
      months: [{ year: 2026, month: 2, income: [], expenses: [] }],
      selectedYear: 2026,
      selectedMonth: 2,
      customCategories: [
        { id: '1', name: 'בזבוזים', emoji: '🛍️', color: '#f00', kind: 'spending' },
      ],
      merchantMemory: { פיגל: 'בזבוזים' },
      categoryTargets: { בזבוזים: 500 },
      openRouterApiKey: 'sk-test-key',
    });

    expect(payload.version).toBe(DRIVE_BACKUP_VERSION);
    expect(payload.months).toHaveLength(1);
    expect(payload.customCategories).toHaveLength(1);
    expect(payload.merchantMemory).toEqual({ פיגל: 'בזבוזים' });
    expect(payload.categoryTargets).toEqual({ בזבוזים: 500 });
    expect(payload.openRouterApiKey).toBe('sk-test-key');
    expect(payload).not.toHaveProperty('googleOAuthClientId');
  });

  it('parses legacy backups without openRouterApiKey as null', () => {
    const parsed = parseDriveBackupPayload({
      version: 1,
      exportedAt: '2026-02-01T10:00:00.000Z',
      months: [],
      selectedYear: 2026,
      selectedMonth: 1,
      customCategories: [],
      merchantMemory: {},
      categoryTargets: {},
    });
    expect(parsed.openRouterApiKey).toBeNull();
  });

  it('round-trips openRouterApiKey through parse', () => {
    const built = buildDriveBackupPayload({
      months: [],
      selectedYear: 2026,
      selectedMonth: 3,
      customCategories: [],
      merchantMemory: {},
      categoryTargets: {},
      openRouterApiKey: 'sk-round-trip',
    });
    const parsed = parseDriveBackupPayload(JSON.parse(JSON.stringify(built)) as unknown);
    expect(parsed.openRouterApiKey).toBe('sk-round-trip');
  });

  it('formats exportedAt in Hebrew', () => {
    const label = formatDriveBackupExportedAt('2026-02-01T10:30:00.000Z');
    expect(label.length).toBeGreaterThan(0);
    expect(label).toMatch(/2026/);
  });
});

describe('applyFullBackupRestore', () => {
  afterEach(() => {
    useExpenseStore.getState().clearAll();
    useSettingsStore.getState().clearSettings();
    vi.restoreAllMocks();
  });

  it('fully overwrites expense store and OpenRouter key; leaves Client ID alone', () => {
    useExpenseStore.setState({
      months: [
        {
          year: 2025,
          month: 12,
          income: [{ id: 'old', label: 'ישן', amount: 1 }],
          expenses: [],
        },
      ],
      selectedYear: 2025,
      selectedMonth: 12,
      customCategories: [{ id: 'c', name: 'ישן', emoji: 'x', color: '#000', kind: 'spending' }],
      merchantMemory: { old: 'אחר' },
      categoryTargets: { אחר: 9 },
    });
    useSettingsStore.setState({
      openRouterApiKey: 'sk-local',
      googleOAuthClientId: 'local-client.apps.googleusercontent.com',
    });

    applyFullBackupRestore({
      version: 2,
      exportedAt: '2026-03-01T12:00:00.000Z',
      months: [
        {
          year: 2026,
          month: 3,
          income: [{ id: 'n', label: 'משכורת', amount: 100 }],
          expenses: [],
        },
      ],
      selectedYear: 2026,
      selectedMonth: 3,
      customCategories: [],
      merchantMemory: {},
      categoryTargets: {},
      openRouterApiKey: 'sk-from-backup',
    });

    const expense = useExpenseStore.getState();
    expect(expense.months).toHaveLength(1);
    expect(expense.months[0].year).toBe(2026);
    expect(expense.months[0].income[0].label).toBe('משכורת');
    expect(expense.customCategories).toEqual([]);
    expect(expense.merchantMemory).toEqual({});
    expect(expense.categoryTargets).toEqual({});
    expect(expense.selectedYear).toBe(2026);
    expect(expense.selectedMonth).toBe(3);

    const settings = useSettingsStore.getState();
    expect(settings.openRouterApiKey).toBe('sk-from-backup');
    expect(settings.googleOAuthClientId).toBe('local-client.apps.googleusercontent.com');
  });
});
