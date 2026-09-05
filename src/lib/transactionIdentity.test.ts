import { describe, expect, it } from 'vitest';
import type { Expense, MonthData } from '../types';
import {
  buildCardImportNote,
  buildTransactionHash,
  collectImportedHashes,
  exportToWorkbook,
  parseCalRows,
  parseMaxRows,
  periodToIsoDate,
  resolveCardExpenseDate,
  resolveCardTransactionPeriod,
} from './excelParser';
import { applySettingsImport } from './settingsImport';
import {
  buildLegacyTransactionHash,
  buildTransactionFingerprint,
  extractCardLast4FromHeaderRows,
  extractInstallmentMarker,
  fingerprintKeysForExpense,
  formatCardSourceLabel,
  isDuplicateFingerprint,
  normalizeCardLast4,
} from './transactionIdentity';
import { formatDisplayDate } from './utils';
import { sortExpenses } from './calculations';
import * as XLSX from 'xlsx';

function makeExpense(partial: Partial<Expense> & Pick<Expense, 'description' | 'amount'>): Expense {
  return {
    id: crypto.randomUUID(),
    category: 'אחר',
    ...partial,
  };
}

describe('formatDisplayDate / table date', () => {
  it('TEST 1: formats stored transaction date for display', () => {
    expect(formatDisplayDate('2026-01-15')).toBe('15/01/2026');
    expect(formatDisplayDate(undefined)).toBe('—');
  });

  it('sorts expenses by date descending', () => {
    const sorted = sortExpenses([
      makeExpense({ description: 'a', amount: 10, date: '2026-01-01' }),
      makeExpense({ description: 'b', amount: 99, date: '2026-01-20' }),
      makeExpense({ description: 'c', amount: 50 }),
    ]);
    expect(sorted.map((e) => e.description)).toEqual(['b', 'a', 'c']);
  });
});

describe('source / card last4', () => {
  it('TEST 2: preserves CAL + last4 in fingerprint and label', () => {
    const last4 = normalizeCardLast4('1234');
    expect(last4).toBe('1234');
    expect(formatCardSourceLabel('cal', '1234')).toBe('CAL •••• 1234');

    const hash = buildTransactionFingerprint({
      isoDate: '2026-01-10',
      merchant: 'סופר',
      chargeAmount: 50,
      source: 'cal',
      cardLast4: '1234',
    });
    expect(hash.length).toBeGreaterThan(0);

    const rows = parseCalRows(
      [
        ['כרטיס המסתיים ב-1234'],
        ['תאריך עסקה', 'שם בית עסק', 'סכום עסקה', 'סכום חיוב', 'ענף', 'הערות'],
        ['10/01/2026', 'סופר', 50, 50, 'מזון', ''],
      ],
      { year: 2026, month: 1 },
      { source: 'cal', cardLast4: '1234' }
    );
    expect(rows[0].source).toBe('cal');
    expect(rows[0].cardLast4).toBe('1234');
  });

  it('TEST 3: preserves MAX + last4', () => {
    expect(formatCardSourceLabel('max', '5678')).toBe('MAX •••• 5678');
    const extracted = extractCardLast4FromHeaderRows([['כרטיס **** 5678']]);
    expect(extracted).toBe('5678');

    const rows = parseMaxRows(
      [
        ['06/2026'],
        ['תאריך עסקה', 'שם בית העסק', 'קטגוריה', 'סכום חיוב', 'מטבע חיוב', 'סוג עסקה', 'הערות'],
        ['10-01-2026', 'חנות', 'סופרמרקט', 80, '₪', 'רגילה', ''],
      ],
      { year: 2026, month: 6 },
      { source: 'max', cardLast4: '5678' }
    );
    expect(rows[0].source).toBe('max');
    expect(rows[0].cardLast4).toBe('5678');
  });
});

