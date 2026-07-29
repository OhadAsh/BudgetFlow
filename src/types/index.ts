export type BuiltInCategory =
  | 'דיור'
  | 'מזון'
  | 'תחבורה'
  | 'בריאות'
  | 'בילויים'
  | 'ביגוד'
  | 'חינוך'
  | 'חיסכון'
  | 'אחר';

/** Runtime category — built-in or a user-defined custom name. */
export type CategoryType = string;

export interface CustomCategory {
  id: string;
  name: string;
  emoji: string;
  color: string;
}

/** merchantName (normalized) → categoryName */
export interface MerchantMemory {
  [merchantName: string]: string;
}

export interface Expense {
  id: string;
  category: CategoryType;
  description: string;
  amount: number;
  date?: string;
  /** Free note, e.g. the installment marker "תשלום 2 מתוך 12" from a card statement. */
  note?: string;
  /** Fingerprint of an imported card transaction, used to detect re-imports. */
  hash?: string;
}

export interface IncomeSource {
  id: string;
  label: string;
  amount: number;
}

export interface MonthData {
  year: number;
  month: number; // 1-12
  income: IncomeSource[];
  expenses: Expense[];
}

export interface MonthStats {
  year: number;
  month: number;
  totalIncome: number;
  totalExpenses: number;
  totalSavingsCategory: number;
  netSaved: number;
  savingsRate: number;
  byCategory: Record<CategoryType, number>;
  expenseCount: number;
  activeCategoryCount: number;
  hasData: boolean;
}

export interface AnnualStats {
  year: number;
  totalIncome: number;
  totalExpenses: number;
  totalSaved: number;
  avgMonthlySavings: number;
  bestMonth: { month: number; saved: number };
  worstMonth: { month: number; saved: number };
  byCategory: Record<CategoryType, number>;
}

export interface CategoryBreakdownItem {
  category: CategoryType;
  amount: number;
  percentage: number;
  color: string;
  icon: string;
}

export interface MonthlySeriesPoint {
  month: number;
  label: string;
  income: number;
  expenses: number;
  saved: number;
  hasData: boolean;
}

export type ViewTab = 'overview' | 'expenses' | 'annual';

export interface ImportPreviewRow {
  year: number;
  month: number;
  incomeCount: number;
  expenseCount: number;
  totalIncome: number;
  totalExpenses: number;
  isReplacing: boolean;
}

export interface ExcelParseResult {
  months: MonthData[];
  preview: ImportPreviewRow[];
  skippedSheets: string[];
}

/** One custom category row from a settings Excel sheet (no id yet). */
export interface SettingsImportCategory {
  name: string;
  emoji: string;
  color: string;
}

/** One merchant-memory row from a settings Excel sheet. */
export interface SettingsImportMerchant {
  merchant: string;
  category: string;
}

export interface SettingsParseResult {
  categories: SettingsImportCategory[];
  merchants: SettingsImportMerchant[];
}

export type SettingsImportMode = 'merge' | 'replace';

/** Statement formats the importer can recognise. */
export type BankSource = 'cal' | 'max' | 'discount';

/** Credit-card statement formats (expense flow). */
export type CardSource = Extract<BankSource, 'cal' | 'max'>;

export interface BankTransaction {
  id: string;
  /** ISO date (YYYY-MM-DD), empty when the source date could not be read. */
  date: string;
  dateLabel: string;
  merchant: string;
  /** Original transaction amount — kept for display only. */
  transactionAmount: number;
  /** Amount actually charged; 0 for transactions still being processed. */
  chargeAmount: number;
  branch: string;
  notes: string;
  /** "תשלום X מתוך Y" when the row is one installment of a plan. */
  installment?: string;
  category: CategoryType;
  /** True when "סכום חיוב" is empty — the charge has not happened yet. */
  isPending: boolean;
  hash: string;
}

export interface BankImportResult {
  source: CardSource;
  /** When several card files were merged and they are not all the same brand. */
  sources?: CardSource[];
  sheetName: string;
  /** Number of Excel files that contributed to this result (1 when single-file). */
  fileCount: number;
  /** Charge month taken from the statement header, when present. */
  chargePeriod: { year: number; month: number } | null;
  transactions: BankTransaction[];
}

/** A single credit (זכות) row read from a bank account statement. */
export interface BankIncomeTransaction {
  id: string;
  /** ISO date (YYYY-MM-DD), empty when the source date could not be read. */
  date: string;
  dateLabel: string;
  description: string;
  amount: number;
  /** Income source label the description was mapped to. */
  label: string;
  /** True for ambiguous rows (e.g. הפקדת שיק) that need a manual check. */
  needsReview: boolean;
}

/** A single debit (חובה) row — standing orders, rent, utilities, etc. */
export interface BankExpenseTransaction {
  id: string;
  /** ISO date (YYYY-MM-DD), empty when the source date could not be read. */
  date: string;
  dateLabel: string;
  description: string;
  /** Positive expense amount (absolute value of the debit). */
  amount: number;
  category: CategoryType;
  hash: string;
}

export interface BankIncomeImportResult {
  source: 'discount';
  sheetName: string;
  /** Number of Excel files that contributed to this result (1 when single-file). */
  fileCount: number;
  incomes: BankIncomeTransaction[];
  expenses: BankExpenseTransaction[];
}
