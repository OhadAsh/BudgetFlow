# CURSOR PROMPT — Monthly Expense & Savings Tracker (Hebrew UI, Light Theme, GitHub Pages)

---

## INSTRUCTION TO CURSOR

You are an expert React developer. Build a complete, production-ready, client-side monthly expense and savings tracker. Do NOT ask questions. Implement everything end-to-end. When the spec leaves something ambiguous, make the best consumer fintech decision and proceed.

---

## PRODUCT OVERVIEW

A single-page Hebrew-language personal finance tracker where the user:
- Logs monthly income and expenses by category
- Sees how much they actually saved each month
- Understands which category is eating their budget (breakdown chart)
- Views annual analytics with a year dropdown (2024, 2025, 2026...)
- Imports/exports data via Excel (.xlsx)
- All data persisted in localStorage — zero backend

**Design reference:** Risup / modern Israeli consumer finance app.
Light, clean, friendly. NOT dark/fintech. Think white cards, soft shadows, 
bold accent colors, rounded corners, mobile-first feel.

---

## TECHNICAL STACK

- **Framework:** React 18 + Vite
- **Language:** TypeScript strict
- **UI:** Mantine v7 (`@mantine/core`, `@mantine/hooks`, `@mantine/notifications`, `@mantine/dropzone`)
- **Charts:** Recharts
- **State:** Zustand + `persist` middleware → localStorage
- **Icons:** Tabler Icons (`@tabler/icons-react`)
- **Excel:** SheetJS (`xlsx`)
- **Deployment:** GitHub Pages (`base: './'` in vite.config.ts)

---

## THEME (`src/theme.ts`)

Light theme — clean, modern, Risup-inspired:

```typescript
import { createTheme, MantineColorsTuple } from '@mantine/core';

const emerald: MantineColorsTuple = [
  '#ecfdf5','#d1fae5','#a7f3d0','#6ee7b7',
  '#34d399','#10b981','#059669','#047857','#065f46','#064e3b'
];

export const theme = createTheme({
  primaryColor: 'emerald',
  colors: { emerald },
  defaultRadius: 'lg',           // rounder than default — Risup feel
  fontFamily: 'Heebo, Inter, sans-serif',
  defaultColorScheme: 'light',   // LIGHT theme
  components: {
    Card: {
      defaultProps: {
        shadow: 'sm',
        radius: 'lg',
        withBorder: false,       // no borders — shadow only
      }
    },
    Button: { defaultProps: { radius: 'xl' } },  // pill buttons
  },
});
```

### Color palette:
- Page background: `#F8FAFC` (very light gray-blue)
- Card background: `#FFFFFF`
- Primary accent: `#10B981` (emerald green)
- Income color: `#10B981`
- Expense color: `#EF4444`
- Savings positive: `#10B981`
- Savings negative: `#EF4444`
- Text primary: `#1E293B`
- Text secondary: `#64748B`
- Border/divider: `#E2E8F0`

### Typography feel:
- Large bold numbers (savings, totals) — `font-size: 2rem, font-weight: 700`
- Section titles — `font-size: 1rem, font-weight: 600, color: #64748B, text-transform: uppercase, letter-spacing: 0.05em`
- Body text — `Heebo, 14px`

---

## FILE STRUCTURE

```
expense-tracker/
├── index.html
├── vite.config.ts
├── tsconfig.json
├── package.json
├── .github/workflows/deploy.yml
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── theme.ts
    ├── types/index.ts
    ├── lib/
    │   ├── constants.ts
    │   ├── calculations.ts
    │   ├── excelParser.ts
    │   └── utils.ts
    ├── store/useExpenseStore.ts
    ├── components/
    │   ├── layout/
    │   │   ├── Header.tsx
    │   │   └── BottomNav.tsx        # mobile bottom navigation
    │   ├── month/
    │   │   ├── MonthSelector.tsx
    │   │   ├── IncomeSection.tsx
    │   │   ├── ExpenseTable.tsx
    │   │   ├── ExpenseRow.tsx
    │   │   └── MonthlySummary.tsx
    │   ├── charts/
    │   │   ├── CategoryPieChart.tsx
    │   │   ├── SavingsBarChart.tsx
    │   │   └── TrendLineChart.tsx
    │   ├── annual/
    │   │   ├── YearSelector.tsx
    │   │   └── AnnualSummary.tsx
    │   └── excel/
    │       └── ExcelControls.tsx
    └── hooks/
        └── useMonthData.ts
```

---

## DATA TYPES (`src/types/index.ts`)

```typescript
export type CategoryType =
  | 'דיור'
  | 'מזון'
  | 'תחבורה'
  | 'בריאות'
  | 'בילויים'
  | 'ביגוד'
  | 'חינוך'
  | 'חיסכון'
  | 'אחר';

export interface Expense {
  id: string;
  category: CategoryType;
  description: string;
  amount: number;
  date?: string;
}

export interface IncomeSource {
  id: string;
  label: string;
  amount: number;
}

export interface MonthData {
  year: number;
  month: number;        // 1–12
  income: IncomeSource[];
  expenses: Expense[];
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
```

---

