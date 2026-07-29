# BudgetFlow — מעקב הוצאות וחיסכון

אפליקציית ווב בעברית לניהול תקציב אישי: רישום הכנסות והוצאות לפי חודש, מעקב אחר החיסכון בפועל,
פילוח קטגוריות, ניתוח שנתי וייבוא/ייצוא לאקסל. כל הנתונים נשמרים מקומית בדפדפן — ללא שרת וללא חשבון.

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
- **Summary** — income, expenses and net saved cards, trend versus the previous month, and a savings
  rate ring colored by the thresholds in `src/lib/constants.ts`.
- **Charts** — donut breakdown of spending, 12-month savings bars (click a bar to jump to that
  month), and an income-versus-expenses trend line with the savings zone shaded.
- **Annual view** — year dropdown, four totals, best/worst month highlights, and a full 12-month
  table.
- **Excel** — export creates one sheet per month named e.g. `ינואר 2026`; import reads the same
  format, shows a preview before confirming, and replaces months that already exist.
- **Cal (כאל) card statements** — "ייבוא מכאל 💳" reads a Cal transaction report straight from the
  bank export. The format is detected from its column headers, dates arrive as Excel serial numbers,
  the charged amount (`סכום חיוב`) is used rather than the original transaction amount, categories are
  guessed from the `ענף` column with a merchant-name fallback, installments keep a `תשלום X מתוך Y`
  note, transactions still being processed are shown greyed out and skipped, and rows already
  imported are detected by fingerprint so a re-import does not duplicate them.

## Data model notes

- State lives in a single Zustand store persisted under the `expense-tracker-v1` localStorage key.
- Seed data for ינואר–מרץ 2026 is injected only when no persisted data exists.
- The `חיסכון` category is treated as money moved to savings, not as spending, so it is excluded
  from `totalExpenses` and from the category breakdown chart. `netSaved = totalIncome - totalExpenses`.
- All money math lives in `src/lib/calculations.ts` as pure functions.

## Offline

`public/sw.js` is registered in production builds only. Hashed assets are served cache-first,
navigations are network-first with a cached fallback, so the app keeps working after the first load
without a connection. The Heebo webfont falls back to the local sans-serif stack while offline.

## Deployment

`.github/workflows/deploy.yml` builds on every push to `main` and publishes `dist/` to GitHub Pages.
Enable Pages for the repository with "Source: GitHub Actions". `vite.config.ts` uses `base: './'`, so
the build works from any sub-path.

## Security note

`xlsx@0.18.5` on the npm registry has known advisories (prototype pollution / ReDoS). Files are
parsed locally in the user's browser and never uploaded, so exposure is limited to files the user
opens themselves. To clear the advisories, install SheetJS from its official CDN distribution
instead of the npm registry copy.