describe('installments', () => {
  it('TEST 4: 2-installment plan buckets one charge per month', () => {
    const chargeJan = { year: 2026, month: 1 };
    const chargeFeb = { year: 2026, month: 2 };

    const janRows = parseCalRows(
      [
        ['עסקאות לחיוב ב-01/01/2026'],
        ['תאריך עסקה', 'שם בית עסק', 'סכום עסקה', 'סכום חיוב', 'ענף', 'הערות'],
        ['15/12/2025', 'X', 200, 100, '', 'תשלום 1 מתוך 2'],
      ],
      chargeJan,
      { source: 'cal' }
    );
    const febRows = parseCalRows(
      [
        ['עסקאות לחיוב ב-01/02/2026'],
        ['תאריך עסקה', 'שם בית עסק', 'סכום עסקה', 'סכום חיוב', 'ענף', 'הערות'],
        ['15/12/2025', 'X', 200, 100, '', 'תשלום 2 מתוך 2'],
      ],
      chargeFeb,
      { source: 'cal' }
    );

    expect(janRows).toHaveLength(1);
    expect(febRows).toHaveLength(1);
    expect(resolveCardTransactionPeriod(janRows[0], chargeJan)).toEqual(chargeJan);
    expect(resolveCardTransactionPeriod(febRows[0], chargeFeb)).toEqual(chargeFeb);
    expect(resolveCardExpenseDate(janRows[0])).toBe('2026-01-01');
    expect(resolveCardExpenseDate(febRows[0])).toBe('2026-02-01');
    expect(janRows[0].hash).not.toBe(febRows[0].hash);
  });

  it('supports 3 installments with distinct fingerprints', () => {
    const hashes = [1, 2, 3].map((n) =>
      buildTransactionHash(
        '2025-12-15',
        'X',
        100,
        `תשלום ${n} מתוך 3`,
        { year: 2026, month: n },
        'cal'
      )
    );
    expect(new Set(hashes).size).toBe(3);
  });
});

describe('duplicate detection', () => {
  it('TEST 5: importing the same card fingerprint twice is detected', () => {
    const tx = {
      isoDate: '2026-01-10',
      merchant: 'סופר',
      chargeAmount: 50,
      source: 'cal' as const,
      cardLast4: '1234',
    };
    const hash = buildTransactionFingerprint(tx);
    const months: MonthData[] = [
      {
        year: 2026,
        month: 1,
        income: [],
        expenses: [
          makeExpense({
            description: 'סופר',
            amount: 50,
            date: '2026-01-10',
            hash,
            source: 'cal',
            cardLast4: '1234',
          }),
        ],
      },
    ];
    const existing = collectImportedHashes(months);
    expect(isDuplicateFingerprint(existing, tx, hash)).toBe(true);
  });

  it('TEST 6: Excel export/import preserves hash so card re-import is detected', () => {
    const installment = 'תשלום 1 מתוך 2';
    const hash = buildTransactionHash(
      '2025-12-15',
      'X',
      100,
      installment,
      { year: 2026, month: 1 },
      'cal',
      '1234'
    );
    const original: MonthData[] = [
      {
        year: 2026,
        month: 1,
        income: [],
        expenses: [
          makeExpense({
            description: 'X',
            amount: 100,
            date: periodToIsoDate({ year: 2026, month: 1 }),
            note: `${installment} · רכישה 15/12/2025`,
            hash,
            source: 'cal',
            cardLast4: '1234',
          }),
        ],
      },
    ];

    const workbook = exportToWorkbook(original, [], {}, {});
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
      header: 1,
      defval: '',
    });
    // Find expense data row (after הכנסות / הוצאות headers)
    const expenseRow = rows.find(
      (row) => Array.isArray(row) && row[1] === 'X' && Number(row[2]) === 100
    );
    expect(expenseRow).toBeDefined();
    expect(expenseRow?.[4]).toContain('תשלום 1 מתוך 2');
    expect(expenseRow?.[5]).toBe(hash);
    expect(expenseRow?.[6]).toBe('cal');
    expect(String(expenseRow?.[7])).toBe('1234');

    // Simulate restored expense after Excel import (new UUID, same fingerprint fields).
    const restored = makeExpense({
      description: 'X',
      amount: 100,
      date: '2026-01-01',
      note: String(expenseRow?.[4]),
      hash: String(expenseRow?.[5]),
      source: 'cal',
      cardLast4: '1234',
    });
    const existing = collectImportedHashes([
      { year: 2026, month: 1, income: [], expenses: [restored] },
    ]);

    const reimportHash = buildTransactionHash(
      '2025-12-15',
      'X',
      100,
      installment,
      { year: 2026, month: 1 },
      'cal',
      '1234'
    );
    expect(
      isDuplicateFingerprint(
        existing,
        {
          isoDate: '2025-12-15',
          merchant: 'X',
          chargeAmount: 100,
          installment,
          chargePeriod: { year: 2026, month: 1 },
          source: 'cal',
          cardLast4: '1234',
        },
        reimportHash
      )
    ).toBe(true);
  });

  it('TEST 7: same merchant+amount different dates are not duplicates', () => {
    const a = buildTransactionFingerprint({
      isoDate: '2026-01-10',
      merchant: 'סופר',
      chargeAmount: 50,
      source: 'cal',
    });
    const b = buildTransactionFingerprint({
      isoDate: '2026-01-11',
      merchant: 'סופר',
      chargeAmount: 50,
      source: 'cal',
    });
    expect(a).not.toBe(b);

    const existing = new Set([a]);
    expect(
      isDuplicateFingerprint(existing, {
        isoDate: '2026-01-11',
        merchant: 'סופר',
        chargeAmount: 50,
        source: 'cal',
      })
    ).toBe(false);
  });

  it('TEST 8: same merchant+amount+date different cards stay separate', () => {
    const cal = buildTransactionFingerprint({
      isoDate: '2026-01-10',
      merchant: 'סופר',
      chargeAmount: 50,
      source: 'cal',
      cardLast4: '1234',
    });
    const max = buildTransactionFingerprint({
      isoDate: '2026-01-10',
      merchant: 'סופר',
      chargeAmount: 50,
      source: 'max',
      cardLast4: '5678',
    });
    expect(cal).not.toBe(max);

    const existing = collectImportedHashes([
      {
        year: 2026,
        month: 1,
        income: [],
        expenses: [
          makeExpense({
            description: 'סופר',
            amount: 50,
            date: '2026-01-10',
            hash: cal,
            source: 'cal',
            cardLast4: '1234',
          }),
        ],
      },
    ]);
    expect(
      isDuplicateFingerprint(existing, {
        isoDate: '2026-01-10',
        merchant: 'סופר',
        chargeAmount: 50,
        source: 'max',
        cardLast4: '5678',
      })
    ).toBe(false);
  });

  it('legacy hashes without source still match re-imports', () => {
    const legacy = buildLegacyTransactionHash('2026-01-10', 'סופר', 50);
    const months: MonthData[] = [
      {
        year: 2026,
        month: 1,
        income: [],
        expenses: [
          makeExpense({
            description: 'סופר',
            amount: 50,
            date: '2026-01-10',
            hash: legacy,
          }),
        ],
      },
    ];
    const existing = collectImportedHashes(months);
    expect(
      isDuplicateFingerprint(existing, {
        isoDate: '2026-01-10',
        merchant: 'סופר',
        chargeAmount: 50,
        source: 'cal',
        cardLast4: '1234',
      })
    ).toBe(true);
  });
});

