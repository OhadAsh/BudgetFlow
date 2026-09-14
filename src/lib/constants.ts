import type { BuiltInCategory, CategoryKind, CategoryType, MonthData } from '../types';

export const STORAGE_KEY = 'expense-tracker-v1';

/** Only files created/opened by this app — never full Drive access. */
export const GOOGLE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

/** Fixed backup file name so upload updates the same file instead of duplicating. */
export const DRIVE_BACKUP_FILE_NAME = 'budgetflow-backup.json';

/** Schema version written into Drive backup JSON. */
export const DRIVE_BACKUP_VERSION = 3 as const;

export interface BuiltInCategoryMeta {
  name: BuiltInCategory;
  emoji: string;
  color: string;
  kind: CategoryKind;
}

export const BUILT_IN_CATEGORIES: BuiltInCategoryMeta[] = [
  { name: 'דיור', emoji: '🏠', color: '#6366f1', kind: 'spending' },
  { name: 'מזון', emoji: '🛒', color: '#10b981', kind: 'spending' },
  { name: 'תחבורה', emoji: '🚗', color: '#f59e0b', kind: 'spending' },
  { name: 'בריאות', emoji: '💊', color: '#ef4444', kind: 'spending' },
  { name: 'בילויים', emoji: '🎬', color: '#8b5cf6', kind: 'spending' },
  { name: 'ביגוד', emoji: '👕', color: '#ec4899', kind: 'spending' },
  { name: 'חינוך', emoji: '📚', color: '#06b6d4', kind: 'spending' },
  { name: 'חיסכון', emoji: '💰', color: '#84cc16', kind: 'savings' },
  { name: 'אחר', emoji: '📦', color: '#94a3b8', kind: 'spending' },
];

/** @deprecated Prefer BUILT_IN_CATEGORIES — kept for existing call sites. */
export const CATEGORIES: CategoryType[] = BUILT_IN_CATEGORIES.map((entry) => entry.name);

/** Category excluded from "real" expenses — money moved to savings is not spending. */
export const SAVINGS_CATEGORY: CategoryType = 'חיסכון';

/** Hebrew labels for the category kinds — used in the manager UI and Excel settings sheet. */
export const CATEGORY_KIND_LABELS: Record<CategoryKind, string> = {
  spending: 'רגיל',
  savings: 'חיסכון',
  outOfFlow: 'חוץ-תזרים',
};

export const CATEGORY_KIND_DESCRIPTIONS: Record<CategoryKind, string> = {
  spending: 'נספרת כהוצאה שוטפת בכל הסטטיסטיקות.',
  savings: 'כסף שהועבר לחיסכון — לא נספר כהוצאה.',
  outOfFlow: 'פרויקט או השקעה מתוכננים (חתונה, מקדמה לדירה) — נשמר בתיעוד אבל מוחרג מכל המדדים.',
};

/** One-click out-of-flow categories for the common planned-project cases. */
export const OUT_OF_FLOW_PRESETS: Array<{ name: string; emoji: string; color: string }> = [
  { name: 'חתונה', emoji: '🎁', color: '#ec4899' },
  { name: 'דירה - מקדמה', emoji: '🏠', color: '#6366f1' },
];

export const CATEGORY_COLORS: Record<string, string> = Object.fromEntries(
  BUILT_IN_CATEGORIES.map((entry) => [entry.name, entry.color])
);

export const CATEGORY_ICONS: Record<string, string> = Object.fromEntries(
  BUILT_IN_CATEGORIES.map((entry) => [entry.name, entry.emoji])
);

export const EMOJI_OPTIONS = [
  '🏋️',
  '🐕',
  '🎮',
  '✈️',
  '🏖️',
  '💻',
  '🎵',
  '🍕',
  '☕',
  '🎁',
  '🏥',
  '⚽',
  '📱',
  '🔧',
  '🌿',
  '💈',
  '🎓',
  '🚀',
  '🏊',
  '🍷',
  '🛒',
  '🎸',
  '🐱',
  '🏠',
  '💼',
  '🎨',
  '🚂',
  '🌍',
  '💡',
  '🎭',
  '🏰',
  '🎪',
] as const;

export const COLOR_OPTIONS = [
  '#6366f1',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#84cc16',
] as const;

export const HEBREW_MONTHS = [
  'ינואר',
  'פברואר',
  'מרץ',
  'אפריל',
  'מאי',
  'יוני',
  'יולי',
  'אוגוסט',
  'ספטמבר',
  'אוקטובר',
  'נובמבר',
  'דצמבר',
];

