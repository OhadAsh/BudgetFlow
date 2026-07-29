import * as XLSX from 'xlsx';
import type {
  BankExpenseTransaction,
  BankImportResult,
  BankIncomeImportResult,
  BankIncomeTransaction,
  BankTransaction,
  CategoryType,
  CustomCategory,
  ExcelParseResult,
  Expense,
  ImportPreviewRow,
  IncomeSource,
  MerchantMemory,
  MonthData,
  SettingsImportCategory,
  SettingsImportMerchant,
  SettingsParseResult,
} from '../types';
import { COLOR_OPTIONS, EMOJI_OPTIONS, EXCEL_HEADERS, HEBREW_MONTHS } from './constants';
import {
  formatMonthYear,
  isCategoryType,
  parseAmount,
  toSafeString,
} from './utils';
import { sumExpenses, sumIncome } from './calculations';

type Cell = string | number | boolean | null | undefined;
type SheetRow = Cell[];

const SHEET_NAME_LIMIT = 31;

export const SETTINGS_SHEET_NAMES = {
  categories: 'קטגוריות מותאמות',
  merchants: 'זיכרון עסקים',
} as const;

export const SETTINGS_HEADERS = {
  name: 'שם',
  emoji: "אימוג'י",
  color: 'צבע',
  merchant: 'שם עסק',
  category: 'קטגוריה',
} as const;

export const SETTINGS_EXPORT_FILE_NAME = 'הגדרות-מעקב-הוצאות.xlsx';

/**
 * Builds a workbook with one sheet per month, each holding an income section
 * followed by an expense section.
 */
export function exportToWorkbook(months: MonthData[]): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  const ordered = [...months].sort((a, b) => a.year - b.year || a.month - b.month);

  if (ordered.length === 0) {
    const empty = XLSX.utils.aoa_to_sheet([[EXCEL_HEADERS.income], [], [EXCEL_HEADERS.expenses]]);
    XLSX.utils.book_append_sheet(workbook, empty, 'ללא נתונים');
    return workbook;
  }

  ordered.forEach((month) => {
    const rows: SheetRow[] = [];
    const headerRow: SheetRow = [
      EXCEL_HEADERS.category,
      EXCEL_HEADERS.description,
      EXCEL_HEADERS.amount,
      EXCEL_HEADERS.date,
    ];

    rows.push([EXCEL_HEADERS.income]);
    rows.push(headerRow);
    month.income.forEach((source) => {
      rows.push(['', source.label, source.amount, '']);
    });
    rows.push([EXCEL_HEADERS.total, '', sumIncome(month.income), '']);
    rows.push([]);

    rows.push([EXCEL_HEADERS.expenses]);
    rows.push(headerRow);
    month.expenses.forEach((expense) => {
      rows.push([expense.category, expense.description, expense.amount, expense.date ?? '']);
    });
    rows.push([EXCEL_HEADERS.total, '', sumExpenses(month.expenses), '']);

    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 12 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(workbook, sheet, buildSheetName(month.year, month.month));
  });

  return workbook;
}

/** Appends custom-category and merchant-memory sheets to an existing workbook. */
export function appendSettingsSheets(
  workbook: XLSX.WorkBook,
  customCategories: CustomCategory[],
  merchantMemory: MerchantMemory
): void {
  const categoriesSheet = XLSX.utils.aoa_to_sheet(buildCategoriesSheetRows(customCategories));
  categoriesSheet['!cols'] = [{ wch: 18 }, { wch: 10 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(workbook, categoriesSheet, SETTINGS_SHEET_NAMES.categories);

  const merchantsSheet = XLSX.utils.aoa_to_sheet(buildMerchantsSheetRows(merchantMemory));
  merchantsSheet['!cols'] = [{ wch: 28 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(workbook, merchantsSheet, SETTINGS_SHEET_NAMES.merchants);
}

/**
 * Full backup before nuclear delete: monthly financial sheets plus settings sheets.
 * When there is no month data, still writes the two settings sheets alone.
 */
export function exportBackupWorkbook(
  months: MonthData[],
  customCategories: CustomCategory[],
  merchantMemory: MerchantMemory
): XLSX.WorkBook {
  const workbook =
    months.length > 0 ? exportToWorkbook(months) : XLSX.utils.book_new();
  appendSettingsSheets(workbook, customCategories, merchantMemory);
  return workbook;
}

/** Settings-only workbook (categories + merchant memory) for device transfer. */
export function exportSettingsToWorkbook(
  customCategories: CustomCategory[],
  merchantMemory: MerchantMemory
): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  appendSettingsSheets(workbook, customCategories, merchantMemory);
  return workbook;
}

function buildCategoriesSheetRows(customCategories: CustomCategory[]): SheetRow[] {
  const rows: SheetRow[] = [[SETTINGS_HEADERS.name, SETTINGS_HEADERS.emoji, SETTINGS_HEADERS.color]];
  customCategories.forEach((entry) => {
    rows.push([entry.name, entry.emoji, entry.color]);
  });
  return rows;
}

function buildMerchantsSheetRows(merchantMemory: MerchantMemory): SheetRow[] {
  const rows: SheetRow[] = [[SETTINGS_HEADERS.merchant, SETTINGS_HEADERS.category]];
  Object.entries(merchantMemory)
    .sort(([a], [b]) => a.localeCompare(b, 'he'))
    .forEach(([merchant, category]) => {
      rows.push([merchant, category]);
    });
  return rows;
}

/** Reads a settings Excel file (custom categories + merchant memory sheets). */
export async function parseSettingsFile(file: File): Promise<SettingsParseResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });

  const categories: SettingsImportCategory[] = [];
  const merchants: SettingsImportMerchant[] = [];

  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return;

    const rows = XLSX.utils.sheet_to_json<SheetRow>(sheet, {
      header: 1,
      blankrows: false,
      defval: '',
    });

    const normalizedName = normalizeSpaces(sheetName);
    if (normalizedName === SETTINGS_SHEET_NAMES.categories) {
      categories.push(...parseCategoriesSheetRows(rows));
      return;
    }
    if (normalizedName === SETTINGS_SHEET_NAMES.merchants) {
      merchants.push(...parseMerchantsSheetRows(rows));
    }
  });

  if (categories.length === 0 && merchants.length === 0) {
    throw new Error(
      `לא נמצאו גיליונות הגדרות בקובץ. ודא שיש גיליון "${SETTINGS_SHEET_NAMES.categories}" או "${SETTINGS_SHEET_NAMES.merchants}".`
    );
  }

  return { categories, merchants };
}

