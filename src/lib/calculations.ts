import type {
  AnnualStats,
  CategoryBreakdownItem,
  CategoryType,
  CustomCategory,
  Expense,
  IncomeSource,
  MonthData,
  MonthStats,
  MonthlySeriesPoint,
  OutOfFlowProject,
} from '../types';
import { CATEGORIES } from './constants';
import type { CategoryKindMap } from './utils';
import {
  DEFAULT_CATEGORY_KINDS,
  buildCategoryKindMap,
  clampMonth,
  getShortMonthName,
  resolveCategoryMeta,
} from './utils';

/** Options for year-level aggregations and chart series. */
export interface AggregationOptions {
  /**
   * When true, months with `isOutlier` are omitted from totals, averages,
   * best/worst, and chart values (treated as empty for aggregation).
   * Default false — preserves legacy behaviour when callers omit the flag.
   */
  excludeOutliers?: boolean;
  /**
   * Category kinds resolved from the user's custom categories.
   * Omitted means built-in kinds only (savings excluded, no out-of-flow categories).
   */
  kinds?: CategoryKindMap;
}

export function emptyCategoryRecord(): Record<CategoryType, number> {
  return CATEGORIES.reduce<Record<CategoryType, number>>((acc, category) => {
    acc[category] = 0;
    return acc;
  }, {} as Record<CategoryType, number>);
}

export function sumIncome(income: IncomeSource[]): number {
  return income.reduce((total, source) => total + safeNumber(source.amount), 0);
}

/**
 * Spending only — money routed to a savings category is not an expense, and
 * out-of-flow categories (planned projects / investments) are outside the cash flow.
 */
export function sumExpenses(
  expenses: Expense[],
  kinds: CategoryKindMap = DEFAULT_CATEGORY_KINDS
): number {
  return expenses
    .filter(
      (expense) =>
        !kinds.savings.has(expense.category) && !kinds.outOfFlow.has(expense.category)
    )
    .reduce((total, expense) => total + safeNumber(expense.amount), 0);
}

export function sumSavingsCategory(
  expenses: Expense[],
  kinds: CategoryKindMap = DEFAULT_CATEGORY_KINDS
): number {
  return expenses
    .filter((expense) => kinds.savings.has(expense.category))
    .reduce((total, expense) => total + safeNumber(expense.amount), 0);
}

/** Planned projects / investments — recorded, but deliberately outside every statistic. */
export function sumOutOfFlow(
  expenses: Expense[],
  kinds: CategoryKindMap = DEFAULT_CATEGORY_KINDS
): number {
  return expenses
    .filter((expense) => kinds.outOfFlow.has(expense.category))
    .reduce((total, expense) => total + safeNumber(expense.amount), 0);
}

export function groupByCategory(expenses: Expense[]): Record<CategoryType, number> {
  const totals = emptyCategoryRecord();
  expenses.forEach((expense) => {
    const key = expense.category.trim().length > 0 ? expense.category : 'אחר';
    totals[key] = (totals[key] ?? 0) + safeNumber(expense.amount);
  });
  return totals;
}

export function calcNetSaved(totalIncome: number, totalExpenses: number): number {
  return safeNumber(totalIncome) - safeNumber(totalExpenses);
}

export function calcSavingsRate(netSaved: number, totalIncome: number): number {
  const income = safeNumber(totalIncome);
  if (income <= 0) return 0;
  const rate = (safeNumber(netSaved) / income) * 100;
  // Overspending → 0% (not absurd negatives like -32000% on tiny income).
  if (!Number.isFinite(rate) || rate < 0) return 0;
  return rate;
}

export function isMonthOutlier(month: MonthData | undefined): boolean {
  return month?.isOutlier === true;
}

export function findMonth(
  months: MonthData[],
  year: number,
  month: number
): MonthData | undefined {
  const target = clampMonth(month);
  return months.find((entry) => entry.year === year && entry.month === target);
}

export function createEmptyMonth(year: number, month: number): MonthData {
  return { year, month: clampMonth(month), income: [], expenses: [] };
}

