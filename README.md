# BudgetFlow — מעקב הוצאות וחיסכון

אפליקציית ווב בעברית לניהול תקציב אישי: רישום הכנסות והוצאות לפי חודש, מעקב אחר החיסכון בפועל,
פילוח קטגוריות, ניתוח שנתי וייבוא/ייצוא לאקסל. כל הנתונים נשמרים מקומית בדפדפן — ללא שרת וללא חשבון.

**Live app:** [https://ohadash.github.io/BudgetFlow/](https://ohadash.github.io/BudgetFlow/)

## Stack

- React 18 + Vite 5 + TypeScript (strict)
- Mantine v7 (light theme only, RTL)
- Recharts for charts
- Zustand + `persist` for localStorage state
- SheetJS (`xlsx`) for Excel import/export
- Deployed as a static site to GitHub Pages

## Getting started

```bash
npm install
npm run dev      # dev server at http://localhost:5173
npm run build    # type-check + production build into dist/
npm run preview  # serve the production build locally
npm run typecheck
```

## Features

- **Month view** — month navigation with arrows plus 12 month pills; months that already contain
  data are marked with a dot.
- **Income / expenses** — inline editing of every field (click a value to edit it), category badges
  with emoji, sort by amount, and a group-by-category toggle.
- **Custom categories & merchant memory** — add your own categories (name, emoji, color) under
  ניהול קטגוריות; after you pick a category for a merchant during import or editing, the app
  remembers it for next time.
- **Summary** — income, expenses and net saved cards, trend versus the previous month, and a savings
  rate ring colored by the thresholds in `src/lib/constants.ts`.
- **Charts** — donut breakdown of spending, 12-month savings bars (click a bar to jump to that
  month), and an income-versus-expenses trend line with the savings zone shaded.
- **Annual view** — year dropdown, four totals, best/worst month highlights, and a full 12-month
  table.
- **Excel (financial data)** — export creates one sheet per month named e.g. `ינואר 2026`; import
  reads the same format, shows a preview before confirming, and replaces months that already exist.
- **Settings backup** — from ניהול קטגוריות you can export/import settings only (no money data) as
  `הגדרות-מעקב-הוצאות.xlsx` with two sheets: `קטגוריות מותאמות` (שם | אימוג'י | צבע) and
  `זיכרון עסקים` (שם עסק | קטגוריה). Import shows a preview and offers מיזוג עם קיים or החלף הכל.
- **Full delete backup** — לפני מחיקה סופית, "גיבוי לאקסל לפני מחיקה" exports all monthly sheets
  plus the two settings sheets above so categories and merchant memory can be restored later.
- **Cal (כאל) / Max card statements** — ייבוא עסקאות reads Cal or Max reports from the bank
  export. Format is detected from column headers; categories are guessed from branch/category
  columns with a merchant-name fallback and merchant memory; installments keep a
  `תשלום X מתוך Y` note; already-imported rows are fingerprinted so re-import does not duplicate.
- **Bank Discount** — ייבוא בנק reads עובר ושב statements into income and selected debit expenses
  (with filters for securities, fees, and card settlements).

## Data model notes

- State lives in a single Zustand store persisted under the `expense-tracker-v1` localStorage key.
- Persisted fields include months, selected period, `customCategories`, and `merchantMemory`.
- Seed data for ינואר–מרץ 2026 is injected only when no persisted data exists.
- The `חיסכון` category is treated as money moved to savings, not as spending, so it is excluded
  from `totalExpenses` and from the category breakdown chart. `netSaved = totalIncome - totalExpenses`.
- All money math lives in `src/lib/calculations.ts` as pure functions.
- Nuclear clear (`clearAll`) wipes months, custom categories, and merchant memory, then resets the
  selected period to today.

## Offline

`public/sw.js` is registered in production builds only. Hashed assets are served cache-first,
navigations are network-first with a cached fallback, so the app keeps working after the first load
without a connection. The Heebo webfont falls back to the local sans-serif stack while offline.

## Deployment

Published at [https://ohadash.github.io/BudgetFlow/](https://ohadash.github.io/BudgetFlow/).

`.github/workflows/deploy.yml` builds on every push to `main` and publishes `dist/` to GitHub Pages.
Enable Pages for the repository with "Source: GitHub Actions". `vite.config.ts` uses `base: './'`, so
the build works from any sub-path.

## Security note

`xlsx@0.18.5` on the npm registry has known advisories (prototype pollution / ReDoS). Files are
parsed locally in the user's browser and never uploaded, so exposure is limited to files the user
opens themselves. To clear the advisories, install SheetJS from its official CDN distribution
instead of the npm registry copy.
