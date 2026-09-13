import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import {
  assertWorkbookWithinImportLimits,
  MAX_CELLS_PER_WORKBOOK,
  MAX_ROWS_PER_SHEET,
  MAX_SHEETS_PER_WORKBOOK,
} from './excelParser';

function sheetWithRange(rows: number, cols: number): XLSX.WorkSheet {
  const data: Array<Array<string | number>> = [];
  for (let r = 0; r < Math.min(rows, 2); r += 1) {
    const row: Array<string | number> = [];
    for (let c = 0; c < Math.min(cols, 2); c += 1) {
      row.push(r === 0 && c === 0 ? 'x' : 1);
    }
    data.push(row);
  }
  const sheet = XLSX.utils.aoa_to_sheet(data.length > 0 ? data : [['x']]);
  // Force !ref to the claimed dimensions without allocating the full grid.
  const endCol = XLSX.utils.encode_col(cols - 1);
  const endRow = rows;
  sheet['!ref'] = `A1:${endCol}${endRow}`;
  return sheet;
}

describe('assertWorkbookWithinImportLimits', () => {
  it('allows a normal small workbook', () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheetWithRange(10, 5), 'ok');
    expect(() => assertWorkbookWithinImportLimits(workbook)).not.toThrow();
  });

  it('rejects too many sheets', () => {
    const workbook = XLSX.utils.book_new();
    for (let i = 0; i < MAX_SHEETS_PER_WORKBOOK + 1; i += 1) {
      XLSX.utils.book_append_sheet(workbook, sheetWithRange(1, 1), `s${i}`);
    }
    expect(() => assertWorkbookWithinImportLimits(workbook)).toThrow(/צפוף מדי|גדול/);
  });

  it('rejects a sheet with too many rows', () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      sheetWithRange(MAX_ROWS_PER_SHEET + 1, 2),
      'big'
    );
    expect(() => assertWorkbookWithinImportLimits(workbook)).toThrow(/צפוף מדי|גדול/);
  });

  it('rejects workbooks whose total cells exceed the cap', () => {
    const workbook = XLSX.utils.book_new();
    // 10 sheets × 1000 rows × 51 cols = 510_000 > 500_000
    const rows = 1000;
    const cols = Math.ceil((MAX_CELLS_PER_WORKBOOK + 1) / (10 * rows));
    for (let i = 0; i < 10; i += 1) {
      XLSX.utils.book_append_sheet(workbook, sheetWithRange(rows, cols), `d${i}`);
    }
    expect(() => assertWorkbookWithinImportLimits(workbook)).toThrow(/צפוף מדי|גדול/);
  });
});
