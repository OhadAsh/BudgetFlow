import { describe, expect, it } from 'vitest';
import type { CustomCategory, Expense, MonthData } from '../types';
import {
  getAnnualStats,
  getCategoryBreakdown,
  getMonthlySeries,
  getMonthStats,
  getOutOfFlowProjects,
  sumExpenses,
  sumOutOfFlow,
} from './calculations';
import { buildCategoryKindMap } from './utils';

function month(
  year: number,
  monthNumber: number,
  income: number,
  expenses: number,
  flags?: { isOutlier?: boolean; outlierNote?: string }
): MonthData {
  return {
    year,
    month: monthNumber,
    income: income > 0 ? [{ id: `i-${monthNumber}`, label: 'משכורת', amount: income }] : [],
    expenses:
      expenses > 0
        ? [{ id: `e-${monthNumber}`, category: 'מזון', description: 'סופר', amount: expenses }]
        : [],
    ...(flags?.isOutlier === true ? { isOutlier: true } : {}),
    ...(flags?.outlierNote !== undefined ? { outlierNote: flags.outlierNote } : {}),
  };
}

describe('calculations — outlier exclusion', () => {
  const baseMonths: MonthData[] = [
    month(2026, 1, 10000, 4000), // saved 6000
    month(2026, 2, 10000, 7000), // saved 3000
    month(2026, 3, 10000, 9000), // saved 1000
  ];

  it('legacy path (no options, no outliers) keeps annual totals identical', () => {
    const baseline = getAnnualStats(baseMonths, 2026);
    const withExplicitFalse = getAnnualStats(baseMonths, 2026, { excludeOutliers: false });

    expect(baseline.totalIncome).toBe(30000);
    expect(baseline.totalExpenses).toBe(20000);
    expect(baseline.totalSaved).toBe(10000);
    expect(baseline.avgMonthlySavings).toBeCloseTo(10000 / 3);
    expect(baseline.bestMonth).toEqual({ month: 1, saved: 6000 });
    expect(baseline.worstMonth).toEqual({ month: 3, saved: 1000 });

    expect(withExplicitFalse).toEqual(baseline);
  });

  it('excludeOutliers with no tagged months matches legacy results exactly', () => {
    const baseline = getAnnualStats(baseMonths, 2026);
    const excluded = getAnnualStats(baseMonths, 2026, { excludeOutliers: true });
    expect(excluded).toEqual(baseline);

    const seriesDefault = getMonthlySeries(baseMonths, 2026);
    const seriesExcluded = getMonthlySeries(baseMonths, 2026, { excludeOutliers: true });
    expect(seriesExcluded.map(({ isOutlier: _i, ...rest }) => rest)).toEqual(
      seriesDefault.map(({ isOutlier: _j, ...rest }) => rest)
    );
    expect(seriesDefault.every((point) => point.isOutlier === false)).toBe(true);
  });

  it('excluding a tagged outlier changes averages, totals, and best/worst', () => {
    const withOutlier: MonthData[] = [
      month(2026, 1, 10000, 4000),
      month(2026, 2, 10000, 7000),
      month(2026, 3, 10000, 20000, { isOutlier: true, outlierNote: 'חתונה' }), // saved -10000
    ];

    const includeAll = getAnnualStats(withOutlier, 2026, { excludeOutliers: false });
    const exclude = getAnnualStats(withOutlier, 2026, { excludeOutliers: true });

    expect(includeAll.totalIncome).toBe(30000);
    expect(includeAll.totalExpenses).toBe(31000);
    expect(includeAll.totalSaved).toBe(-1000);
    expect(includeAll.avgMonthlySavings).toBeCloseTo(-1000 / 3);
    expect(includeAll.worstMonth).toEqual({ month: 3, saved: -10000 });
    expect(includeAll.bestMonth).toEqual({ month: 1, saved: 6000 });

    expect(exclude.totalIncome).toBe(20000);
    expect(exclude.totalExpenses).toBe(11000);
    expect(exclude.totalSaved).toBe(9000);
    expect(exclude.avgMonthlySavings).toBeCloseTo(9000 / 2);
    expect(exclude.bestMonth).toEqual({ month: 1, saved: 6000 });
    expect(exclude.worstMonth).toEqual({ month: 2, saved: 3000 });
  });

  it('monthly series zeroes outlier months only when excludeOutliers is true', () => {
    const withOutlier: MonthData[] = [
      month(2026, 1, 10000, 4000),
      month(2026, 2, 5000, 1000, { isOutlier: true }),
    ];

    const raw = getMonthlySeries(withOutlier, 2026);
    expect(raw[1].isOutlier).toBe(true);
    expect(raw[1].hasData).toBe(true);
    expect(raw[1].income).toBe(5000);
    expect(raw[1].saved).toBe(4000);

    const filtered = getMonthlySeries(withOutlier, 2026, { excludeOutliers: true });
    expect(filtered[1].isOutlier).toBe(true);
    expect(filtered[1].hasData).toBe(false);
    expect(filtered[1].income).toBe(0);
    expect(filtered[1].expenses).toBe(0);
    expect(filtered[1].saved).toBe(0);

    // Non-outlier months unchanged.
    expect(filtered[0].income).toBe(raw[0].income);
    expect(filtered[0].saved).toBe(raw[0].saved);
  });

  it('per-month stats are unaffected by the outlier flag', () => {
    const tagged = month(2026, 4, 8000, 2000, { isOutlier: true, outlierNote: 'מעבר' });
    const stats = getMonthStats(tagged);
    expect(stats.totalIncome).toBe(8000);
    expect(stats.totalExpenses).toBe(2000);
    expect(stats.netSaved).toBe(6000);
    expect(stats.hasData).toBe(true);
  });

  it('byCategory annual breakdown skips outlier months when excluding', () => {
    const months: MonthData[] = [
      month(2026, 1, 10000, 1000),
      {
        year: 2026,
        month: 2,
        isOutlier: true,
        income: [{ id: 'i', label: 'משכורת', amount: 10000 }],
        expenses: [
          { id: 'e1', category: 'בילויים', description: 'חתונה', amount: 15000 },
        ],
      },
    ];

    const include = getAnnualStats(months, 2026, { excludeOutliers: false });
    const exclude = getAnnualStats(months, 2026, { excludeOutliers: true });

    expect(include.byCategory['בילויים']).toBe(15000);
    expect(include.byCategory['מזון']).toBe(1000);
    expect(exclude.byCategory['בילויים'] ?? 0).toBe(0);
    expect(exclude.byCategory['מזון']).toBe(1000);
  });
});

