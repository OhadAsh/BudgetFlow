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
} from '../types';
import { CATEGORIES, SAVINGS_CATEGORY } from './constants';
import { clampMonth, getShortMonthName, resolveCategoryMeta } from './utils';

export function emptyCategoryRecord(): Record<CategoryType, number> {
  return CATEGORIES.reduce<Record<CategoryType, number>>((acc, category) => {
    acc[category] = 0;
    return acc;
  }, {} as Record<CategoryType, number>);
}

export function sumIncome(income: IncomeSource[]): number {
  return income.reduce((total, source) => total + safeNumber(source.amount), 0);
}

/** Total of all expense rows, including the savings category. */
export function sumAllExpenses(expenses: Expense[]): number {
  return expenses.reduce((total, expense) => total + safeNumber(expense.amount), 0);
}

/** Spending only — money routed to the savings category is not an expense. */
export function sumExpenses(expenses: Expense[]): number {
  return expenses
    .filter((expense) => expense.category !== SAVINGS_CATEGORY)
    .reduce((total, expense) => total + safeNumber(expense.amount), 0);
}

export function sumSavingsCategory(expenses: Expense[]): number {
  return expenses
    .filter((expense) => expense.category === SAVINGS_CATEGORY)
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
  return (safeNumber(netSaved) / income) * 100;
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

export function getMonthStats(month: MonthData | undefined): MonthStats {
  const income = month?.income ?? [];
  const expenses = month?.expenses ?? [];
  const totalIncome = sumIncome(income);
  const totalExpenses = sumExpenses(expenses);
  const totalSavingsCategory = sumSavingsCategory(expenses);
  const netSaved = calcNetSaved(totalIncome, totalExpenses);
  const byCategory = groupByCategory(expenses);

  return {
    year: month?.year ?? 0,
    month: month?.month ?? 1,
    totalIncome,
    totalExpenses,
    totalSavingsCategory,
    netSaved,
    savingsRate: calcSavingsRate(netSaved, totalIncome),
    byCategory,
    expenseCount: expenses.length,
    activeCategoryCount: Object.keys(byCategory).filter((category) => byCategory[category] > 0)
      .length,
    hasData: income.length > 0 || expenses.length > 0,
  };
}

/** Category breakdown for the pie chart — spending categories only, largest first. */
export function getCategoryBreakdown(
  expenses: Expense[],
  customCategories: CustomCategory[] = []
): CategoryBreakdownItem[] {
  const totals = groupByCategory(expenses);
  const spendingTotal = sumExpenses(expenses);

  return Object.keys(totals)
    .filter((category) => category !== SAVINGS_CATEGORY && totals[category] > 0)
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

/** 12-point series for a year — months with no data are zeroed but flagged. */
export function getMonthlySeries(months: MonthData[], year: number): MonthlySeriesPoint[] {
  return Array.from({ length: 12 }, (_, index) => {
    const monthNumber = index + 1;
    const stats = getMonthStats(findMonth(months, year, monthNumber));
    return {
      month: monthNumber,
      label: getShortMonthName(monthNumber),
      income: stats.totalIncome,
      expenses: stats.totalExpenses,
      saved: stats.hasData ? stats.netSaved : 0,
      hasData: stats.hasData,
    };
  });
}

export function getAnnualStats(months: MonthData[], year: number): AnnualStats {
  const series = getMonthlySeries(months, year);
  const monthsWithData = series.filter((point) => point.hasData);

  const totalIncome = series.reduce((total, point) => total + point.income, 0);
  const totalExpenses = series.reduce((total, point) => total + point.expenses, 0);
  const totalSaved = calcNetSaved(totalIncome, totalExpenses);

  const byCategory = emptyCategoryRecord();
  months
    .filter((month) => month.year === year)
    .forEach((month) => {
      month.expenses.forEach((expense) => {
        const key = expense.category.trim().length > 0 ? expense.category : 'אחר';
        byCategory[key] = (byCategory[key] ?? 0) + safeNumber(expense.amount);
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
  };
}

/** Sorted descending years that have data, always including the current year. */
export function getAvailableYears(months: MonthData[], fallbackYear: number): number[] {
  const years = new Set<number>([fallbackYear]);
  months.forEach((month) => years.add(month.year));
  return Array.from(years).sort((a, b) => b - a);
}

export function sortExpenses(expenses: Expense[]): Expense[] {
  return [...expenses].sort((a, b) => safeNumber(b.amount) - safeNumber(a.amount));
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
