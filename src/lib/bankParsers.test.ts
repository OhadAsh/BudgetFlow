import { describe, expect, it } from 'vitest';
import {
  extractInstallment,
  isCalSheet,
  isDiscountSheet,
  isMaxSheet,
  parseCalChargePeriod,
  parseCalDate,
  parseCalRows,
  parseDiscountDate,
  parseDiscountExpenseRows,
  parseDiscountIncomeRows,
  parseMaxDate,
  parseMaxRows,
  shouldExcludeBankExpense,
  shouldExcludeBankRow,
} from './excelParser';
import {
  buildTransactionFingerprint,
  isDuplicateFingerprint,
} from './transactionIdentity';

describe('parseCalDate / parseMaxDate variants', () => {
  it('parses dd/MM/yyyy, dots, dashes, two-digit year, and trailing time', () => {
    expect(parseCalDate('10/01/2026')).toBe('2026-01-10');
    expect(parseCalDate('10.01.2026')).toBe('2026-01-10');
    expect(parseCalDate('10-01-26')).toBe('2026-01-10');
    expect(parseCalDate('10/01/2026 14:30:00')).toBe('2026-01-10');
    expect(parseCalDate('2026-01-10')).toBe('2026-01-10');
    expect(parseCalDate('2026-01-10T08:00:00')).toBe('2026-01-10');
  });

  it('parses Excel serial numbers and rejects garbage', () => {
    // 2026-01-10 ≈ serial 46032 from the 1899-12-30 epoch used by Excel.
    expect(parseCalDate(46032)).toBe('2026-01-10');
    expect(parseCalDate('לא תאריך')).toBe('');
    expect(parseCalDate('')).toBe('');
  });

  it('parses Max DD-MM-YYYY and falls back to Cal formats', () => {
    expect(parseMaxDate('10-01-2026')).toBe('2026-01-10');
    expect(parseMaxDate('10-01-26')).toBe('2026-01-10');
    expect(parseMaxDate('10/01/2026')).toBe('2026-01-10');
  });
});

describe('Cal parser — header aliases & edge rows', () => {
  it('accepts alternate Cal column titles (שם בית העסק / סכום לחיוב)', () => {
    const rows = parseCalRows(
      [
        ['עסקאות לחיוב ב-01/03/2026'],
        ['תאריך החיוב', 'שם בית העסק', 'סכום לחיוב', 'קטגוריה', 'הערה'],
        ['15/03/2026', 'רמי לוי', 120.5, 'מזון', ''],
        ['', '', '', '', ''],
        ['את המידע המלא מופיע באתר'],
        [null, null, null],
        ['לא תאריך', '', 'abc', '', ''],
      ],
      { year: 2026, month: 3 },
      { source: 'cal' }
    );

    expect(isCalSheet([
      ['תאריך החיוב', 'שם בית העסק', 'סכום לחיוב'],
    ])).toBe(true);
    expect(rows).toHaveLength(1);
    expect(rows[0].merchant).toBe('רמי לוי');
    expect(rows[0].chargeAmount).toBe(120.5);
    expect(rows[0].date).toBe('2026-03-15');
    expect(rows[0].category).toBe('מזון');
  });

  it('keeps installment notes and marks pending empty charge cells', () => {
    const rows = parseCalRows(
      [
        ['תאריך עסקה', 'שם בית עסק', 'סכום עסקה', 'סכום חיוב', 'ענף', 'הערות'],
        ['01/02/2026', 'IKEA', 1200, 100, '', 'תשלום 1 מתוך 12'],
        ['02/02/2026', 'ממתין', 50, '', 'אחר', ''],
        ['03/02/2026', 'גם', 50, 50, 'אחר', 'תשלום 2 / 12'],
      ],
      { year: 2026, month: 2 },
      { source: 'cal' }
    );

    expect(rows).toHaveLength(3);
    expect(rows[0].installment).toBe('תשלום 1 מתוך 12');
    expect(rows[1].isPending).toBe(true);
    expect(rows[1].chargeAmount).toBe(0);
    expect(extractInstallment('תשלום 2 / 12')).toBe('תשלום 2 מתוך 12');
    expect(rows[2].installment).toBe('תשלום 2 מתוך 12');
  });

  it('parses charge period from Hebrew month text', () => {
    expect(parseCalChargePeriod('עסקאות לחיוב במרץ 2026')).toEqual({
      year: 2026,
      month: 3,
    });
  });
});

