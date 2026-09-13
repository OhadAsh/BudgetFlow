import { describe, expect, it } from 'vitest';
import type { MonthData } from '../types';
import {
  getAnnualStats,
  getMonthlySeries,
  getMonthStats,
} from './calculations';

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
