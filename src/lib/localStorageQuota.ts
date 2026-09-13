/** Typical Chromium/Firefox per-origin localStorage ceiling. */
export const DEFAULT_LOCAL_STORAGE_QUOTA_BYTES = 5 * 1024 * 1024;

/** Soft warning — start prompting the user to export. */
export const LOCAL_STORAGE_WARN_RATIO = 0.7;

/** Hard warning — storage may fail on the next large write. */
export const LOCAL_STORAGE_CRITICAL_RATIO = 0.9;

export type LocalStorageUsageLevel = 'ok' | 'warn' | 'critical';

export interface LocalStorageUsage {
  usedBytes: number;
  quotaBytes: number;
  ratio: number;
  level: LocalStorageUsageLevel;
  percentUsed: number;
}

/** UTF-16 code units × 2 — matches how browsers bill localStorage. */
export function measureLocalStorageUsedBytes(storage: Storage = localStorage): number {
  let total = 0;
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key === null) continue;
    const value = storage.getItem(key) ?? '';
    total += (key.length + value.length) * 2;
  }
  return total;
}

export function resolveUsageLevel(ratio: number): LocalStorageUsageLevel {
  if (ratio >= LOCAL_STORAGE_CRITICAL_RATIO) return 'critical';
  if (ratio >= LOCAL_STORAGE_WARN_RATIO) return 'warn';
  return 'ok';
}

/**
 * Measures current localStorage pressure against a fixed quota estimate.
 * Does not use navigator.storage.estimate() — that reports the whole origin
 * (IndexedDB etc.), not the localStorage ceiling this app actually hits.
 */
export function getLocalStorageUsage(
  storage: Storage = localStorage,
  quotaBytes: number = DEFAULT_LOCAL_STORAGE_QUOTA_BYTES
): LocalStorageUsage {
  const safeQuota = quotaBytes > 0 ? quotaBytes : DEFAULT_LOCAL_STORAGE_QUOTA_BYTES;
  const usedBytes = measureLocalStorageUsedBytes(storage);
  const ratio = usedBytes / safeQuota;
  return {
    usedBytes,
    quotaBytes: safeQuota,
    ratio,
    level: resolveUsageLevel(ratio),
    percentUsed: Math.min(100, Math.round(ratio * 100)),
  };
}

/** Human-readable size for Hebrew UI (KB / MB). */
export function formatStorageBytes(bytes: number): string {
  const safe = Number.isFinite(bytes) ? Math.max(0, bytes) : 0;
  if (safe < 1024) {
    return `${Math.round(safe)} B`;
  }
  if (safe < 1024 * 1024) {
    return `${(safe / 1024).toFixed(1)} KB`;
  }
  return `${(safe / (1024 * 1024)).toFixed(2)} MB`;
}