## CONSTANTS (`src/lib/constants.ts`)

```typescript
export const CATEGORY_COLORS: Record<CategoryType, string> = {
  'דיור':     '#6366f1',   // indigo
  'מזון':     '#10b981',   // emerald
  'תחבורה':  '#f59e0b',   // amber
  'בריאות':  '#ef4444',   // red
  'בילויים': '#8b5cf6',   // purple
  'ביגוד':   '#ec4899',   // pink
  'חינוך':   '#06b6d4',   // cyan
  'חיסכון':  '#84cc16',   // lime
  'אחר':     '#94a3b8',   // slate
};

export const CATEGORY_ICONS: Record<CategoryType, string> = {
  'דיור':     '🏠',
  'מזון':     '🛒',
  'תחבורה':  '🚗',
  'בריאות':  '💊',
  'בילויים': '🎬',
  'ביגוד':   '👕',
  'חינוך':   '📚',
  'חיסכון':  '💰',
  'אחר':     '📦',
};

export const HEBREW_MONTHS = [
  'ינואר','פברואר','מרץ','אפריל','מאי','יוני',
  'יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'
];

export const SHORT_MONTHS = [
  'ינו','פבר','מרץ','אפר','מאי','יוני',
  'יול','אוג','ספט','אוק','נוב','דצמ'
];

export const SAVINGS_RATE_THRESHOLDS = {
  GOOD: 20,    // >20% — green
  OK: 10,      // 10-20% — amber
  POOR: 0,     // <10% — red
};
```

---

## STATE MODEL (`useExpenseStore.ts`)

Persisted to `expense-tracker-v1`.

```typescript
interface ExpenseState {
  months: MonthData[];
  selectedYear: number;
  selectedMonth: number;

  setSelectedPeriod: (year: number, month: number) => void;
  setSelectedYear: (year: number) => void;

  addExpense: (year: number, month: number, expense: Omit<Expense,'id'>) => void;
  updateExpense: (year: number, month: number, id: string, patch: Partial<Expense>) => void;
  removeExpense: (year: number, month: number, id: string) => void;

  addIncome: (year: number, month: number, source: Omit<IncomeSource,'id'>) => void;
  updateIncome: (year: number, month: number, id: string, patch: Partial<IncomeSource>) => void;
  removeIncome: (year: number, month: number, id: string) => void;

  importFromExcel: (months: MonthData[]) => void;
  clearAll: () => void;
}
```

---

## LAYOUT & UX

### App layout (desktop):
```
┌─────────────────────────────────────────────┐
│  HEADER: title + year selector + export btn │
├───────────────┬─────────────────────────────┤
│               │                             │
│  LEFT (5/12): │  RIGHT (7/12):              │
│  Month nav    │  Summary cards              │
│  Income       │  Category pie chart         │
│  Expenses     │  Savings bar chart          │
│               │  Trend line chart           │
│               │                             │
├───────────────┴─────────────────────────────┤
│  ANNUAL SECTION (full width, below fold)    │
└─────────────────────────────────────────────┘
```

### Mobile: single column, BottomNav with tabs:
- 📊 סקירה (summary + charts)
- 📝 הוצאות (expense table)
- 📅 שנתי (annual view)

---

## COMPONENT DETAILS

### Header (`Header.tsx`)
- White background, subtle bottom border `#E2E8F0`
- Right: app icon + "מעקב הוצאות" bold + "תכנון פיננסי אישי" small gray
- Left: `<Button variant="light" leftSection={<IconDownload />}>ייצוא</Button>` + `<Button variant="light" leftSection={<IconUpload />}>ייבוא</Button>`

### MonthSelector (`MonthSelector.tsx`)
- Large centered: `<ActionIcon>` ← | **"ינואר 2026"** in large bold | `<ActionIcon>` →
- Below: 12 pill buttons for months, active = filled emerald, has-data = dot indicator
- Smooth — clicking a month pill sets selectedMonth immediately

### MonthlySummary (`MonthlySummary.tsx`)
Three white cards in a row:
```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  💚 הכנסות  │ │  🔴 הוצאות  │ │  ✨ נחסך    │
│  ₪20,500    │ │  ₪14,200    │ │  ₪6,300     │
│  +₪3K vs    │ │  קטגוריות:4 │ │  31% מהכנסה │
│  חודש קודם  │ │             │ │  ████░░ bar  │
└──────────────┘ └──────────────┘ └──────────────┘
```
- "נחסך" card: large colored number, Mantine `<RingProgress>` showing savings %
- Trend arrow on income card vs previous month

### IncomeSection (`IncomeSection.tsx`)
- White card, title "💰 הכנסות החודש"
- Clean table: תיאור | סכום | ✕
- Inline edit on click
- Ghost "הוסף הכנסה +" button at bottom
- Total in bold green at bottom right

### ExpenseTable (`ExpenseTable.tsx`)
- White card, title "💸 הוצאות החודש"
- Columns: emoji+קטגוריה | תיאור | סכום | ✕
- Category shown as colored badge with emoji
- Sort by amount (highest first) by default
- "הוסף הוצאה +" ghost button at bottom
- Group by category toggle button in header
- Total in bold red at bottom right

