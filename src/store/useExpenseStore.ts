import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CustomCategory, Expense, IncomeSource, MerchantMemory, MonthData } from '../types';
import { STORAGE_KEY, createSeedMonths } from '../lib/constants';
import { applyMerchantMemoryToMonths, clampMonth, currentMonth, currentYear, normalizeMerchantName } from '../lib/utils';

interface ExpenseState {
  months: MonthData[];
  selectedYear: number;
  selectedMonth: number;
  customCategories: CustomCategory[];
  merchantMemory: MerchantMemory;

  setSelectedPeriod: (year: number, month: number) => void;
  setSelectedYear: (year: number) => void;
  setSelectedMonth: (month: number) => void;

  addExpense: (year: number, month: number, expense: Omit<Expense, 'id'>) => void;
  updateExpense: (year: number, month: number, id: string, patch: Partial<Expense>) => void;
  removeExpense: (year: number, month: number, id: string) => void;

  addIncome: (year: number, month: number, source: Omit<IncomeSource, 'id'>) => void;
  updateIncome: (year: number, month: number, id: string, patch: Partial<IncomeSource>) => void;
  removeIncome: (year: number, month: number, id: string) => void;

  addCustomCategory: (cat: Omit<CustomCategory, 'id'>) => void;
  updateCustomCategory: (id: string, patch: Partial<Omit<CustomCategory, 'id'>>) => void;
  removeCustomCategory: (id: string) => void;

  rememberMerchant: (merchant: string, category: string) => void;
  forgetMerchant: (merchant: string) => void;
  /** Applies merchant-memory categories to every matching expense across all months. */
  applyMerchantMemoryToAllExpenses: () => number;
  /** Removes every month belonging to the given year. */
  deleteYear: (year: number) => void;

  /** Replaces custom categories + merchant memory in one shot (settings import). */
  applyImportedSettings: (
    customCategories: CustomCategory[],
    merchantMemory: MerchantMemory
  ) => void;

  importFromExcel: (months: MonthData[]) => void;
  clearAll: () => void;
}

/** Returns a new months array with `updater` applied to the target month, creating it if needed. */
function withMonth(
  months: MonthData[],
  year: number,
  month: number,
  updater: (target: MonthData) => MonthData
): MonthData[] {
  const safeMonth = clampMonth(month);
  const index = months.findIndex((entry) => entry.year === year && entry.month === safeMonth);

  if (index === -1) {
    const created = updater({ year, month: safeMonth, income: [], expenses: [] });
    return sortMonths([...months, created]);
  }

  const next = [...months];
  next[index] = updater(next[index]);
  return next;
}

function sortMonths(months: MonthData[]): MonthData[] {
  return [...months].sort((a, b) => a.year - b.year || a.month - b.month);
}

function hasEntries(month: MonthData): boolean {
  return month.income.length > 0 || month.expenses.length > 0;
}

/** Drops month shells that no longer hold income or expenses. */
function pruneEmptyMonths(months: MonthData[]): MonthData[] {
  return months.filter(hasEntries);
}

/**
 * If the selected year no longer has data (and is not the calendar year),
 * jump to the latest year that does — or the current calendar year.
 */
function resolveSelectedYear(months: MonthData[], selectedYear: number): number {
  const calendarYear = currentYear();
  if (selectedYear === calendarYear) return selectedYear;
  const stillHasData = months.some((entry) => entry.year === selectedYear && hasEntries(entry));
  if (stillHasData) return selectedYear;

  const withData = months.filter(hasEntries);
  if (withData.length === 0) return calendarYear;
  return withData.reduce((best, entry) => (entry.year > best ? entry.year : best), withData[0].year);
}

/**
 * Opens on the current month, falling back to the most recent month that holds
 * data so a first-time visitor never lands on an empty screen.
 */
function resolveInitialPeriod(months: MonthData[]): { year: number; month: number } {
  const year = currentYear();
  const month = currentMonth();

  const current = months.find((entry) => entry.year === year && entry.month === month);
  if (current && hasEntries(current)) {
    return { year, month };
  }

  const latest = months.filter(hasEntries).reduce<MonthData | null>((acc, entry) => {
    if (acc === null || entry.year > acc.year || (entry.year === acc.year && entry.month > acc.month)) {
      return entry;
    }
    return acc;
  }, null);

  return latest === null ? { year, month } : { year: latest.year, month: latest.month };
}

const initialMonths = createSeedMonths();
const initialPeriod = resolveInitialPeriod(initialMonths);

