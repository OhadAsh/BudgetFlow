import type { CategoryType } from '../types';
import {
  CATEGORIES,
  CATEGORY_COLORS,
  CATEGORY_ICONS,
  HEBREW_MONTHS,
  SAVINGS_RATE_THRESHOLDS,
  SHORT_MONTHS,
} from './constants';

const numberFormatter = new Intl.NumberFormat('he-IL', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/**
 * ₪12,345 — rounded to whole shekels. The symbol is prefixed manually because
 * Intl currency style for he-IL appends "₪" and injects bidi control marks.
 */
export function formatCurrency(value: number): string {
  const rounded = Math.round(Number.isFinite(value) ? value : 0);
  const sign = rounded < 0 ? '-' : '';
  return `${sign}₪${numberFormatter.format(Math.abs(rounded))}`;
}

/** Signed currency, used for deltas: +₪3,000 / -₪500. */
export function formatSignedCurrency(value: number): string {
  const rounded = Math.round(Number.isFinite(value) ? value : 0);
  const sign = rounded > 0 ? '+' : rounded < 0 ? '-' : '';
  return `${sign}${formatCurrency(Math.abs(rounded))}`;
}

/** Compact axis label: ₪12K / ₪-3K / ₪0. */
export function formatCompactCurrency(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  if (safe === 0) return '₪0';
  const abs = Math.abs(safe);
  const sign = safe < 0 ? '-' : '';
  if (abs >= 1000) {
    const thousands = abs / 1000;
    const text = thousands >= 10 ? Math.round(thousands).toString() : trimZero(thousands.toFixed(1));
    return `${sign}₪${text}K`;
  }
  return `${sign}₪${Math.round(abs)}`;
}

function trimZero(value: string): string {
  return value.endsWith('.0') ? value.slice(0, -2) : value;
}

export function formatNumber(value: number): string {
  return numberFormatter.format(Number.isFinite(value) ? Math.round(value) : 0);
}

export function formatPercent(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `${Math.round(safe)}%`;
}

/** "ינואר 2026" */
export function formatMonthYear(year: number, month: number): string {
  return `${getMonthName(month)} ${year}`;
}

export function getMonthName(month: number): string {
  return HEBREW_MONTHS[clampMonth(month) - 1];
}

export function getShortMonthName(month: number): string {
  return SHORT_MONTHS[clampMonth(month) - 1];
}

export function clampMonth(month: number): number {
  if (!Number.isFinite(month)) return 1;
  return Math.min(12, Math.max(1, Math.round(month)));
}

export function monthKey(year: number, month: number): string {
  return `${year}-${clampMonth(month).toString().padStart(2, '0')}`;
}

/** Previous month, rolling the year over at January. */
export function previousPeriod(year: number, month: number): { year: number; month: number } {
  const safeMonth = clampMonth(month);
  return safeMonth === 1 ? { year: year - 1, month: 12 } : { year, month: safeMonth - 1 };
}

/** Next month, rolling the year over at December. */
export function nextPeriod(year: number, month: number): { year: number; month: number } {
  const safeMonth = clampMonth(month);
  return safeMonth === 12 ? { year: year + 1, month: 1 } : { year, month: safeMonth + 1 };
}

export function isCategoryType(value: unknown): value is CategoryType {
  return typeof value === 'string' && (CATEGORIES as string[]).includes(value);
}

export function getCategoryColor(category: CategoryType): string {
  return CATEGORY_COLORS[category];
}

export function getCategoryIcon(category: CategoryType): string {
  return CATEGORY_ICONS[category];
}

/** Mantine color name for a savings rate, per SAVINGS_RATE_THRESHOLDS. */
export function getSavingsRateColor(rate: number): 'emerald' | 'yellow' | 'red' {
  if (rate >= SAVINGS_RATE_THRESHOLDS.GOOD) return 'emerald';
  if (rate >= SAVINGS_RATE_THRESHOLDS.OK) return 'yellow';
  return 'red';
}

export function getSavingsRateLabel(rate: number): string {
  if (rate >= SAVINGS_RATE_THRESHOLDS.GOOD) return 'שיעור חיסכון מעולה';
  if (rate >= SAVINGS_RATE_THRESHOLDS.OK) return 'שיעור חיסכון סביר';
  if (rate > SAVINGS_RATE_THRESHOLDS.POOR) return 'שיעור חיסכון נמוך';
  return 'אין חיסכון החודש';
}

export function getAmountColor(value: number): string {
  return value >= 0 ? '#10b981' : '#ef4444';
}

/** Parses free text / Excel cell values into a non-negative number. */
export function parseAmount(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.abs(value) : 0;
  }
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^\d.,-]/g, '').replace(/,/g, '');
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? Math.abs(parsed) : 0;
  }
  return 0;
}

export function toSafeString(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return value.toString();
  return '';
}

/** True when the file looks like an Excel workbook by extension (MIME is unreliable on Windows). */
export function isExcelFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith('.xlsx') || name.endsWith('.xls');
}

/** Upper bound for Excel imports via the dropzone (10 MB). */
export const EXCEL_MAX_BYTES = 10 * 1024 * 1024;

/** Native file-picker filter — avoids MIME-only accept checks that break drag-and-drop. */
export const EXCEL_INPUT_ACCEPT = '.xlsx,.xls';

export function currentYear(): number {
  return new Date().getFullYear();
}

export function currentMonth(): number {
  return new Date().getMonth() + 1;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Case-insensitive Hebrew/Latin substring match for search boxes. */
export function matchesSearchQuery(haystack: string, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return true;
  return haystack.toLowerCase().includes(needle);
}

/** True when a card charge is a refund/credit (negative amount). */
export function isCreditAmount(amount: number): boolean {
  return Number.isFinite(amount) && amount < 0;
}