export function getMonthStats(
  month: MonthData | undefined,
  kinds: CategoryKindMap = DEFAULT_CATEGORY_KINDS
): MonthStats {
  const income = month?.income ?? [];
  const expenses = month?.expenses ?? [];
  const totalIncome = sumIncome(income);
  const totalExpenses = sumExpenses(expenses, kinds);
  const totalSavingsCategory = sumSavingsCategory(expenses, kinds);
  const totalOutOfFlow = sumOutOfFlow(expenses, kinds);
  const netSaved = calcNetSaved(totalIncome, totalExpenses);
  const byCategory = groupByCategory(expenses);

  const outOfFlowByCategory: Record<CategoryType, number> = {};
  expenses.forEach((expense) => {
    if (!kinds.outOfFlow.has(expense.category)) return;
    outOfFlowByCategory[expense.category] =
      (outOfFlowByCategory[expense.category] ?? 0) + safeNumber(expense.amount);
  });

  return {
    year: month?.year ?? 0,
    month: month?.month ?? 1,
    totalIncome,
    totalExpenses,
    totalSavingsCategory,
    totalOutOfFlow,
    netSaved,
    savingsRate: calcSavingsRate(netSaved, totalIncome),
    byCategory,
    outOfFlowByCategory,
    expenseCount: expenses.length,
    activeCategoryCount: Object.keys(byCategory).filter(
      (category) =>
        byCategory[category] > 0 &&
        !kinds.savings.has(category) &&
        !kinds.outOfFlow.has(category)
    ).length,
    hasData: income.length > 0 || expenses.length > 0,
  };
}

