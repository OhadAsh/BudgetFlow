import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CustomCategory, MonthData } from '../types';

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

const memoryStorage = new MemoryStorage();

vi.stubGlobal('localStorage', memoryStorage);

// Import after localStorage stub so persist middleware can attach.
const { useExpenseStore } = await import('../store/useExpenseStore');

function makeMonth(
  year: number,
  month: number,
  extras?: Partial<MonthData>
): MonthData {
  return {
    year,
    month,
    income: [{ id: `inc-${year}-${month}`, label: 'משכורת', amount: 10000 }],
    expenses: [
      { id: `exp-${year}-${month}`, category: 'מזון', description: 'סופר', amount: 2000 },
    ],
    ...extras,
  };
}

describe('useExpenseStore.clearMonth', () => {
  const customCategories: CustomCategory[] = [
    { id: 'cat-1', name: 'חיות', emoji: '🐾', color: '#6366f1' },
  ];
  const merchantMemory = { 'סופר יין': 'מזון' };
  const categoryTargets = { מזון: 2500, דיור: 5000 };

  beforeEach(() => {
    memoryStorage.clear();
    useExpenseStore.setState({
      months: [
        makeMonth(2026, 1, { isOutlier: true, outlierNote: 'חתונה' }),
        makeMonth(2026, 2),
        makeMonth(2026, 3),
      ],
      selectedYear: 2026,
      selectedMonth: 1,
      customCategories: [...customCategories],
      merchantMemory: { ...merchantMemory },
      categoryTargets: { ...categoryTargets },
    });
  });

  it('clears only the target month and leaves categories, goals, and other months intact', () => {
    const before = useExpenseStore.getState();
    const january = before.months.find((entry) => entry.year === 2026 && entry.month === 1);
    expect(january?.income).toHaveLength(1);
    expect(january?.expenses).toHaveLength(1);
    expect(january?.isOutlier).toBe(true);

    const snapshot = useExpenseStore.getState().clearMonth(2026, 1);

    expect(snapshot).not.toBeNull();
    expect(snapshot?.income).toHaveLength(1);
    expect(snapshot?.expenses).toHaveLength(1);
    expect(snapshot?.isOutlier).toBe(true);
    expect(snapshot?.outlierNote).toBe('חתונה');

    const after = useExpenseStore.getState();

    // Target month gone (entries + outlier flag).
    expect(after.months.find((entry) => entry.year === 2026 && entry.month === 1)).toBeUndefined();

    // Sibling months untouched (same ids / amounts).
    const feb = after.months.find((entry) => entry.year === 2026 && entry.month === 2);
    const mar = after.months.find((entry) => entry.year === 2026 && entry.month === 3);
    expect(feb).toEqual(makeMonth(2026, 2));
    expect(mar).toEqual(makeMonth(2026, 3));

    // Settings / goals / merchant memory preserved by reference equality of contents.
    expect(after.customCategories).toEqual(customCategories);
    expect(after.merchantMemory).toEqual(merchantMemory);
    expect(after.categoryTargets).toEqual(categoryTargets);

    // Selected period stays on the cleared month (now empty).
    expect(after.selectedYear).toBe(2026);
    expect(after.selectedMonth).toBe(1);
  });

  it('restoreMonth puts income, expenses, and outlier metadata back exactly', () => {
    const snapshot = useExpenseStore.getState().clearMonth(2026, 1);
    expect(snapshot).not.toBeNull();

    useExpenseStore.getState().restoreMonth(snapshot as MonthData);

    const restored = useExpenseStore
      .getState()
      .months.find((entry) => entry.year === 2026 && entry.month === 1);

    expect(restored).toEqual(makeMonth(2026, 1, { isOutlier: true, outlierNote: 'חתונה' }));
    expect(useExpenseStore.getState().customCategories).toEqual(customCategories);
    expect(useExpenseStore.getState().categoryTargets).toEqual(categoryTargets);
  });

  it('returns null when the month has no entries', () => {
    useExpenseStore.setState({
      months: [makeMonth(2026, 2)],
      selectedYear: 2026,
      selectedMonth: 1,
    });

    const result = useExpenseStore.getState().clearMonth(2026, 1);
    expect(result).toBeNull();
    expect(useExpenseStore.getState().months).toEqual([makeMonth(2026, 2)]);
  });
});