describe('Max parser — header aliases & edge rows', () => {
  it('accepts Max sheet without מטבע חיוב when קטגוריה is present', () => {
    const rows = parseMaxRows(
      [
        ['06-2026'],
        ['תאריך עסקה', 'שם העסק', 'קטגוריה', 'סכום חיוב', 'הערות'],
        ['10-01-2026', 'קפה', 'מסעדות, קפה וברים', '₪ 45.00', ''],
        ['סך הכל', '', '', 45, ''],
        ['', '', '', '', ''],
      ],
      { year: 2026, month: 6 },
      { source: 'max' }
    );

    expect(
      isMaxSheet([
        ['תאריך עסקה', 'שם העסק', 'קטגוריה', 'סכום חיוב', 'הערות'],
      ])
    ).toBe(true);
    expect(rows).toHaveLength(1);
    expect(rows[0].merchant).toBe('קפה');
    expect(rows[0].chargeAmount).toBe(45);
    expect(rows[0].category).toBe('בילויים');
  });

  it('does not classify a classic Cal sheet as Max', () => {
    const calHeader = [
      'תאריך עסקה',
      'שם בית עסק',
      'סכום עסקה',
      'סכום חיוב',
      'סוג עסקה',
      'ענף',
      'הערות',
    ];
    expect(isMaxSheet([calHeader])).toBe(false);
    expect(isCalSheet([calHeader])).toBe(true);
  });

  it('marks Max transaction-type installments', () => {
    const rows = parseMaxRows(
      [
        ['תאריך עסקה', 'שם בית העסק', 'קטגוריה', 'סכום חיוב', 'מטבע חיוב', 'סוג עסקה', 'הערות'],
        ['05-03-2026', 'חנות', 'ביגוד והנעלה', 200, '₪', 'תשלומים', ''],
      ],
      { year: 2026, month: 3 },
      { source: 'max' }
    );
    expect(rows[0].installment).toBe('תשלומים');
  });
});

describe('Discount parser — aliases, filters, bad rows', () => {
  it('parses alternate Discount headers and M/D date text', () => {
    expect(parseDiscountDate('3/15/26')).toBe('2026-03-15');
    expect(parseDiscountDate('15/03/2026')).toBe('2026-03-15');
    expect(parseDiscountDate('2026-03-15')).toBe('2026-03-15');

    const sheet = [
      ['תאריך ערך', 'תיאור', 'זכות/חובה'],
      ['3/10/2026', 'משכורת חברה', 15000],
      ['3/11/2026', 'שכר דירה', -4200],
      ['3/12/2026', 'כ.א.ל חיוב', -900],
      ['3/13/2026', 'עמלת פעולה', -5],
      ['', '', ''],
      ['סה"כ', '', 0],
      ['3/14/2026', '', -10],
      ['3/15/2026', 'העברה מחשבון אחר', 100],
    ];

    expect(isDiscountSheet('עובר ושב', sheet)).toBe(true);
    expect(isDiscountSheet('גיליון1', sheet)).toBe(true);

    const incomes = parseDiscountIncomeRows(sheet);
    const expenses = parseDiscountExpenseRows(sheet);

    expect(incomes).toHaveLength(1);
    expect(incomes[0].label).toBe('משכורת');
    expect(incomes[0].amount).toBe(15000);

    expect(expenses).toHaveLength(1);
    expect(expenses[0].description).toBe('שכר דירה');
    expect(expenses[0].category).toBe('דיור');
    expect(expenses[0].amount).toBe(4200);

    expect(shouldExcludeBankExpense('כ.א.ל חיוב')).toBe(true);
    expect(shouldExcludeBankRow('עמלת פעולה')).toBe(true);
  });
});

describe('duplicate fingerprints across re-parse', () => {
  it('same Cal row yields a stable fingerprint for duplicate detection', () => {
    const sheet = [
      ['תאריך עסקה', 'שם בית עסק', 'סכום עסקה', 'סכום חיוב', 'ענף', 'הערות'],
      ['10/01/2026', 'סופר', 50, 50, 'מזון', ''],
    ];
    const first = parseCalRows(sheet, { year: 2026, month: 1 }, { source: 'cal', cardLast4: '1234' });
    const second = parseCalRows(sheet, { year: 2026, month: 1 }, { source: 'cal', cardLast4: '1234' });

    expect(first[0].hash).toBe(second[0].hash);

    const existing = new Set([first[0].hash]);
    const input = {
      isoDate: second[0].date,
      merchant: second[0].merchant,
      chargeAmount: second[0].chargeAmount,
      source: 'cal' as const,
      cardLast4: '1234',
    };
    expect(
      isDuplicateFingerprint(existing, input, buildTransactionFingerprint(input))
    ).toBe(true);
  });
});