function parseCategoriesSheetRows(rows: SheetRow[]): SettingsImportCategory[] {
  const result: SettingsImportCategory[] = [];
  const defaultEmoji = EMOJI_OPTIONS[0];
  const defaultColor = COLOR_OPTIONS[0];

  rows.forEach((row, index) => {
    const name = toSafeString(row[0]).trim();
    const emoji = toSafeString(row[1]).trim();
    const color = toSafeString(row[2]).trim();

    if (index === 0 && name === SETTINGS_HEADERS.name) {
      return;
    }
    if (name.length === 0) {
      return;
    }

    result.push({
      name,
      emoji: emoji.length > 0 ? emoji : defaultEmoji,
      color: color.length > 0 ? color : defaultColor,
    });
  });

  return result;
}

function parseMerchantsSheetRows(rows: SheetRow[]): SettingsImportMerchant[] {
  const result: SettingsImportMerchant[] = [];

  rows.forEach((row, index) => {
    const merchant = toSafeString(row[0]).trim();
    const category = toSafeString(row[1]).trim();

    if (index === 0 && merchant === SETTINGS_HEADERS.merchant) {
      return;
    }
    if (merchant.length === 0 || category.length === 0) {
      return;
    }

    result.push({ merchant, category });
  });

  return result;
}

export function downloadWorkbook(workbook: XLSX.WorkBook, fileName: string): void {
  XLSX.writeFile(workbook, fileName);
}

export function buildSheetName(year: number, month: number): string {
  return formatMonthYear(year, month).slice(0, SHEET_NAME_LIMIT);
}