export const useExpenseStore = create<ExpenseState>()(
  persist(
    (set) => ({
      months: initialMonths,
      selectedYear: initialPeriod.year,
      selectedMonth: initialPeriod.month,
      customCategories: [],
      merchantMemory: {},

      setSelectedPeriod: (year, month) =>
        set({ selectedYear: year, selectedMonth: clampMonth(month) }),

      setSelectedYear: (year) => set({ selectedYear: year }),

      setSelectedMonth: (month) => set({ selectedMonth: clampMonth(month) }),

      addExpense: (year, month, expense) =>
        set((state) => ({
          months: withMonth(state.months, year, month, (target) => ({
            ...target,
            expenses: [...target.expenses, { ...expense, id: crypto.randomUUID() }],
          })),
        })),

      updateExpense: (year, month, id, patch) =>
        set((state) => ({
          months: withMonth(state.months, year, month, (target) => ({
            ...target,
            expenses: target.expenses.map((expense) =>
              expense.id === id ? { ...expense, ...patch, id: expense.id } : expense
            ),
          })),
        })),

      removeExpense: (year, month, id) =>
        set((state) => {
          const months = pruneEmptyMonths(
            withMonth(state.months, year, month, (target) => ({
              ...target,
              expenses: target.expenses.filter((expense) => expense.id !== id),
            }))
          );
          return {
            months,
            selectedYear: resolveSelectedYear(months, state.selectedYear),
          };
        }),

      addIncome: (year, month, source) =>
        set((state) => ({
          months: withMonth(state.months, year, month, (target) => ({
            ...target,
            income: [...target.income, { ...source, id: crypto.randomUUID() }],
          })),
        })),

      updateIncome: (year, month, id, patch) =>
        set((state) => ({
          months: withMonth(state.months, year, month, (target) => ({
            ...target,
            income: target.income.map((source) =>
              source.id === id ? { ...source, ...patch, id: source.id } : source
            ),
          })),
        })),

      removeIncome: (year, month, id) =>
        set((state) => {
          const months = pruneEmptyMonths(
            withMonth(state.months, year, month, (target) => ({
              ...target,
              income: target.income.filter((source) => source.id !== id),
            }))
          );
          return {
            months,
            selectedYear: resolveSelectedYear(months, state.selectedYear),
          };
        }),

      addCustomCategory: (cat) =>
        set((state) => ({
          customCategories: [
            ...state.customCategories,
            { ...cat, id: crypto.randomUUID(), name: cat.name.trim() },
          ],
        })),

      updateCustomCategory: (id, patch) =>
        set((state) => {
          const current = state.customCategories.find((entry) => entry.id === id);
          if (!current) return state;

          const nextName =
            patch.name !== undefined ? patch.name.trim() : current.name;
          const renamed = nextName !== current.name && nextName.length > 0;

          const customCategories = state.customCategories.map((entry) =>
            entry.id === id
              ? {
                  ...entry,
                  ...patch,
                  id: entry.id,
                  name: nextName,
                }
              : entry
          );

          if (!renamed) {
            return { customCategories };
          }

          // Keep expense rows and merchant memory pointing at the new label.
          const months = state.months.map((month) => ({
            ...month,
            expenses: month.expenses.map((expense) =>
              expense.category === current.name
                ? { ...expense, category: nextName }
                : expense
            ),
          }));

          const merchantMemory: MerchantMemory = {};
          Object.entries(state.merchantMemory).forEach(([merchant, category]) => {
            merchantMemory[merchant] = category === current.name ? nextName : category;
          });

          return { customCategories, months, merchantMemory };
        }),

      removeCustomCategory: (id) =>
        set((state) => ({
          customCategories: state.customCategories.filter((entry) => entry.id !== id),
        })),

      rememberMerchant: (merchant, category) => {
        const key = normalizeMerchantName(merchant);
        const trimmedCategory = category.trim();
        if (key.length === 0 || trimmedCategory.length === 0) return;
        set((state) => ({
          merchantMemory: { ...state.merchantMemory, [key]: trimmedCategory },
        }));
      },

      forgetMerchant: (merchant) => {
        const key = normalizeMerchantName(merchant);
        set((state) => {
          const next = { ...state.merchantMemory };
          delete next[key];
          return { merchantMemory: next };
        });
      },

      applyMerchantMemoryToAllExpenses: () => {
        let updatedCount = 0;
        set((state) => {
          const result = applyMerchantMemoryToMonths(state.months, state.merchantMemory);
          updatedCount = result.updatedCount;
          return result.updatedCount > 0 ? { months: result.months } : state;
        });
        return updatedCount;
      },

      deleteYear: (year) =>
        set((state) => {
          const months = state.months.filter((entry) => entry.year !== year);
          return {
            months,
            selectedYear: resolveSelectedYear(months, state.selectedYear),
          };
        }),

      applyImportedSettings: (customCategories, merchantMemory) =>
        set({ customCategories, merchantMemory }),

      importFromExcel: (imported) =>
        set((state) => {
          const merged = state.months.filter(
            (existing) =>
              !imported.some(
                (month) => month.year === existing.year && month.month === existing.month
              )
          );
          return { months: sortMonths([...merged, ...imported]) };
        }),

      clearAll: () =>
        set({
          months: [],
          selectedYear: currentYear(),
          selectedMonth: currentMonth(),
          customCategories: [],
          merchantMemory: {},
        }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 3,
      migrate: (persisted) => {
        const state = (persisted ?? {}) as Record<string, unknown>;
        const rawMonths = Array.isArray(state.months) ? (state.months as MonthData[]) : [];
        const months = pruneEmptyMonths(rawMonths);
        const selectedYear =
          typeof state.selectedYear === 'number'
            ? resolveSelectedYear(months, state.selectedYear)
            : currentYear();
        return {
          ...state,
          months,
          selectedYear,
          customCategories: Array.isArray(state.customCategories) ? state.customCategories : [],
          merchantMemory:
            state.merchantMemory !== null &&
            typeof state.merchantMemory === 'object' &&
            !Array.isArray(state.merchantMemory)
              ? state.merchantMemory
              : {},
        };
      },
      partialize: (state) => ({
        months: state.months,
        selectedYear: state.selectedYear,
        selectedMonth: state.selectedMonth,
        customCategories: state.customCategories,
        merchantMemory: state.merchantMemory,
      }),
    }
  )
);
