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

/** Statement formats the importer can recognise. */
export type BankSource = 'cal' | 'max' | 'discount';

/** Credit-card statement formats (expense flow). */
export type CardSource = Extract<BankSource, 'cal' | 'max'>;

export interface Expense {
  id: string;
  category: CategoryType;
  description: string;
  amount: number;
  /** ISO date (YYYY-MM-DD) of the transaction / charge — not the import time. */
  date?: string;
  /** Free note, e.g. the installment marker "תשלום 2 מתוך 12" from a card statement. */
  note?: string;
  /**
   * Deterministic external fingerprint of an imported card/bank transaction.
   * Survives Excel export/import; used for duplicate detection (not the internal UUID).
   */
  hash?: string;
  /** Card/bank issuer when the row was imported from a statement. */
  source?: BankSource | null;
  /** Last 4 digits of the card when present on the statement — never a full number. */
  cardLast4?: string | null;
}

/** Optional monthly spending target (₪) keyed by category name. Absent = no target. */
export type CategoryTargets = Record<string, number>;

export interface IncomeSource {
  id: string;
  label: string;
  amount: number;
  /** ISO date when imported from a bank statement (used for dedup). */
  date?: string;
  /** Fingerprint of an imported bank credit, used to detect re-imports. */
  hash?: string;
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

/** Full app snapshot stored as JSON on Google Drive. */
export interface DriveBackupPayload {
  version: number;
  exportedAt: string;
  months: MonthData[];
  selectedYear: number;
  selectedMonth: number;
  customCategories: CustomCategory[];
  merchantMemory: MerchantMemory;
  categoryTargets: CategoryTargets;
}

export interface ImportPreviewRow {
  year: number;
  month: number;
  incomeCount: number;
  expenseCount: number;
  /** Number of expense rows with a negative amount (card refunds / credits). */
  creditCount: number;
  totalIncome: number;
  totalExpenses: number;
  isReplacing: boolean;
}

export interface ExcelParseResult {
  months: MonthData[];
  preview: ImportPreviewRow[];
  skippedSheets: string[];
  /** Present when the workbook also carries settings sheets. */
  settings: SettingsParseResult | null;
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

/** One optional monthly target from a settings Excel sheet. */
export interface SettingsImportTarget {
  category: string;
  /** Monthly target in ₪; null clears / means no target. */
  monthlyTarget: number | null;
}

export interface SettingsParseResult {
  categories: SettingsImportCategory[];
  merchants: SettingsImportMerchant[];
  targets: SettingsImportTarget[];
}

export type SettingsImportMode = 'merge' | 'replace';

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
  /** Statement charge month — used for installment bucketing instead of the purchase date. */
  chargePeriod?: { year: number; month: number };
  category: CategoryType;
  /** True when "סכום חיוב" is empty — the charge has not happened yet. */
  isPending: boolean;
  hash: string;
  /** Issuer for this row (copied from the statement). */
  source?: CardSource;
  /** Last 4 digits when found in the statement header. */
  cardLast4?: string;
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
  /** Last 4 digits from the statement header, when present. */
  cardLast4?: string;
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
