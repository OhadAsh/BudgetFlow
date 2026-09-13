import { useCallback, useEffect, useState } from 'react';
import { notifications } from '@mantine/notifications';
import {
  isAutoBackupDue,
  runLocalBackupDownload,
  shouldNudgeLocalBackup,
  type LocalBackupSnapshotInput,
} from '../lib/localBackup';
import {
  formatStorageBytes,
  getLocalStorageUsage,
  type LocalStorageUsage,
} from '../lib/localStorageQuota';
import { useExpenseStore } from '../store/useExpenseStore';
import { useSettingsStore } from '../store/useSettingsStore';

const QUOTA_NOTIFY_ID = 'local-storage-quota';
const BACKUP_DUE_NOTIFY_ID = 'local-auto-backup-due';
const QUOTA_RECHECK_MS = 60_000;

/** Survives React StrictMode remounts within the same page load. */
let autoBackupAttemptedThisPageLoad = false;
let backupNudgeShownThisPageLoad = false;

function readSnapshot(): LocalBackupSnapshotInput {
  const state = useExpenseStore.getState();
  return {
    months: state.months,
    selectedYear: state.selectedYear,
    selectedMonth: state.selectedMonth,
    customCategories: state.customCategories,
    merchantMemory: state.merchantMemory,
    categoryTargets: state.categoryTargets,
  };
}

function hasAnythingToBackup(snapshot: LocalBackupSnapshotInput): boolean {
  return (
    snapshot.months.length > 0 ||
    snapshot.customCategories.length > 0 ||
    Object.keys(snapshot.merchantMemory).length > 0 ||
    Object.keys(snapshot.categoryTargets).length > 0
  );
}

export interface UseLocalDataResilienceResult {
  usage: LocalStorageUsage;
  refreshUsage: () => void;
  backupNow: (options?: { silent?: boolean }) => boolean;
  isBackupDue: boolean;
}

/**
 * Client-only resilience: localStorage pressure + scheduled Downloads backup.
 * Intentionally isolated from calculations.ts / dashboard math.
 */
export function useLocalDataResilience(): UseLocalDataResilienceResult {
  const autoBackupEnabled = useSettingsStore((state) => state.autoBackupEnabled);
  const autoBackupIntervalDays = useSettingsStore((state) => state.autoBackupIntervalDays);
  const autoBackupFormat = useSettingsStore((state) => state.autoBackupFormat);
  const lastLocalBackupAt = useSettingsStore((state) => state.lastLocalBackupAt);
  const markLocalBackupDone = useSettingsStore((state) => state.markLocalBackupDone);

  const [usage, setUsage] = useState<LocalStorageUsage>(() => getLocalStorageUsage());

  const refreshUsage = useCallback((): void => {
    setUsage(getLocalStorageUsage());
  }, []);

  const isBackupDue =
    autoBackupEnabled &&
    shouldNudgeLocalBackup(lastLocalBackupAt, autoBackupIntervalDays);
  const shouldAutoDownload =
    autoBackupEnabled && isAutoBackupDue(lastLocalBackupAt, autoBackupIntervalDays);

  const backupNow = useCallback(
    (options?: { silent?: boolean }): boolean => {
      const snapshot = readSnapshot();
      if (!hasAnythingToBackup(snapshot)) {
        if (!options?.silent) {
          notifications.show({
            color: 'yellow',
            title: 'אין נתונים לגיבוי',
            message: 'הוסף הכנסות, הוצאות או הגדרות לפני גיבוי מקומי.',
          });
        }
        return false;
      }

      try {
        runLocalBackupDownload(snapshot, autoBackupFormat);
        markLocalBackupDone();
        refreshUsage();
        notifications.hide(BACKUP_DUE_NOTIFY_ID);
        if (!options?.silent) {
          notifications.show({
            color: 'emerald',
            title: 'הגיבוי המקומי הושלם',
            message: 'הקובץ נשמר בתיקיית ההורדות של הדפדפן.',
          });
        }
        return true;
      } catch {
        if (!options?.silent) {
          notifications.show({
            color: 'red',
            title: 'שגיאה בגיבוי',
            message: 'הורדת הגיבוי נכשלה. נסה שוב או ייצא ידנית לאקסל.',
          });
        }
        return false;
      }
    },
    [autoBackupFormat, markLocalBackupDone, refreshUsage]
  );

  useEffect(() => {
    refreshUsage();
    const timer = window.setInterval(refreshUsage, QUOTA_RECHECK_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, [refreshUsage]);

  useEffect(() => {
    if (usage.level === 'ok') {
      notifications.hide(QUOTA_NOTIFY_ID);
      return;
    }

    const isCritical = usage.level === 'critical';
    notifications.show({
      id: QUOTA_NOTIFY_ID,
      color: isCritical ? 'red' : 'yellow',
      title: isCritical ? 'אחסון מקומי כמעט מלא' : 'אחסון מקומי מתמלא',
      message: `נוצלו כ־${usage.percentUsed}% מהמכסה המשוערת (${formatStorageBytes(usage.usedBytes)} מתוך ${formatStorageBytes(usage.quotaBytes)}). מומלץ לייצא גיבוי ולמחוק נתונים ישנים אם אפשר.`,
      autoClose: false,
      withCloseButton: true,
    });
  }, [usage.level, usage.percentUsed, usage.usedBytes, usage.quotaBytes]);

  useEffect(() => {
    if (!isBackupDue || !hasAnythingToBackup(readSnapshot())) {
      return;
    }

    if (!backupNudgeShownThisPageLoad) {
      backupNudgeShownThisPageLoad = true;
      notifications.show({
        id: BACKUP_DUE_NOTIFY_ID,
        color: 'blue',
        title:
          lastLocalBackupAt === null
            ? 'מומלץ ליצור גיבוי מקומי'
            : 'הגיע הזמן לגיבוי מקומי',
        message:
          lastLocalBackupAt === null
            ? 'הנתונים נשמרים רק בדפדפן. הורידו עותק לתיקיית ההורדות כדי לא לאבד אותם.'
            : 'מומלץ להוריד עותק לתיקיית ההורדות. אם ההורדה האוטומטית נחסמה — לחץ «גבה מקומית» בכותרת.',
        autoClose: lastLocalBackupAt === null ? 10_000 : false,
        withCloseButton: true,
      });
    }

    if (!shouldAutoDownload || autoBackupAttemptedThisPageLoad) {
      return;
    }
    autoBackupAttemptedThisPageLoad = true;

    // Best-effort programmatic download (browsers may block without a user gesture).
    // No cleanup cancel — StrictMode remount must not abort the one-shot attempt.
    window.setTimeout(() => {
      const ok = backupNow({ silent: true });
      if (ok) {
        notifications.hide(BACKUP_DUE_NOTIFY_ID);
        notifications.show({
          color: 'emerald',
          title: 'גיבוי אוטומטי הורד',
          message:
            'הקובץ נשמר בתיקיית ההורדות. אם לא מופיע קובץ חדש — לחצו «גבה מקומית» בכותרת.',
        });
      }
    }, 1200);
  }, [isBackupDue, shouldAutoDownload, lastLocalBackupAt, backupNow]);

  return {
    usage,
    refreshUsage,
    backupNow,
    isBackupDue,
  };
}