export function buildExportFileName(): string {
  const now = new Date();
  const stamp = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now
    .getDate()
    .toString()
    .padStart(2, '0')}`;
  return `מעקב-הוצאות-${stamp}.xlsx`;
}

/** Extracts year + month from a sheet name such as "ינואר 2026". */
export function parseSheetName(sheetName: string): { year: number; month: number } | null {
  const normalized = sheetName.trim();
  const yearMatch = normalized.match(/(19|20)\d{2}/);
  if (!yearMatch) return null;

  const year = Number.parseInt(yearMatch[0], 10);
  const monthIndex = HEBREW_MONTHS.findIndex((name) => normalized.includes(name));
  if (monthIndex === -1) {
    const numericMatch = normalized.match(/(?:^|[^\d])(0?[1-9]|1[0-2])(?:[^\d]|$)/);
    if (!numericMatch) return null;
    return { year, month: Number.parseInt(numericMatch[1], 10) };
  }
  return { year, month: monthIndex + 1 };
}

/** Reads a workbook file into month data plus a preview summary for confirmation. */
export async function parseExcelFile(
  file: File,
  existingMonths: MonthData[]
): Promise<ExcelParseResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });

  const months: MonthData[] = [];
  const skippedSheets: string[] = [];

  workbook.SheetNames.forEach((sheetName) => {
    const normalizedName = normalizeSpaces(sheetName);
    if (
      normalizedName === SETTINGS_SHEET_NAMES.categories ||
      normalizedName === SETTINGS_SHEET_NAMES.merchants
    ) {
      return;
    }

    const period = parseSheetName(sheetName);
    const sheet = workbook.Sheets[sheetName];
    if (!period || !sheet) {
      skippedSheets.push(sheetName);
      return;
    }

    const rows = XLSX.utils.sheet_to_json<SheetRow>(sheet, {
      header: 1,
      blankrows: false,
      defval: '',
    });

    const parsed = parseSheetRows(rows, period.year, period.month);
    if (parsed.income.length === 0 && parsed.expenses.length === 0) {
      skippedSheets.push(sheetName);
      return;
    }
    months.push(parsed);
  });

  if (months.length === 0) {
    throw new Error('לא נמצאו גיליונות תקינים בקובץ. ודא ששם הגיליון בפורמט "ינואר 2026".');
  }

  const preview: ImportPreviewRow[] = months.map((month) => ({
    year: month.year,
    month: month.month,
    incomeCount: month.income.length,
    expenseCount: month.expenses.length,
    totalIncome: sumIncome(month.income),
    totalExpenses: sumExpenses(month.expenses),
    isReplacing: existingMonths.some(
      (existing) => existing.year === month.year && existing.month === month.month
    ),
  }));

  return { months, preview, skippedSheets };
}

type Section = 'none' | 'income' | 'expenses';

function parseSheetRows(rows: SheetRow[], year: number, month: number): MonthData {
  const income: IncomeSource[] = [];
  const expenses: Expense[] = [];
  let section: Section = 'none';

  rows.forEach((row) => {
    const first = toSafeString(row[0]);
    const second = toSafeString(row[1]);
    const third = row[2];
    const fourth = toSafeString(row[3]);

    if (isSectionHeader(first, EXCEL_HEADERS.income) || isSectionHeader(second, EXCEL_HEADERS.income)) {
      section = 'income';
      return;
    }
    if (
      isSectionHeader(first, EXCEL_HEADERS.expenses) ||
      isSectionHeader(second, EXCEL_HEADERS.expenses)
    ) {
      section = 'expenses';
      return;
    }
    if (isColumnHeaderRow(first, second) || isTotalRow(first)) {
      return;
    }

    const amount = parseAmount(third);
    if (amount <= 0) return;

    if (section === 'income') {
      income.push({
        id: crypto.randomUUID(),
        label: second || first || 'הכנסה',
        amount,
      });
      return;
    }

    if (section === 'expenses') {
      expenses.push(buildExpense(first, second, amount, fourth));
    }
  });

  return { year, month, income, expenses };
}

function buildExpense(
  rawCategory: string,
  description: string,
  amount: number,
  date: string
): Expense {
  const category: CategoryType = isCategoryType(rawCategory) ? rawCategory : 'אחר';
  const expense: Expense = {
    id: crypto.randomUUID(),
    category,
    description: description || rawCategory || 'הוצאה',
    amount,
  };
  if (date) {
    expense.date = date;
  }
  return expense;
}

function isSectionHeader(value: string, keyword: string): boolean {
  return value === keyword || value === `${keyword}:`;
}

function isColumnHeaderRow(first: string, second: string): boolean {
  return (
    (first === EXCEL_HEADERS.category && second === EXCEL_HEADERS.description) ||
    first === EXCEL_HEADERS.description ||
    second === EXCEL_HEADERS.amount
  );
}

function isTotalRow(value: string): boolean {
  return value.startsWith(EXCEL_HEADERS.total) || value.startsWith('סה"כ') || value.startsWith('סהכ');
}

/* ------------------------------------------------------------------ *
 * Cal (כאל) credit card statements
 * ------------------------------------------------------------------ */

/** ענף column mapped to app categories — checked before merchant name keywords. */
const BRANCH_TO_CATEGORY: Record<string, CategoryType> = {
  'מזון ומשקאות': 'מזון',
  'מזון מהיר': 'מזון',
  'מסעדות': 'בילויים',
  'ריהוט ובית': 'דיור',
  'תקשורת ומחשבים': 'אחר',
  'רפואה ובריאות': 'בריאות',
  'פנאי בילוי': 'בילויים',
  'רכב ותחבורה': 'תחבורה',
  'ביטוח ופיננסים': 'אחר',
  'מוסדות': 'אחר',
  'אנרגיה': 'דיור',
  'תיירות': 'בילויים',
  'שונות': 'אחר',
};

/**
 * Fallback when ענף is missing or unmapped. The longest matching keyword wins so
 * that "סופר פארם" resolves to בריאות rather than matching "סופר" for מזון.
 * Keywords shorter than three characters are avoided — substring matching on them
 * misfires on unrelated merchant names.
 */
const MERCHANT_KEYWORDS: Array<{ keywords: string[]; category: CategoryType }> = [
  {
    category: 'מזון',
    keywords: ['שופרסל', 'רמי לוי', 'ויקטורי', 'יינות ביתן', 'טיב טעם', 'אושר עד', 'יש חסד', 'סופר', 'מכולת', 'קצביה', 'ירקות'],
  },
  {
    category: 'תחבורה',
    keywords: ['פז ', 'סונול', 'דלק', 'דור אלון', 'רב קו', 'רכבת ישראל', 'אגד', 'פנגו', 'סלופארק', 'yellow', 'חניון', 'טקסי', 'uber', 'גט '],
  },
  {
    category: 'בריאות',
    keywords: ['סופר פארם', 'בית מרקחת', 'מכבי', 'כללית', 'מאוחדת', 'לאומית', 'רופא', 'מרפאה', 'אופטיק', 'שיניים'],
  },
  {
    category: 'בילויים',
    keywords: ['מסעדה', 'מסעדת', 'קפה', 'ארומה', 'לנדוור', 'מקדונלד', 'בורגר', 'פיצה', 'סושי', 'סינמה', 'יס פלאנט', 'תיאטרון', 'הופעה', 'נטפליקס', 'netflix', 'spotify'],
  },
  {
    category: 'ביגוד',
    keywords: ['zara', 'קסטרו', 'רנואר', 'fox', 'h&m', 'אמריקן', 'נעלי', 'אופנה', 'terminal x'],
  },
  {
    category: 'דיור',
    keywords: [
      'שכר דירה',
      'שכירות',
      'שכ"ד',
      'שכ ד',
      'חשמל',
      'תאגיד המים',
      'ארנונה',
      'ועד בית',
      'איקאה',
      'ikea',
      'הום סנטר',
      'אייס',
      'רהיטים',
    ],
  },
  {
    category: 'חינוך',
    keywords: ['ספרים', 'סטימצקי', 'צומת ספרים', 'גן ילדים', 'בית ספר', 'אוניברסיט', 'מכללה', 'קורס', 'חוג '],
  },
];

const CAL_HEADERS = {
  date: 'תאריך עסקה',
  merchant: 'שם בית עסק',
  transactionAmount: 'סכום עסקה',
  chargeAmount: 'סכום חיוב',
  transactionType: 'סוג עסקה',
  branch: 'ענף',
  notes: 'הערות',
} as const;

const CAL_DISCLAIMER_PREFIX = 'את המידע המלא';
const CAL_CHARGE_LINE = 'לחיוב';
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
const MS_PER_DAY = 86400000;

interface CalColumns {
  date: number;
  merchant: number;
  transactionAmount: number;
  chargeAmount: number;
  branch: number;
  notes: number;
}

/** Cal writes column titles with double spaces, so every comparison is space-normalized. */
function normalizeSpaces(value: unknown): string {
  return toSafeString(value).replace(/\s+/g, ' ').trim();
}

/** True when a sheet carries the Cal transaction table header. */
export function isCalSheet(rows: SheetRow[]): boolean {
  return findCalHeaderRow(rows) !== -1;
}

function findCalHeaderRow(rows: SheetRow[]): number {
  return rows.findIndex((row) =>
    row.some((cell) => {
      const value = normalizeSpaces(cell);
      return value === CAL_HEADERS.date || value === CAL_HEADERS.merchant;
    })
  );
}

function mapCalColumns(headerRow: SheetRow): CalColumns | null {
  const indexOf = (title: string): number =>
    headerRow.findIndex((cell) => normalizeSpaces(cell) === title);

  const columns: CalColumns = {
    date: indexOf(CAL_HEADERS.date),
    merchant: indexOf(CAL_HEADERS.merchant),
    transactionAmount: indexOf(CAL_HEADERS.transactionAmount),
    chargeAmount: indexOf(CAL_HEADERS.chargeAmount),
    branch: indexOf(CAL_HEADERS.branch),
    notes: indexOf(CAL_HEADERS.notes),
  };

  if (columns.merchant === -1 || columns.chargeAmount === -1) {
    return null;
  }
  return columns;
}

/** Excel stores Cal dates as serial numbers counted from 1899-12-30. */
export function excelSerialToISO(serial: number): string {
  if (!Number.isFinite(serial) || serial <= 0) return '';
  const date = new Date(EXCEL_EPOCH_MS + serial * MS_PER_DAY);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

/** Accepts the serial numbers Cal exports, and dd/MM/yyyy text as a fallback. */
export function parseCalDate(value: unknown): string {
  if (typeof value === 'number') {
    return excelSerialToISO(value);
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const text = toSafeString(value);
  const match = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (match) {
    const day = Number.parseInt(match[1], 10);
    const month = Number.parseInt(match[2], 10);
    const rawYear = Number.parseInt(match[3], 10);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    const date = new Date(Date.UTC(year, month - 1, day));
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString().slice(0, 10);
    }
  }

  const serial = Number.parseFloat(text);
  return Number.isFinite(serial) ? excelSerialToISO(serial) : '';
}

/** dd/MM/yyyy label for display; falls back to the raw cell text. */
function formatDateLabel(iso: string, raw: unknown): string {
  if (!iso) return toSafeString(raw);
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

/**
 * Empty or non-numeric "סכום חיוב" means the charge is still being processed.
 * The sign is preserved so a refund stays a credit rather than becoming a charge.
 * Also handles accounting negatives: (1,234.56) and 1,234.56-
 */
function parseChargeCell(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  const text = toSafeString(value);
  if (text.length === 0) return null;

  const parenMatch = text.match(/^\((.*)\)$/);
  const isParenNegative = parenMatch !== null;
  const body = parenMatch ? parenMatch[1] : text;
  const isTrailingMinus = !isParenNegative && /-$/.test(body);
  const cleaned = body.replace(/[^\d.,-]/g, '').replace(/,/g, '').replace(/-/g, '');
  if (cleaned.length === 0) return null;
  const parsed = Number.parseFloat(cleaned);
  if (!Number.isFinite(parsed)) return null;
  if (isParenNegative || isTrailingMinus) {
    return -Math.abs(parsed);
  }
  // Preserve a leading minus that survived earlier cleaning
  if (/^\s*-/.test(text)) {
    return -Math.abs(parsed);
  }
  return parsed;
}

/** "תשלום 2 מתוך 12" when the row belongs to an installment plan. */
export function extractInstallment(notes: string): string | null {
  const match = normalizeSpaces(notes).match(/תשלום\s*(\d+)\s*מתוך\s*(\d+)/);
  return match ? `תשלום ${match[1]} מתוך ${match[2]}` : null;
}

export function categoryFromBranch(branch: string): CategoryType | null {
  const normalized = normalizeSpaces(branch);
  return normalized.length > 0 ? (BRANCH_TO_CATEGORY[normalized] ?? null) : null;
}

export function categoryFromMerchant(merchant: string): CategoryType | null {
  // Pad so keywords written with a trailing space (e.g. "פז ") also match at the end.
  const normalized = ` ${normalizeSpaces(merchant).toLowerCase()} `;
  if (normalized.trim().length === 0) return null;

  let best: { category: CategoryType; length: number } | null = null;
  for (const entry of MERCHANT_KEYWORDS) {
    for (const keyword of entry.keywords) {
      const needle = keyword.toLowerCase();
      if (normalized.includes(needle) && (best === null || needle.trim().length > best.length)) {
        best = { category: entry.category, length: needle.trim().length };
      }
    }
  }

  return best?.category ?? null;
}

/** ענף first, merchant keywords second, אחר last. */
export function resolveCalCategory(branch: string, merchant: string): CategoryType {
  return categoryFromBranch(branch) ?? categoryFromMerchant(merchant) ?? 'אחר';
}

/** Stable fingerprint of a card transaction; base64 of date|merchant|charge. */
export function buildTransactionHash(
  isoDate: string,
  merchant: string,
  chargeAmount: number
): string {
  const raw = `${isoDate}|${merchant.trim()}|${chargeAmount}`;
  // encodeURIComponent + unescape keeps btoa from choking on Hebrew characters.
  return btoa(unescape(encodeURIComponent(raw)));
}

/** Charge month from the "עסקאות לחיוב ב-..." header line. */
export function parseCalChargePeriod(text: string): { year: number; month: number } | null {
  const normalized = normalizeSpaces(text);

  const fullDate = normalized.match(/(\d{1,2})[./-](\d{1,2})[./-]((?:19|20)\d{2})/);
  if (fullDate) {
    const month = Number.parseInt(fullDate[2], 10);
    const year = Number.parseInt(fullDate[3], 10);
    if (month >= 1 && month <= 12) {
      return { year, month };
    }
  }

  const monthYear = normalized.match(/(\d{1,2})[./-]((?:19|20)\d{2})/);
  if (monthYear) {
    const month = Number.parseInt(monthYear[1], 10);
    const year = Number.parseInt(monthYear[2], 10);
    if (month >= 1 && month <= 12) {
      return { year, month };
    }
  }

  const yearMatch = normalized.match(/(19|20)\d{2}/);
  const monthIndex = HEBREW_MONTHS.findIndex((name) => normalized.includes(name));
  if (yearMatch && monthIndex !== -1) {
    return { year: Number.parseInt(yearMatch[0], 10), month: monthIndex + 1 };
  }

  return null;
}

function findChargePeriod(rows: SheetRow[], headerIndex: number): { year: number; month: number } | null {
  for (let index = 0; index < headerIndex; index += 1) {
    const line = rows[index].map((cell) => toSafeString(cell)).join(' ');
    if (line.includes(CAL_CHARGE_LINE)) {
      const period = parseCalChargePeriod(line);
      if (period) {
        return period;
      }
    }
  }
  return null;
}

function isCalDisclaimerRow(row: SheetRow): boolean {
  return row.some((cell) => normalizeSpaces(cell).startsWith(CAL_DISCLAIMER_PREFIX));
}

function isBlankRow(row: SheetRow): boolean {
  return row.every((cell) => toSafeString(cell).length === 0);
}

/** Reads the transaction table out of a Cal sheet. */
export function parseCalRows(rows: SheetRow[]): BankTransaction[] {
  const headerIndex = findCalHeaderRow(rows);
  if (headerIndex === -1) return [];

  const columns = mapCalColumns(rows[headerIndex]);
  if (!columns) return [];

  const transactions: BankTransaction[] = [];

  rows.slice(headerIndex + 1).forEach((row) => {
    if (isBlankRow(row) || isCalDisclaimerRow(row)) return;

    const merchant = toSafeString(row[columns.merchant]);
    const rawDate = columns.date === -1 ? '' : row[columns.date];
    const isoDate = parseCalDate(rawDate);
    if (merchant.length === 0 && isoDate.length === 0) return;

    const charge = parseChargeCell(row[columns.chargeAmount]);
    const chargeAmount = charge ?? 0;
    const branch = columns.branch === -1 ? '' : toSafeString(row[columns.branch]);
    const notes = columns.notes === -1 ? '' : toSafeString(row[columns.notes]);
    const installment = extractInstallment(notes);

    const transaction: BankTransaction = {
      id: crypto.randomUUID(),
      date: isoDate,
      dateLabel: formatDateLabel(isoDate, rawDate),
      merchant: merchant.length > 0 ? merchant : 'עסקה ללא שם',
      transactionAmount:
        columns.transactionAmount === -1 ? chargeAmount : parseAmount(row[columns.transactionAmount]),
      chargeAmount,
      branch,
      notes,
      category: resolveCalCategory(branch, merchant),
      isPending: charge === null,
      hash: buildTransactionHash(isoDate, merchant, chargeAmount),
    };
    if (installment) {
      transaction.installment = installment;
    }

    transactions.push(transaction);
  });

  return transactions;
}

/** Parses a Cal statement file, detecting the format from its column headers. */
export async function parseCalFile(file: File): Promise<BankImportResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const rows = XLSX.utils.sheet_to_json<SheetRow>(sheet, {
      header: 1,
      blankrows: false,
      defval: '',
    });
    if (!isCalSheet(rows)) continue;

    const transactions = parseCalRows(rows);
    if (transactions.length === 0) {
      throw new Error('זוהה קובץ כאל אך לא נמצאו בו עסקאות.');
    }

    return {
      source: 'cal',
      sheetName,
      fileCount: 1,
      chargePeriod: findChargePeriod(rows, findCalHeaderRow(rows)),
      transactions,
    };
  }

  throw new Error('הקובץ אינו דוח עסקאות של כאל. ודא שהקובץ הורד מאתר כאל ללא שינויים.');
}

/* ------------------------------------------------------------------ *
 * Max (מקס) credit card statements
 * ------------------------------------------------------------------ */

const MAX_HEADERS = {
  date: 'תאריך עסקה',
  merchant: 'שם בית העסק',
  category: 'קטגוריה',
  chargeAmount: 'סכום חיוב',
  chargeCurrency: 'מטבע חיוב',
  transactionType: 'סוג עסקה',
  notes: 'הערות',
} as const;

const MAX_TOTAL_PREFIX = 'סך הכל';
const MAX_INSTALLMENTS_TYPE = 'תשלומים';

/** Max's own category names mapped to app categories. */
const MAX_CATEGORY_MAP: Record<string, CategoryType> = {
  'מסעדות, קפה וברים': 'בילויים',
  'קוסמטיקה וטיפוח': 'ביגוד',
  'סופרמרקט': 'מזון',
  'קניות באינטרנט': 'אחר',
  'ביגוד והנעלה': 'ביגוד',
  'בריאות ורפואה': 'בריאות',
  'דלק ותחנות שירות': 'תחבורה',
  'תחבורה ציבורית': 'תחבורה',
  'חינוך': 'חינוך',
  'בילויים ופנאי': 'בילויים',
  'ביטוח': 'אחר',
  'תקשורת': 'אחר',
  'שירותים': 'אחר',
};

interface MaxColumns {
  date: number;
  merchant: number;
  category: number;
  chargeAmount: number;
  transactionType: number;
  notes: number;
}

function findMaxHeaderRow(rows: SheetRow[]): number {
  return rows.findIndex((row) => {
    const cells = row.map((cell) => normalizeSpaces(cell));
    return (
      cells.includes(MAX_HEADERS.merchant) &&
      cells.includes(MAX_HEADERS.chargeAmount) &&
      cells.includes(MAX_HEADERS.chargeCurrency)
    );
  });
}

/** True when a sheet carries the Max transaction table header. */
export function isMaxSheet(rows: SheetRow[]): boolean {
  return findMaxHeaderRow(rows) !== -1;
}

function mapMaxColumns(headerRow: SheetRow): MaxColumns | null {
  const indexOf = (title: string): number =>
    headerRow.findIndex((cell) => normalizeSpaces(cell) === title);

  const columns: MaxColumns = {
    date: indexOf(MAX_HEADERS.date),
    merchant: indexOf(MAX_HEADERS.merchant),
    category: indexOf(MAX_HEADERS.category),
    chargeAmount: indexOf(MAX_HEADERS.chargeAmount),
    transactionType: indexOf(MAX_HEADERS.transactionType),
    notes: indexOf(MAX_HEADERS.notes),
  };

  if (columns.merchant === -1 || columns.chargeAmount === -1) {
    return null;
  }
  return columns;
}

/** Max writes dates as DD-MM-YYYY text; anything else falls back to the Cal parser. */
export function parseMaxDate(value: unknown): string {
  const text = toSafeString(value);
  const match = text.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return parseCalDate(value);
}

export function resolveMaxCategory(rawCategory: string): CategoryType {
  const normalized = normalizeSpaces(rawCategory);
  return MAX_CATEGORY_MAP[normalized] ?? 'אחר';
}

/** Statement month from the "06/2026" line above the column headers. */
function findMaxChargePeriod(rows: SheetRow[], headerIndex: number): { year: number; month: number } | null {
  for (let index = 0; index < headerIndex; index += 1) {
    for (const cell of rows[index]) {
      const match = normalizeSpaces(cell).match(/^(0?[1-9]|1[0-2])\/((?:19|20)\d{2})$/);
      if (match) {
        return { year: Number.parseInt(match[2], 10), month: Number.parseInt(match[1], 10) };
      }
    }
  }
  return null;
}

function isMaxTotalRow(row: SheetRow): boolean {
  return row.some((cell) => normalizeSpaces(cell).startsWith(MAX_TOTAL_PREFIX));
}

/** Reads the transaction table out of a Max sheet. */
export function parseMaxRows(rows: SheetRow[]): BankTransaction[] {
  const headerIndex = findMaxHeaderRow(rows);
  if (headerIndex === -1) return [];

  const columns = mapMaxColumns(rows[headerIndex]);
  if (!columns) return [];

  const transactions: BankTransaction[] = [];

  rows.slice(headerIndex + 1).forEach((row) => {
    if (isBlankRow(row) || isMaxTotalRow(row)) return;

    const merchant = toSafeString(row[columns.merchant]);
    const rawDate = columns.date === -1 ? '' : row[columns.date];
    const isoDate = parseMaxDate(rawDate);
    if (merchant.length === 0 && isoDate.length === 0) return;

    // Max may render the amount as "₪ 123.45" text — parseChargeCell strips the symbol.
    const charge = parseChargeCell(row[columns.chargeAmount]);
    const chargeAmount = charge ?? 0;
    const rawCategory = columns.category === -1 ? '' : toSafeString(row[columns.category]);
    const transactionType =
      columns.transactionType === -1 ? '' : toSafeString(row[columns.transactionType]);
    const notes = columns.notes === -1 ? '' : toSafeString(row[columns.notes]);
    const installment =
      extractInstallment(notes) ??
      (transactionType === MAX_INSTALLMENTS_TYPE ? MAX_INSTALLMENTS_TYPE : null);

    const transaction: BankTransaction = {
      id: crypto.randomUUID(),
      date: isoDate,
      dateLabel: formatDateLabel(isoDate, rawDate),
      merchant: merchant.length > 0 ? merchant : 'עסקה ללא שם',
      transactionAmount: chargeAmount,
      chargeAmount,
      branch: rawCategory,
      notes,
      category: resolveMaxCategory(rawCategory),
      isPending: charge === null,
      hash: buildTransactionHash(isoDate, merchant, chargeAmount),
    };
    if (installment) {
      transaction.installment = installment;
    }

    transactions.push(transaction);
  });

  return transactions;
}

/** Message prefix the import modal uses to show the "unknown format" badge. */
export const UNKNOWN_FORMAT_ERROR = 'פורמט לא מוכר';

/** Parses a credit card statement (Cal or Max), detecting the format per sheet. */
export async function parseCardFile(file: File): Promise<BankImportResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const rows = XLSX.utils.sheet_to_json<SheetRow>(sheet, {
      header: 1,
      blankrows: false,
      defval: '',
    });

    // Max shares the "תאריך עסקה" title with Cal, so its stricter check runs first.
    if (isMaxSheet(rows)) {
      const transactions = parseMaxRows(rows);
      if (transactions.length === 0) {
        throw new Error('זוהה קובץ מקס אך לא נמצאו בו עסקאות.');
      }
      return {
        source: 'max',
        sheetName,
        fileCount: 1,
        chargePeriod: findMaxChargePeriod(rows, findMaxHeaderRow(rows)),
        transactions,
      };
    }

    if (isCalSheet(rows)) {
      const transactions = parseCalRows(rows);
      if (transactions.length === 0) {
        throw new Error('זוהה קובץ כאל אך לא נמצאו בו עסקאות.');
      }
      return {
        source: 'cal',
        sheetName,
        fileCount: 1,
        chargePeriod: findChargePeriod(rows, findCalHeaderRow(rows)),
        transactions,
      };
    }
  }

  throw new Error(
    `${UNKNOWN_FORMAT_ERROR}: הקובץ אינו דוח עסקאות של כאל או מקס. ודא שהקובץ הורד מאתר החברה ללא שינויים.`
  );
}

/* ------------------------------------------------------------------ *
 * Bank Discount (דיסקונט) account statements — income + expenses
 * ------------------------------------------------------------------ */

const DISCOUNT_SHEET_NAME = 'עובר ושב';

const DISCOUNT_HEADERS = {
  date: 'תאריך',
  description: 'תיאור התנועה',
  amount: '₪ זכות/חובה',
} as const;

/**
 * Investment / securities activity — never income and never an imported
 * bank expense (portfolio moves are not household spending).
 */
const BANK_SECURITIES_KEYWORDS = [
  'ני"ע',
  'ניירות ערך',
  'נייר ערך',
  'פק"מ',
  'פקדון',
  'קופת גמל',
  'קרן השתלמות',
  'קרן נאמנות',
  'כספית',
  'ניוד',
  'תעודת סל',
  'תעודות סל',
  'אלטשולר',
  'מיטב',
  'פסגות',
  'אקסלנס',
  'אי.בי.אי',
  'ibi',
  'ברוקר',
  'מסחר בני',
  'רכישת ני',
  'מכירת ני',
];

/** Bank fees — not useful as day-to-day income/expense rows. */
const BANK_FEE_KEYWORDS = ['עמלת', 'עמלה', 'דמי ניהול', 'ריבית חובה', 'ריבית זכות'];

/**
 * Debit rows that settle a credit-card statement — already imported via
 * "ייבוא עסקאות", so they must not land again as a lump-sum bank expense.
 */
const BANK_CARD_SETTLEMENT_KEYWORDS = [
  'כאל',
  'מקס',
  'max',
  'ישראכרט',
  'isracard',
  'ויזה',
  'visa',
  'מסטרקארד',
  'mastercard',
  'לאומי קארד',
  'חיוב כרטיס',
  'כרטיס אשראי',
  'פירעון כרטיס',
];

/** Labels that get the "בדוק ידנית" badge in the preview. */
const AMBIGUOUS_INCOME_LABELS = ['הפקדת שיק', 'העברה נכנסת'];

/** Standing-order / housing keywords for bank debit categorization. */
const BANK_HOUSING_KEYWORDS = [
  'שכר דירה',
  'שכירות',
  'שכ"ד',
  'שכ ד',
  'ארנונה',
  'ועד בית',
  'תאגיד המים',
  'חשמל',
  'גז ',
];

/** Cash withdrawal / ATM — import as expense (category אחר). */
const BANK_CASH_KEYWORDS = [
  'משיכת מזומן',
  'משיכת מזמון',
  'כספומט',
  'atm',
  'משיכה ממכשיר',
  'משיכת נל"ן',
];

interface DiscountColumns {
  date: number;
  description: number;
  amount: number;
}

function findDiscountHeaderRow(rows: SheetRow[]): number {
  return rows.findIndex((row) => {
    const cells = row.map((cell) => normalizeSpaces(cell));
    return cells.includes(DISCOUNT_HEADERS.description) && cells.includes(DISCOUNT_HEADERS.amount);
  });
}

/** True for a Discount current-account sheet, by name or by column headers. */
export function isDiscountSheet(sheetName: string, rows: SheetRow[]): boolean {
  return normalizeSpaces(sheetName) === DISCOUNT_SHEET_NAME || findDiscountHeaderRow(rows) !== -1;
}

function mapDiscountColumns(headerRow: SheetRow): DiscountColumns | null {
  const indexOf = (title: string): number =>
    headerRow.findIndex((cell) => normalizeSpaces(cell) === title);

  const columns: DiscountColumns = {
    date: indexOf(DISCOUNT_HEADERS.date),
    description: indexOf(DISCOUNT_HEADERS.description),
    amount: indexOf(DISCOUNT_HEADERS.amount),
  };

  if (columns.description === -1 || columns.amount === -1) {
    return null;
  }
  return columns;
}

function matchesAnyKeyword(description: string, keywords: string[]): boolean {
  const normalized = normalizeSpaces(description).toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

/**
 * True when a credit row must not be imported as income: fees, securities,
 * and internal transfers between the user's own accounts.
 */
export function shouldExcludeBankRow(description: string): boolean {
  const normalized = normalizeSpaces(description);
  if (matchesAnyKeyword(normalized, BANK_SECURITIES_KEYWORDS)) return true;
  if (matchesAnyKeyword(normalized, BANK_FEE_KEYWORDS)) return true;
  return normalized.includes('העברה') && normalized.includes('חשבון');
}

/**
 * True when a debit must not become a household expense:
 * credit-card settlements (tracked separately) and securities / investments.
 * Standing orders, outgoing checks, and ATM cash withdrawals are kept.
 */
export function shouldExcludeBankExpense(description: string): boolean {
  if (matchesAnyKeyword(description, BANK_CARD_SETTLEMENT_KEYWORDS)) return true;
  if (matchesAnyKeyword(description, BANK_SECURITIES_KEYWORDS)) return true;
  if (matchesAnyKeyword(description, BANK_FEE_KEYWORDS)) return true;
  const normalized = normalizeSpaces(description);
  return normalized.includes('העברה') && normalized.includes('חשבון');
}

/** Maps a bank debit description to an expense category. */
export function mapBankExpenseCategory(description: string): CategoryType {
  const normalized = normalizeSpaces(description);
  const lower = normalized.toLowerCase();

  if (BANK_HOUSING_KEYWORDS.some((keyword) => lower.includes(keyword.toLowerCase().trim()))) {
    return 'דיור';
  }

  // Outgoing checks and ATM cash — real spending without a merchant category.
  if (
    lower.includes('שיק') ||
    lower.includes('שיקים') ||
    BANK_CASH_KEYWORDS.some((keyword) => lower.includes(keyword.toLowerCase()))
  ) {
    return 'אחר';
  }

  let best: { category: CategoryType; length: number } | null = null;
  for (const entry of MERCHANT_KEYWORDS) {
    for (const keyword of entry.keywords) {
      if (lower.includes(keyword.toLowerCase()) && keyword.length >= (best?.length ?? 0)) {
        best = { category: entry.category, length: keyword.length };
      }
    }
  }
  return best?.category ?? 'אחר';
}

/** Short display label for a bank debit. */
export function mapBankExpenseDescription(description: string): string {
  const normalized = normalizeSpaces(description);
  return normalized.length > 0 ? normalized : 'הוצאה בנקאית';
}

/** Maps a bank movement description to an IncomeSource label. */
export function mapIncomeLabel(description: string): string {
  const normalized = normalizeSpaces(description);
  if (normalized.includes('משכורת') || normalized.toUpperCase().includes('HSBC')) {
    return 'משכורת';
  }
  if (normalized.includes('בטוח לאומי') || normalized.includes('ביטוח לאומי')) {
    return 'ביטוח לאומי';
  }
  if (normalized.includes('העברה מ')) {
    return 'העברה נכנסת';
  }
  if (normalized.includes('הפקדת שיק')) {
    return 'הפקדת שיק';
  }
  return normalized;
}

/**
 * Discount Excel dates arrive as serial numbers (preferred) or as M/D/YY text
 * when SheetJS stringifies them. Ambiguous numeric pairs (both ≤ 12) use M/D
 * because that is the format Discount's export produces.
 */
export function parseDiscountDate(value: unknown): string {
  if (typeof value === 'number' || value instanceof Date) {
    return parseCalDate(value);
  }

  const text = toSafeString(value);
  const match = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (!match) {
    return parseCalDate(value);
  }

  const first = Number.parseInt(match[1], 10);
  const second = Number.parseInt(match[2], 10);
  const rawYear = Number.parseInt(match[3], 10);
  const year = rawYear < 100 ? 2000 + rawYear : rawYear;

  let month: number;
  let day: number;
  if (first > 12 && second <= 12) {
    day = first;
    month = second;
  } else {
    // M/D (Discount / US Excel) — also covers unambiguous second > 12.
    month = first;
    day = second;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return '';
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toISOString().slice(0, 10);
}

/** Year + month from an ISO date; null when the string is missing or invalid. */
export function periodFromIsoDate(iso: string): { year: number; month: number } | null {
  const match = iso.match(/^(\d{4})-(\d{2})-\d{2}/);
  if (!match) return null;

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  if (!Number.isFinite(year) || month < 1 || month > 12) {
    return null;
  }
  return { year, month };
}

/** Reads credit (זכות) rows that pass the income filters. */
export function parseDiscountIncomeRows(rows: SheetRow[]): BankIncomeTransaction[] {
  const headerIndex = findDiscountHeaderRow(rows);
  if (headerIndex === -1) return [];

  const columns = mapDiscountColumns(rows[headerIndex]);
  if (!columns) return [];

  const incomes: BankIncomeTransaction[] = [];

  rows.slice(headerIndex + 1).forEach((row) => {
    if (isBlankRow(row) || isTotalRow(toSafeString(row[0]))) return;

    const description = toSafeString(row[columns.description]);
    if (description.length === 0 || shouldExcludeBankRow(description)) return;

    // The sign matters here: only credits (positive) are income.
    const amount = parseChargeCell(row[columns.amount]);
    if (amount === null || amount <= 0) return;

    const rawDate = columns.date === -1 ? '' : row[columns.date];
    const isoDate = parseDiscountDate(rawDate);
    const label = mapIncomeLabel(description);

    incomes.push({
      id: crypto.randomUUID(),
      date: isoDate,
      dateLabel: formatDateLabel(isoDate, rawDate),
      description,
      amount,
      label,
      needsReview: AMBIGUOUS_INCOME_LABELS.includes(label),
    });
  });

  return incomes;
}

/** @deprecated Alias — prefer parseDiscountIncomeRows. */
export function parseDiscountRows(rows: SheetRow[]): BankIncomeTransaction[] {
  return parseDiscountIncomeRows(rows);
}

/** Reads debit (חובה) rows — rent standing orders, utilities, transfers out. */
export function parseDiscountExpenseRows(rows: SheetRow[]): BankExpenseTransaction[] {
  const headerIndex = findDiscountHeaderRow(rows);
  if (headerIndex === -1) return [];

  const columns = mapDiscountColumns(rows[headerIndex]);
  if (!columns) return [];

  const expenses: BankExpenseTransaction[] = [];

  rows.slice(headerIndex + 1).forEach((row) => {
    if (isBlankRow(row) || isTotalRow(toSafeString(row[0]))) return;

    const description = toSafeString(row[columns.description]);
    if (description.length === 0 || shouldExcludeBankExpense(description)) return;

    const signed = parseChargeCell(row[columns.amount]);
    // Debits are negative on Discount statements.
    if (signed === null || signed >= 0) return;

    const amount = Math.abs(signed);
    const rawDate = columns.date === -1 ? '' : row[columns.date];
    const isoDate = parseDiscountDate(rawDate);
    const cleanedDescription = mapBankExpenseDescription(description);

    expenses.push({
      id: crypto.randomUUID(),
      date: isoDate,
      dateLabel: formatDateLabel(isoDate, rawDate),
      description: cleanedDescription,
      amount,
      category: mapBankExpenseCategory(description),
      hash: buildTransactionHash(isoDate, cleanedDescription, amount),
    });
  });

  return expenses;
}

/** Parses a Bank Discount statement file into income + expense rows for preview. */
export async function parseBankIncomeFile(file: File): Promise<BankIncomeImportResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const rows = XLSX.utils.sheet_to_json<SheetRow>(sheet, {
      header: 1,
      blankrows: false,
      defval: '',
    });
    if (!isDiscountSheet(sheetName, rows)) continue;

    const incomes = parseDiscountIncomeRows(rows);
    const expenses = parseDiscountExpenseRows(rows);
    if (incomes.length === 0 && expenses.length === 0) {
      throw new Error('זוהה דוח עובר ושב אך לא נמצאו בו תנועות לייבוא.');
    }

    return { source: 'discount', sheetName, fileCount: 1, incomes, expenses };
  }

  throw new Error(
    `${UNKNOWN_FORMAT_ERROR}: הקובץ אינו דוח עובר ושב של בנק דיסקונט. ודא שהקובץ הורד מאתר הבנק ללא שינויים.`
  );
}

/** Merges several card-statement parses into one preview, dropping duplicate hashes. */
export function mergeCardImportResults(results: BankImportResult[]): BankImportResult {
  if (results.length === 0) {
    throw new Error('לא נמצאו קבצים תקינים לייבוא.');
  }
  if (results.length === 1) {
    return results[0];
  }

  const seenHashes = new Set<string>();
  const transactions: BankTransaction[] = [];
  results.forEach((result) => {
    result.transactions.forEach((transaction) => {
      if (seenHashes.has(transaction.hash)) return;
      seenHashes.add(transaction.hash);
      transactions.push(transaction);
    });
  });

  const uniqueSources = Array.from(new Set(results.map((result) => result.source)));
  const chargePeriod =
    results.find((result) => result.chargePeriod !== null)?.chargePeriod ?? null;

  const merged: BankImportResult = {
    source: uniqueSources[0],
    sheetName: `${results.length} קבצים`,
    fileCount: results.length,
    chargePeriod,
    transactions,
  };
  if (uniqueSources.length > 1) {
    merged.sources = uniqueSources;
  }
  return merged;
}

/** Fingerprint for deduping income rows across statement files. */
function buildIncomeFingerprint(income: BankIncomeTransaction): string {
  return `${income.date}|${income.description}|${income.amount}`;
}

/** Merges several Discount statement parses into one preview, dropping exact duplicates. */
export function mergeBankIncomeResults(
  results: BankIncomeImportResult[]
): BankIncomeImportResult {
  if (results.length === 0) {
    throw new Error('לא נמצאו קבצים תקינים לייבוא.');
  }
  if (results.length === 1) {
    return {
      ...results[0],
      expenses: results[0].expenses ?? [],
    };
  }

  const seenIncomes = new Set<string>();
  const incomes: BankIncomeTransaction[] = [];
  const seenExpenseHashes = new Set<string>();
  const expenses: BankExpenseTransaction[] = [];

  results.forEach((result) => {
    result.incomes.forEach((income) => {
      const key = buildIncomeFingerprint(income);
      if (seenIncomes.has(key)) return;
      seenIncomes.add(key);
      incomes.push(income);
    });
    (result.expenses ?? []).forEach((expense) => {
      if (seenExpenseHashes.has(expense.hash)) return;
      seenExpenseHashes.add(expense.hash);
      expenses.push(expense);
    });
  });

  return {
    source: 'discount',
    sheetName: `${results.length} קבצים`,
    fileCount: results.length,
    incomes,
    expenses,
  };
}

/** Hashes of expenses already stored, so a re-imported statement can be flagged. */
export function collectImportedHashes(months: MonthData[]): Set<string> {
  const hashes = new Set<string>();
  months.forEach((month) => {
    month.expenses.forEach((expense) => {
      if (expense.hash) {
        hashes.add(expense.hash);
      } else if (expense.date) {
        hashes.add(buildTransactionHash(expense.date, expense.description, expense.amount));
      }
    });
  });
  return hashes;
}