export const SHORT_MONTHS = [
  'ינו',
  'פבר',
  'מרץ',
  'אפר',
  'מאי',
  'יוני',
  'יול',
  'אוג',
  'ספט',
  'אוק',
  'נוב',
  'דצמ',
];

export const SAVINGS_RATE_THRESHOLDS = {
  GOOD: 20,
  OK: 10,
  POOR: 0,
};

export const COLORS = {
  /** Theme-aware via CSS variables — follow data-mantine-color-scheme. */
  pageBg: 'var(--bf-page-bg)',
  cardBg: 'var(--bf-card-bg)',
  mutedBg: 'var(--bf-muted-bg)',
  successBg: 'var(--bf-success-bg)',
  dangerBg: 'var(--bf-danger-bg)',
  tooltipBg: 'var(--bf-tooltip-bg)',
  primary: '#10B981',
  income: '#10B981',
  expense: '#EF4444',
  textPrimary: 'var(--bf-text-primary)',
  textSecondary: 'var(--bf-text-secondary)',
  border: 'var(--bf-border)',
  amber: '#F59E0B',
  ghost: 'var(--bf-ghost)',
} as const;

export const SECTION_TITLE_STYLE = {
  fontSize: '1rem',
  fontWeight: 600,
  color: COLORS.textSecondary,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
};

export const BIG_NUMBER_STYLE = {
  fontSize: 'clamp(1.25rem, 2.4vw, 2rem)',
  fontWeight: 700,
  lineHeight: 1.15,
  whiteSpace: 'nowrap' as const,
  direction: 'ltr' as const,
  unicodeBidi: 'isolate' as const,
};

export const EXCEL_HEADERS = {
  income: 'הכנסות',
  expenses: 'הוצאות',
  category: 'קטגוריה',
  description: 'תיאור',
  amount: 'סכום',
  date: 'תאריך',
  note: 'הערה',
  hash: 'מזהה',
  source: 'מקור',
  cardLast4: '4 ספרות',
  total: 'סה"כ',
} as const;

type SeedMonth = {
  year: number;
  month: number;
  income: Array<{ label: string; amount: number }>;
  expenses: Array<{ category: CategoryType; description: string; amount: number }>;
};

const SEED_MONTHS: SeedMonth[] = [
  {
    year: 2026,
    month: 1,
    income: [
      { label: 'משכורת', amount: 17500 },
      { label: 'עבודה נוספת', amount: 3000 },
    ],
    expenses: [
      { category: 'דיור', description: 'שכירות', amount: 4250 },
      { category: 'מזון', description: 'סופר', amount: 1800 },
      { category: 'תחבורה', description: 'דלק', amount: 600 },
      { category: 'בילויים', description: 'מסעדות', amount: 900 },
      { category: 'דיור', description: 'חשמל וארנונה', amount: 800 },
    ],
  },
  {
    year: 2026,
    month: 2,
    income: [{ label: 'משכורת', amount: 17500 }],
    expenses: [
      { category: 'דיור', description: 'שכירות', amount: 4250 },
      { category: 'מזון', description: 'סופר', amount: 1600 },
      { category: 'בילויים', description: 'בילויים', amount: 1200 },
      { category: 'ביגוד', description: 'בגדים', amount: 500 },
    ],
  },
  {
    year: 2026,
    month: 3,
    income: [
      { label: 'משכורת', amount: 17500 },
      { label: 'בונוס', amount: 5000 },
    ],
    expenses: [
      { category: 'דיור', description: 'שכירות', amount: 4250 },
      { category: 'מזון', description: 'סופר', amount: 2100 },
      { category: 'בריאות', description: 'רופא', amount: 400 },
      { category: 'תחבורה', description: 'נסיעה לחו"ל', amount: 1500 },
    ],
  },
];

/** Builds seed months with fresh ids — called once when the store is empty. */
export function createSeedMonths(): MonthData[] {
  return SEED_MONTHS.map((month) => ({
    year: month.year,
    month: month.month,
    income: month.income.map((source) => ({
      id: crypto.randomUUID(),
      label: source.label,
      amount: source.amount,
    })),
    expenses: month.expenses.map((expense) => ({
      id: crypto.randomUUID(),
      category: expense.category,
      description: expense.description,
      amount: expense.amount,
    })),
  }));
}