describe('calculations — out-of-flow categories', () => {
  const wedding: CustomCategory = {
    id: 'w',
    name: 'חתונה',
    emoji: '🎁',
    color: '#ec4899',
    kind: 'outOfFlow',
  };
  const customCategories: CustomCategory[] = [wedding];
  const kinds = buildCategoryKindMap(customCategories);

  function expense(id: string, category: string, amount: number, date?: string): Expense {
    return {
      id,
      category,
      description: category,
      amount,
      ...(date !== undefined ? { date } : {}),
    };
  }

  const marchMonth: MonthData = {
    year: 2026,
    month: 3,
    income: [{ id: 'i-3', label: 'משכורת', amount: 20000 }],
    expenses: [
      expense('e-1', 'מזון', 2000, '2026-03-05'),
      expense('e-2', 'דיור', 4000, '2026-03-01'),
      expense('e-3', 'חיסכון', 1500, '2026-03-10'),
      expense('e-4', 'חתונה', 11000, '2026-03-20'),
    ],
  };

  it('keeps out-of-flow spending out of expenses, savings, and the savings rate', () => {
    const stats = getMonthStats(marchMonth, kinds);

    expect(stats.totalExpenses).toBe(6000);
    expect(stats.totalSavingsCategory).toBe(1500);
    expect(stats.totalOutOfFlow).toBe(11000);
    expect(stats.netSaved).toBe(14000);
    expect(stats.savingsRate).toBe(70);
    expect(stats.outOfFlowByCategory).toEqual({ חתונה: 11000 });
    // The row itself is still there — only the statistics ignore it.
    expect(stats.expenseCount).toBe(4);
    expect(stats.activeCategoryCount).toBe(2);
  });

  it('omits out-of-flow categories from the pie breakdown and its percentage base', () => {
    const breakdown = getCategoryBreakdown(marchMonth.expenses, customCategories);

    expect(breakdown.map((item) => item.category)).toEqual(['דיור', 'מזון']);
    expect(breakdown[0].percentage).toBeCloseTo((4000 / 6000) * 100);
    expect(breakdown[1].percentage).toBeCloseTo((2000 / 6000) * 100);
  });

  it('sums a project across months and years into a cost meter', () => {
    const months: MonthData[] = [
      {
        year: 2025,
        month: 11,
        income: [],
        expenses: [expense('p-0', 'חתונה', 3000, '2025-11-02')],
      },
      marchMonth,
      {
        year: 2026,
        month: 5,
        income: [{ id: 'i-5', label: 'משכורת', amount: 20000 }],
        expenses: [
          expense('p-1', 'חתונה', 9000, '2026-05-12'),
          expense('p-2', 'מזון', 1800, '2026-05-03'),
        ],
      },
    ];

    const projects = getOutOfFlowProjects(months, customCategories, 2026);

    expect(projects).toHaveLength(1);
    expect(projects[0].category).toBe('חתונה');
    expect(projects[0].yearTotal).toBe(20000);
    expect(projects[0].allTimeTotal).toBe(23000);
    expect(projects[0].paymentCount).toBe(3);
    expect(projects[0].lastPaymentDate).toBe('2026-05-12');

    const annual = getAnnualStats(months, 2026, { kinds });
    expect(annual.totalExpenses).toBe(7800);
    expect(annual.totalOutOfFlow).toBe(20000);
    expect(annual.outOfFlowByCategory).toEqual({ חתונה: 20000 });
  });

  it('returns no projects when no category is tagged as out-of-flow', () => {
    expect(getOutOfFlowProjects([marchMonth], [], 2026)).toEqual([]);
  });

  it('stacks with month-level outlier exclusion without conflict', () => {
    const months: MonthData[] = [
      marchMonth,
      {
        year: 2026,
        month: 4,
        isOutlier: true,
        outlierNote: 'אשפוז',
        income: [{ id: 'i-4', label: 'משכורת', amount: 20000 }],
        expenses: [expense('o-1', 'בריאות', 8000), expense('o-2', 'חתונה', 5000)],
      },
    ];

    const includeOutliers = getAnnualStats(months, 2026, { kinds });
    const excludeOutliers = getAnnualStats(months, 2026, { kinds, excludeOutliers: true });

    expect(includeOutliers.totalExpenses).toBe(14000);
    expect(includeOutliers.totalOutOfFlow).toBe(16000);

    expect(excludeOutliers.totalExpenses).toBe(6000);
    expect(excludeOutliers.totalOutOfFlow).toBe(11000);
  });

  it('sumExpenses without a kind map behaves like before category kinds existed', () => {
    expect(sumExpenses(marchMonth.expenses)).toBe(17000);
    expect(sumExpenses(marchMonth.expenses, kinds)).toBe(6000);
    expect(sumOutOfFlow(marchMonth.expenses)).toBe(0);
    expect(sumOutOfFlow(marchMonth.expenses, kinds)).toBe(11000);
  });
});