### CategoryPieChart (`CategoryPieChart.tsx`)
- White card, title "לאן הלך הכסף?"
- Recharts `<PieChart>` with donut style (`innerRadius={60}`)
- Center text: largest category name + amount
- Custom Hebrew tooltip
- Legend below with colored dots + amounts + percentages

### SavingsBarChart (`SavingsBarChart.tsx`)
- White card, title "חיסכון לאורך השנה"
- 12 bars: green if positive, red if negative
- Bars for months with no data: ghost/transparent
- Y-axis: ₪XK format
- Recharts `<ReferenceLine y={0}>`

### TrendLineChart (`TrendLineChart.tsx`)
- White card, title "מגמת הכנסות מול הוצאות"
- Two lines: green (income) + red (expenses)
- Shaded area between them = savings zone
- `type="monotone"` for smooth curves

### AnnualSummary (`AnnualSummary.tsx`)
- Year `<Select>` dropdown at top right — shows years with data + current year
- 4 stat cards: סה"כ הכנסות / סה"כ הוצאות / נחסך / ממוצע חודשי
- "החודש הטוב" + "החודש הקשה" highlighted cards
- Full year table: all 12 months, color coded rows

---

## EXCEL IMPORT/EXPORT

### Export (SheetJS):
- One sheet per month named "ינואר 2026"
- Section headers: הכנסות / הוצאות
- Columns: קטגוריה | תיאור | סכום | תאריך

### Import:
- `@mantine/dropzone` with xlsx accept
- Parse sheet name → extract month + year
- Preview modal (Mantine `<Modal>`) before confirm
- Merge: imported month replaces existing same month
- Hebrew error notifications via `@mantine/notifications`

---

## SEED DATA (inject if localStorage empty)

```typescript
const SEED_MONTHS = [
  {
    year: 2026, month: 1,
    income: [
      { label: 'משכורת', amount: 17500 },
      { label: 'עבודה נוספת', amount: 3000 }
    ],
    expenses: [
      { category: 'דיור', description: 'שכירות', amount: 4250 },
      { category: 'מזון', description: 'סופר', amount: 1800 },
      { category: 'תחבורה', description: 'דלק', amount: 600 },
      { category: 'בילויים', description: 'מסעדות', amount: 900 },
      { category: 'דיור', description: 'חשמל וארנונה', amount: 800 },
    ]
  },
  {
    year: 2026, month: 2,
    income: [{ label: 'משכורת', amount: 17500 }],
    expenses: [
      { category: 'דיור', description: 'שכירות', amount: 4250 },
      { category: 'מזון', description: 'סופר', amount: 1600 },
      { category: 'בילויים', description: 'בילויים', amount: 1200 },
      { category: 'ביגוד', description: 'בגדים', amount: 500 },
    ]
  },
  {
    year: 2026, month: 3,
    income: [
      { label: 'משכורת', amount: 17500 },
      { label: 'בונוס', amount: 5000 }
    ],
    expenses: [
      { category: 'דיור', description: 'שכירות', amount: 4250 },
      { category: 'מזון', description: 'סופר', amount: 2100 },
      { category: 'בריאות', description: 'רופא', amount: 400 },
      { category: 'תחבורה', description: 'נסיעה לחו"ל', amount: 1500 },
    ]
  }
];
```

---

## GITHUB PAGES

```typescript
// vite.config.ts
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-mantine': ['@mantine/core', '@mantine/hooks',
                             '@mantine/notifications', '@mantine/dropzone'],
          'vendor-charts': ['recharts'],
          'vendor-excel': ['xlsx'],
          'vendor-icons': ['@tabler/icons-react'],
        }
      }
    }
  }
})
```

GitHub Actions: auto-deploy to `gh-pages` on push to `main`.

---

## CONSTRAINTS

- 100% client-side. No backend. No API calls.
- localStorage only via Zustand persist.
- Mantine v7 only for UI. No Tailwind. No CSS Modules.
- TypeScript strict. No `any`.
- Functional components only.
- All UI text in Hebrew. Code comments in English.
- Light theme only — `defaultColorScheme: 'light'`. No dark mode toggle.
- Must work offline after first load.

---

## EXECUTION ORDER

1. `package.json`, `vite.config.ts`, `tsconfig.json`
2. `src/types/index.ts`
3. `src/lib/constants.ts`
4. `src/lib/utils.ts`
5. `src/lib/calculations.ts`
6. `src/lib/excelParser.ts`
7. `src/theme.ts`
8. `src/store/useExpenseStore.ts` (with seed data injection)
9. `MonthSelector`, `IncomeSection`, `ExpenseTable`, `ExpenseRow`
10. `MonthlySummary`
11. `CategoryPieChart`, `SavingsBarChart`, `TrendLineChart`
12. `YearSelector`, `AnnualSummary`
13. `ExcelControls`
14. `Header`, `BottomNav`, `App.tsx`, `main.tsx`
15. `index.html` (RTL + Heebo font from Google Fonts)
16. GitHub Actions `deploy.yml`

After all files: `npm run build` must pass with zero TypeScript errors.