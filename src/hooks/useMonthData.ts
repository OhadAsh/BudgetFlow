import { useMemo } from 'react';
import type {
  AnnualStats,
  CategoryBreakdownItem,
  MonthData,
  MonthStats,
  MonthlySeriesPoint,
} from '../types';
import { useExpenseStore } from '../store/useExpenseStore';
import { useSettingsStore } from '../store/useSettingsStore';
import {
  createEmptyMonth,
  findMonth,
  getAnnualStats,
  getAvailableYears,
  getCategoryBreakdown,
  getMonthStats,
  getMonthlySeries,
} from '../lib/calculations';
import { currentYear, previousPeriod } from '../lib/utils';

export interface UseMonthDataResult {
  year: number;
  month: number;
  monthData: MonthData;
  stats: MonthStats;
  previousStats: MonthStats;
  incomeDelta: number;
  expensesDelta: number;
  savedDelta: number;
  breakdown: CategoryBreakdownItem[];
  largestCategory: CategoryBreakdownItem | null;
  monthlySeries: MonthlySeriesPoint[];
  /** Full series including outlier values — for tables that always show raw months. */
  monthlySeriesRaw: MonthlySeriesPoint[];
  annualStats: AnnualStats;
  availableYears: number[];
  monthsWithData: number[];
  outlierMonths: number[];
  excludeOutliersFromStats: boolean;
}

/** Single source of truth for everything derived from the selected month. */
export function useMonthData(): UseMonthDataResult {
  const months = useExpenseStore((state) => state.months);
  const year = useExpenseStore((state) => state.selectedYear);
  const month = useExpenseStore((state) => state.selectedMonth);
  const customCategories = useExpenseStore((state) => state.customCategories);
  const excludeOutliersFromStats = useSettingsStore((state) => state.excludeOutliersFromStats);

  return useMemo<UseMonthDataResult>(() => {
    const monthData = findMonth(months, year, month) ?? createEmptyMonth(year, month);
    const stats = getMonthStats(monthData);

    const previous = previousPeriod(year, month);
    const previousStats = getMonthStats(findMonth(months, previous.year, previous.month));

    const breakdown = getCategoryBreakdown(monthData.expenses, customCategories);
    const monthlySeriesRaw = getMonthlySeries(months, year);
    const monthlySeries = getMonthlySeries(months, year, {
      excludeOutliers: excludeOutliersFromStats,
    });

    return {
      year,
      month,
      monthData,
      stats,
      previousStats,
      incomeDelta: stats.totalIncome - previousStats.totalIncome,
      expensesDelta: stats.totalExpenses - previousStats.totalExpenses,
      savedDelta: stats.netSaved - previousStats.netSaved,
      breakdown,
      largestCategory: breakdown.length > 0 ? breakdown[0] : null,
      monthlySeries,
      monthlySeriesRaw,
      annualStats: getAnnualStats(months, year, {
        excludeOutliers: excludeOutliersFromStats,
      }),
      availableYears: getAvailableYears(months, currentYear()),
      monthsWithData: monthlySeriesRaw
        .filter((point) => point.hasData)
        .map((point) => point.month),
      outlierMonths: monthlySeriesRaw
        .filter((point) => point.isOutlier)
        .map((point) => point.month),
      excludeOutliersFromStats,
    };
  }, [months, year, month, customCategories, excludeOutliersFromStats]);
}
