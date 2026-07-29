import type { CategoryType, MonthData } from '../types';

export const STORAGE_KEY = 'expense-tracker-v1';

export const CATEGORIES: CategoryType[] = [
  'דיור',
  'מזון',
  'תחבורה',
  'בריאות',
  'בילויים',
  'ביגוד',
  'חינוך',
  'חיסכון',
  'אחר',
];

/** Category excluded from "real" expenses — money moved to savings is not spending. */
export const SAVINGS_CATEGORY: CategoryType = 'חיסכון';

export const CATEGORY_COLORS: Record<CategoryType, string> = {
  'דיור': '#6366f1',
  'מזון': '#10b981',
  'תחבורה': '#f59e0b',
  'בריאות': '#ef4444',
  'בילויים': '#8b5cf6',
  'ביגוד': '#ec4899',
  'חינוך': '#06b6d4',
  'חיסכון': '#84cc16',
  'אחר': '#94a3b8',
};

export const CATEGORY_ICONS: Record<CategoryType, string> = {
  'דיור': '🏠',
  'מזון': '🛒',
  'תחבורה': '🚗',
  'בריאות': '💊',
  'בילויים': '🎬',
  'ביגוד': '👕',
  'חינוך': '📚',
  'חיסכון': '💰',
  'אחר': '📦',
};

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
  pageBg: '#F8FAFC',
  cardBg: '#FFFFFF',
  primary: '#10B981',
  income: '#10B981',
  expense: '#EF4444',
  textPrimary: '#1E293B',
  textSecondary: '#64748B',
  border: '#E2E8F0',
  amber: '#F59E0B',
  ghost: '#E2E8F0',
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
