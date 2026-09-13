import type { MonthData } from '../types';

/** In-memory undo window after clearing a month — never written to localStorage. */
export const MONTH_CLEAR_UNDO_MS = 9000;

export const MONTH_CLEAR_UNDO_NOTIFICATION_ID = 'month-clear-undo';

interface MonthClearUndoState {
  snapshot: MonthData;
  timerId: ReturnType<typeof setTimeout> | null;
}

let pending: MonthClearUndoState | null = null;

/** Drops any pending undo buffer and cancels its expiry timer. */
export function discardMonthClearUndo(): void {
  if (pending?.timerId !== null && pending?.timerId !== undefined) {
    clearTimeout(pending.timerId);
  }
  pending = null;
}

/**
 * Stashes a cleared-month snapshot until `MONTH_CLEAR_UNDO_MS` elapses
 * (or until discard / consume). Calls `onExpire` when the window ends naturally.
 */
export function stashMonthClearUndo(snapshot: MonthData, onExpire?: () => void): void {
  discardMonthClearUndo();
  const timerId = setTimeout(() => {
    pending = null;
    onExpire?.();
  }, MONTH_CLEAR_UNDO_MS);
  pending = { snapshot, timerId };
}

/** Peek at the pending snapshot without consuming it. */
export function peekMonthClearUndo(): MonthData | null {
  return pending?.snapshot ?? null;
}

/** Returns and clears the pending snapshot, or null when nothing to undo. */
export function consumeMonthClearUndo(): MonthData | null {
  if (pending === null) return null;
  const { snapshot, timerId } = pending;
  if (timerId !== null) {
    clearTimeout(timerId);
  }
  pending = null;
  return snapshot;
}

export function hasPendingMonthClearUndo(): boolean {
  return pending !== null;
}
