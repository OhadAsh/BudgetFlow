import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MonthData } from '../types';
import {
  consumeMonthClearUndo,
  discardMonthClearUndo,
  hasPendingMonthClearUndo,
  peekMonthClearUndo,
  stashMonthClearUndo,
} from './monthClearUndo';

const sample: MonthData = {
  year: 2026,
  month: 4,
  income: [{ id: 'i1', label: 'משכורת', amount: 1 }],
  expenses: [],
};

describe('monthClearUndo', () => {
  afterEach(() => {
    discardMonthClearUndo();
    vi.useRealTimers();
  });

  it('stashes and consumes a snapshot without persisting', () => {
    stashMonthClearUndo(sample);
    expect(hasPendingMonthClearUndo()).toBe(true);
    expect(peekMonthClearUndo()).toEqual(sample);

    const consumed = consumeMonthClearUndo();
    expect(consumed).toEqual(sample);
    expect(hasPendingMonthClearUndo()).toBe(false);
    expect(consumeMonthClearUndo()).toBeNull();
  });

  it('expires the buffer after the undo window', () => {
    vi.useFakeTimers();
    stashMonthClearUndo(sample);
    expect(hasPendingMonthClearUndo()).toBe(true);

    vi.advanceTimersByTime(9000);
    expect(hasPendingMonthClearUndo()).toBe(false);
    expect(peekMonthClearUndo()).toBeNull();
  });
});