describe('category targets', () => {
  it('TEST 9–11: optional targets merge / survive settings import', () => {
    const applied = applySettingsImport(
      [],
      {},
      {},
      {
        categories: [],
        merchants: [],
        targets: [
          { category: 'מזון', monthlyTarget: 2000 },
          { category: 'בילויים', monthlyTarget: null },
        ],
      },
      'merge'
    );
    expect(applied.categoryTargets['מזון']).toBe(2000);
    expect(applied.categoryTargets['בילויים']).toBeUndefined();

    // Old category with no target stays empty.
    const empty = applySettingsImport([], {}, {}, { categories: [], merchants: [], targets: [] }, 'merge');
    expect(empty.categoryTargets).toEqual({});
  });
});

describe('helpers', () => {
  it('extracts installment markers from notes', () => {
    expect(extractInstallmentMarker('תשלום 2 מתוך 12 · רכישה 01/01/2026')).toBe(
      'תשלום 2 מתוך 12'
    );
    expect(buildCardImportNote({
      id: '1',
      date: '2025-12-15',
      dateLabel: '15/12/2025',
      merchant: 'X',
      transactionAmount: 200,
      chargeAmount: 100,
      branch: '',
      notes: 'תשלום 1 מתוך 2',
      installment: 'תשלום 1 מתוך 2',
      chargePeriod: { year: 2026, month: 1 },
      category: 'אחר',
      isPending: false,
      hash: 'x',
    })).toContain('תשלום 1 מתוך 2');
  });

  it('fingerprintKeysForExpense includes stored hash', () => {
    const expense = makeExpense({
      description: 'X',
      amount: 10,
      date: '2026-01-01',
      hash: 'stored-hash',
    });
    expect(fingerprintKeysForExpense(expense)).toContain('stored-hash');
  });
});