/** Category breakdown for the pie chart — spending categories only, largest first. */
export function getCategoryBreakdown(
  expenses: Expense[],
  customCategories: CustomCategory[] = []
): CategoryBreakdownItem[] {
  const kinds = buildCategoryKindMap(customCategories);
  const totals = groupByCategory(expenses);
  const spendingTotal = sumExpenses(expenses, kinds);

  return Object.keys(totals)
    .filter(
      (category) =>
        !kinds.savings.has(category) && !kinds.outOfFlow.has(category) && totals[category] > 0
    )
    .map((category) => {
      const meta = resolveCategoryMeta(category, customCategories);
      return {
        category,
        amount: totals[category],
        percentage: spendingTotal > 0 ? (totals[category] / spendingTotal) * 100 : 0,
        color: meta.color,
        icon: meta.emoji,
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

/**
 * 12-point series for a year — months with no data are zeroed but flagged.
 * When `excludeOutliers` is true, outlier months are zeroed and `hasData` is false
 * so charts and annual aggregates skip them.
 */
export function getMonthlySeries(
  months: MonthData[],
  year: number,
  options: AggregationOptions = {}
): MonthlySeriesPoint[] {
  const excludeOutliers = options.excludeOutliers === true;
  const kinds = options.kinds ?? DEFAULT_CATEGORY_KINDS;

  return Array.from({ length: 12 }, (_, index) => {
    const monthNumber = index + 1;
    const monthData = findMonth(months, year, monthNumber);
    const stats = getMonthStats(monthData, kinds);
    const outlier = isMonthOutlier(monthData);
    const excluded = excludeOutliers && outlier;

    return {
      month: monthNumber,
      label: getShortMonthName(monthNumber),
      income: excluded ? 0 : stats.totalIncome,
      expenses: excluded ? 0 : stats.totalExpenses,
      saved: excluded || !stats.hasData ? 0 : stats.netSaved,
      hasData: excluded ? false : stats.hasData,
      isOutlier: outlier,
    };
  });
}

export function getAnnualStats(
  months: MonthData[],
  year: number,
  options: AggregationOptions = {}
): AnnualStats {
  const series = getMonthlySeries(months, year, options);
  const monthsWithData = series.filter((point) => point.hasData);

  const totalIncome = series.reduce((total, point) => total + point.income, 0);
  const totalExpenses = series.reduce((total, point) => total + point.expenses, 0);
  const totalSaved = calcNetSaved(totalIncome, totalExpenses);

  const excludeOutliers = options.excludeOutliers === true;
  const kinds = options.kinds ?? DEFAULT_CATEGORY_KINDS;
  const byCategory = emptyCategoryRecord();
  const outOfFlowByCategory: Record<CategoryType, number> = {};
  let totalOutOfFlow = 0;
  months
    .filter((month) => month.year === year)
    .filter((month) => !(excludeOutliers && isMonthOutlier(month)))
    .forEach((month) => {
      month.expenses.forEach((expense) => {
        const key = expense.category.trim().length > 0 ? expense.category : 'אחר';
        byCategory[key] = (byCategory[key] ?? 0) + safeNumber(expense.amount);
        if (kinds.outOfFlow.has(expense.category)) {
          outOfFlowByCategory[key] = (outOfFlowByCategory[key] ?? 0) + safeNumber(expense.amount);
          totalOutOfFlow += safeNumber(expense.amount);
        }
      });
    });

  const best = monthsWithData.reduce<{ month: number; saved: number } | null>(
    (acc, point) =>
      acc === null || point.saved > acc.saved ? { month: point.month, saved: point.saved } : acc,
    null
  );
  const worst = monthsWithData.reduce<{ month: number; saved: number } | null>(
    (acc, point) =>
      acc === null || point.saved < acc.saved ? { month: point.month, saved: point.saved } : acc,
    null
  );

  return {
    year,
    totalIncome,
    totalExpenses,
    totalSaved,
    avgMonthlySavings: monthsWithData.length > 0 ? totalSaved / monthsWithData.length : 0,
    bestMonth: best ?? { month: 0, saved: 0 },
    worstMonth: worst ?? { month: 0, saved: 0 },
    byCategory,
    totalOutOfFlow,
    outOfFlowByCategory,
  };
}

/**
 * Project cost meter — one row per out-of-flow category with its yearly and
 * all-time totals. Outlier months are never skipped here: a project's real cost
 * does not change because a month was tagged as unusual.
 */
export function getOutOfFlowProjects(
  months: MonthData[],
  customCategories: CustomCategory[],
  year: number
): OutOfFlowProject[] {
  const kinds = buildCategoryKindMap(customCategories);
  if (kinds.outOfFlow.size === 0) return [];

  const totals = new Map<string, ProjectAccumulator>();

  months.forEach((month) => {
    month.expenses.forEach((expense) => {
      if (!kinds.outOfFlow.has(expense.category)) return;

      const amount = safeNumber(expense.amount);
      const entry = totals.get(expense.category) ?? {
        yearTotal: 0,
        allTimeTotal: 0,
        paymentCount: 0,
      };

      entry.yearTotal += month.year === year ? amount : 0;
      entry.allTimeTotal += amount;
      entry.paymentCount += 1;
      const latest = laterDate(entry.lastPaymentDate, expense.date);
      if (latest !== undefined) {
        entry.lastPaymentDate = latest;
      }

      totals.set(expense.category, entry);
    });
  });

  return Array.from(totals.entries())
    .map(([category, entry]) => {
      const meta = resolveCategoryMeta(category, customCategories);
      return {
        category,
        emoji: meta.emoji,
        color: meta.color,
        yearTotal: entry.yearTotal,
        allTimeTotal: entry.allTimeTotal,
        paymentCount: entry.paymentCount,
        ...(entry.lastPaymentDate !== undefined
          ? { lastPaymentDate: entry.lastPaymentDate }
          : {}),
      };
    })
    .sort((a, b) => b.allTimeTotal - a.allTimeTotal);
}

interface ProjectAccumulator {
  yearTotal: number;
  allTimeTotal: number;
  paymentCount: number;
  lastPaymentDate?: string;
}

/** Latest of two optional ISO dates; undefined when neither is set. */
function laterDate(current: string | undefined, candidate: string | undefined): string | undefined {
  if (candidate === undefined || candidate.length === 0) return current;
  if (current === undefined || current.length === 0) return candidate;
  return candidate.localeCompare(current) > 0 ? candidate : current;
}

/** Sorted descending years that have data, always including the current year. */
export function getAvailableYears(months: MonthData[], fallbackYear: number): number[] {
  const years = new Set<number>([fallbackYear]);
  months.forEach((month) => {
    if (month.income.length > 0 || month.expenses.length > 0) {
      years.add(month.year);
    }
  });
  return Array.from(years).sort((a, b) => b - a);
}

export function sortExpenses(expenses: Expense[]): Expense[] {
  return [...expenses].sort((a, b) => {
    const dateA = a.date ?? '';
    const dateB = b.date ?? '';
    if (dateA !== dateB) {
      // Newest first; rows without a date sink to the bottom.
      if (dateA.length === 0) return 1;
      if (dateB.length === 0) return -1;
      return dateB.localeCompare(dateA);
    }
    return safeNumber(b.amount) - safeNumber(a.amount);
  });
}

export interface CategoryGroup {
  category: CategoryType;
  total: number;
  expenses: Expense[];
}

export function groupExpensesByCategory(expenses: Expense[]): CategoryGroup[] {
  const groups = new Map<CategoryType, Expense[]>();
  expenses.forEach((expense) => {
    const existing = groups.get(expense.category);
    if (existing) {
      existing.push(expense);
    } else {
      groups.set(expense.category, [expense]);
    }
  });

  return Array.from(groups.entries())
    .map(([category, items]) => ({
      category,
      total: items.reduce((total, item) => total + safeNumber(item.amount), 0),
      expenses: sortExpenses(items),
    }))
    .sort((a, b) => b.total - a.total);
}

function safeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}
