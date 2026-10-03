import { useState } from 'react';
import {
  ActionIcon,
  Alert,
  Box,
  Button,
  Checkbox,
  Divider,
  FileButton,
  Group,
  Modal,
  Progress,
  Select,
  Stack,
  Switch,
  Text,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconAlertTriangle,
  IconDatabase,
  IconDownload,
  IconRestore,
  IconSettings,
} from '@tabler/icons-react';
import { applyFullBackupRestore } from '../../lib/clearUserData';
import {
  DriveParseError,
  formatDriveBackupExportedAt,
  parseDriveBackupPayload,
} from '../../lib/googleDrive';
import {
  AUTO_BACKUP_INTERVAL_OPTIONS,
  formatLastBackupLabel,
  type AutoBackupFormat,
} from '../../lib/localBackup';
import { formatStorageBytes } from '../../lib/localStorageQuota';
import { COLORS } from '../../lib/constants';
import { formatMonthYear } from '../../lib/utils';
import { useSettingsStore } from '../../store/useSettingsStore';
import type { DriveBackupPayload } from '../../types';
import { useLocalDataResilienceContext } from './LocalDataResilienceProvider';

/** Upper bound for a JSON backup file picked by hand (10 MB). */
const JSON_BACKUP_MAX_BYTES = 10 * 1024 * 1024;

interface LocalDataBackupProps {
  compact?: boolean;
  /**
   * When true, renders only the settings/backup controls (no toolbar buttons / nested modal).
   * Used inside the main Settings panel.
   */
  embedded?: boolean;
}

export function LocalDataBackupSettings(): JSX.Element {
  const { usage, backupNow } = useLocalDataResilienceContext();

  const autoBackupEnabled = useSettingsStore((state) => state.autoBackupEnabled);
  const autoBackupIntervalDays = useSettingsStore((state) => state.autoBackupIntervalDays);
  const autoBackupFormat = useSettingsStore((state) => state.autoBackupFormat);
  const lastLocalBackupAt = useSettingsStore((state) => state.lastLocalBackupAt);
  const hasApiKey = useSettingsStore((state) => state.openRouterApiKey !== null);
  const setAutoBackupEnabled = useSettingsStore((state) => state.setAutoBackupEnabled);
  const setAutoBackupIntervalDays = useSettingsStore((state) => state.setAutoBackupIntervalDays);
  const setAutoBackupFormat = useSettingsStore((state) => state.setAutoBackupFormat);

  const [includeApiKey, setIncludeApiKey] = useState<boolean>(false);
  const [pendingRestore, setPendingRestore] = useState<DriveBackupPayload | null>(null);

  const lastLabel = formatLastBackupLabel(lastLocalBackupAt);
  const quotaColor =
    usage.level === 'critical' ? 'red' : usage.level === 'warn' ? 'yellow' : 'emerald';

  const handleRestoreFile = async (file: File | null): Promise<void> => {
    if (file === null) return;

    if (file.size > JSON_BACKUP_MAX_BYTES) {
      notifications.show({
        color: 'red',
        title: 'שגיאה',
        message: 'הקובץ גדול מדי (מעל 10MB) ואינו נראה כקובץ גיבוי תקין.',
      });
      return;
    }

    try {
      const raw: unknown = JSON.parse(await file.text());
      setPendingRestore(parseDriveBackupPayload(raw));
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'שגיאה',
        message:
          error instanceof DriveParseError
            ? error.message
            : 'לא ניתן לקרוא את קובץ הגיבוי. ודא שזה קובץ JSON שנוצר על ידי האפליקציה.',
      });
    }
  };

  const confirmRestore = (): void => {
    if (pendingRestore === null) return;
    const payload = pendingRestore;
    applyFullBackupRestore(payload);
    setPendingRestore(null);
    notifications.show({
      color: 'emerald',
      title: 'השחזור הושלם',
      message: `הנתונים שוחזרו מגיבוי מ-${formatDriveBackupExportedAt(payload.exportedAt)} (${payload.months.length} חודשים).`,
    });
  };

  return (
    <Stack gap="md">
      <Alert
        color={quotaColor}
        icon={<IconDatabase size={18} />}
        title={`ניצול אחסון מקומי: ${usage.percentUsed}%`}
      >
        <Stack gap="xs">
          <Text fz="sm">
            {formatStorageBytes(usage.usedBytes)} מתוך כ־
            {formatStorageBytes(usage.quotaBytes)} (הערכה לדפדפן). הנתונים נשמרים רק אצלך — אין
            שרת.
          </Text>
          <Progress value={usage.percentUsed} color={quotaColor} radius="xl" size="sm" />
          {usage.level !== 'ok' && (
            <Text fz="sm" c={usage.level === 'critical' ? 'red' : 'orange'}>
              {usage.level === 'critical'
                ? 'האחסון כמעט מלא — ייצא גיבוי בהקדם. שמירות חדשות עלולות להיכשל.'
                : 'האחסון מתמלא — מומלץ לייצא גיבוי בקרוב.'}
            </Text>
          )}
        </Stack>
      </Alert>

      <Box
        p="sm"
        style={{
          background: COLORS.pageBg,
          borderRadius: 12,
          border: `1px solid ${COLORS.border}`,
        }}
      >
        <Text fz="sm" c={COLORS.textSecondary}>
          {lastLabel}
        </Text>
      </Box>

      <Switch
        checked={autoBackupEnabled}
        onChange={(event) => setAutoBackupEnabled(event.currentTarget.checked)}
        label="גיבוי אוטומטי מתוזמן"
        description="כשהמועד מגיע, האפליקציה מנסה להוריד קובץ לתיקיית ההורדות (בלי שרת)."
      />

      <Select
        label="תדירות גיבוי"
        data={[...AUTO_BACKUP_INTERVAL_OPTIONS]}
        value={String(autoBackupIntervalDays)}
        onChange={(value) => {
          if (value !== null) {
            setAutoBackupIntervalDays(Number.parseInt(value, 10));
          }
        }}
        disabled={!autoBackupEnabled}
        allowDeselect={false}
      />

      <Select
        label="פורמט קובץ"
        data={[
          { value: 'json', label: 'JSON (זהה לגיבוי Drive)' },
          { value: 'xlsx', label: 'Excel' },
          { value: 'both', label: 'גם JSON וגם Excel' },
        ]}
        value={autoBackupFormat}
        onChange={(value) => {
          if (value === 'json' || value === 'xlsx' || value === 'both') {
            setAutoBackupFormat(value as AutoBackupFormat);
          }
        }}
        disabled={!autoBackupEnabled}
        allowDeselect={false}
      />

      <Text fz="xs" c="dimmed">
        דפדפנים לעיתים חוסמים הורדה בלי לחיצה ידנית. אם הקובץ לא יורד אוטומטית — השתמשו בכפתור
        «גבה מקומית».
      </Text>

      <Checkbox
        checked={includeApiKey}
        onChange={(event) => setIncludeApiKey(event.currentTarget.checked)}
        disabled={!hasApiKey}
        color="emerald"
        label="כלול מפתח API בקובץ"
        description={
          hasApiKey
            ? 'אזהרה: הקובץ יכיל את מפתח ה-OpenRouter שלך בטקסט גלוי. שמור אותו במקום בטוח ואל תשתף אותו.'
            : 'אין מפתח OpenRouter שמור במכשיר הזה.'
        }
      />

      <Button
        color="blue"
        radius="xl"
        leftSection={<IconDownload size={16} />}
        onClick={() => {
          backupNow({ includeApiKey });
        }}
        fullWidth
      >
        גבה מקומית עכשיו
      </Button>

      <Divider />

      <Stack gap="xs">
        <Text fw={600} fz="sm">
          שחזור מקובץ גיבוי
        </Text>
        <Text fz="xs" c="dimmed">
          טעינת קובץ JSON שנוצר באפליקציה (מקומי או מ-Drive). כל הנתונים הנוכחיים במכשיר יוחלפו.
        </Text>
        <FileButton
          accept="application/json,.json"
          onChange={(file) => {
            void handleRestoreFile(file);
          }}
        >
          {(props) => (
            <Button
              {...props}
              variant="light"
              color="gray"
              radius="xl"
              leftSection={<IconRestore size={16} />}
              fullWidth
            >
              שחזר מקובץ JSON
            </Button>
          )}
        </FileButton>
      </Stack>

      <Modal
        opened={pendingRestore !== null}
        onClose={() => setPendingRestore(null)}
        title="שחזור מקובץ גיבוי"
        centered
      >
        <Stack gap="md">
          <Text fz="sm">
            {pendingRestore !== null
              ? `הקובץ נוצר ב-${formatDriveBackupExportedAt(pendingRestore.exportedAt)} ומכיל ${pendingRestore.months.length} חודשים. התקופה שתיבחר: ${formatMonthYear(pendingRestore.selectedYear, pendingRestore.selectedMonth)}.`
              : ''}
          </Text>
          {(pendingRestore?.skippedRows ?? 0) > 0 && (
            <Text fz="sm" c="orange">
              {`${pendingRestore?.skippedRows ?? 0} שורות לא נקראו`}
            </Text>
          )}
          <Text fz="sm">
            כל הנתונים המקומיים יוחלפו (לא ימוזגו) — חודשים, קטגוריות, זיכרון עסקים, יעדים,
            עסקאות שהוחרגו והגדרות. אם הקובץ אינו מכיל מפתח API, המפתח הנוכחי יישאר כפי שהוא.
            הפעולה אינה ניתנת לביטול.
          </Text>
          <Group justify="flex-end" gap="xs">
            <Button variant="default" radius="xl" onClick={() => setPendingRestore(null)}>
              ביטול
            </Button>
            <Button color="blue" radius="xl" onClick={confirmRestore}>
              כן, שחזר מהקובץ
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

export function LocalDataBackup({
  compact = false,
  embedded = false,
}: LocalDataBackupProps): JSX.Element {
  const { usage, backupNow, isBackupDue } = useLocalDataResilienceContext();
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const size = compact ? 'xs' : 'sm';
  const lastLabel = formatLastBackupLabel(useSettingsStore((state) => state.lastLocalBackupAt));
  const quotaColor =
    usage.level === 'critical' ? 'red' : usage.level === 'warn' ? 'yellow' : 'emerald';

  if (embedded) {
    return <LocalDataBackupSettings />;
  }

  return (
    <>
      <Group gap={4} wrap="nowrap">
        <Tooltip label={lastLabel} withArrow>
          <Button
            variant={isBackupDue ? 'filled' : 'light'}
            color={isBackupDue ? 'blue' : 'gray'}
            size={size}
            radius="xl"
            leftSection={<IconDownload size={16} />}
            onClick={() => {
              backupNow();
            }}
            aria-label="גבה מקומית לתיקיית ההורדות"
          >
            גבה מקומית
          </Button>
        </Tooltip>
        <Tooltip label="הגדרות גיבוי מקומי ואחסון" withArrow>
          <ActionIcon
            variant="subtle"
            color={usage.level === 'ok' ? 'gray' : quotaColor}
            size={compact ? 'sm' : 'md'}
            radius="xl"
            onClick={() => setSettingsOpen(true)}
            aria-label="הגדרות גיבוי מקומי ואחסון"
          >
            {usage.level === 'ok' ? <IconSettings size={16} /> : <IconAlertTriangle size={16} />}
          </ActionIcon>
        </Tooltip>
      </Group>

      <Modal
        opened={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="גיבוי מקומי ואחסון"
        centered
      >
        <Stack gap="md">
          <LocalDataBackupSettings />
          <Group justify="flex-end">
            <Button variant="default" radius="xl" onClick={() => setSettingsOpen(false)}>
              סגור
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

/** Sticky strip under the header when localStorage is getting full. */
export function LocalStorageQuotaBanner(): JSX.Element | null {
  const { usage, backupNow } = useLocalDataResilienceContext();

  if (usage.level === 'ok') {
    return null;
  }

  const isCritical = usage.level === 'critical';

  return (
    <Alert
      color={isCritical ? 'red' : 'yellow'}
      icon={<IconAlertTriangle size={18} />}
      title={isCritical ? 'אחסון מקומי כמעט מלא' : 'אחסון מקומי מתמלא'}
      radius={0}
      styles={{ root: { borderInline: 0, borderBottom: 0 } }}
    >
      <Group justify="space-between" align="center" wrap="wrap" gap="sm">
        <Text fz="sm" style={{ flex: '1 1 220px' }}>
          נוצלו כ־{usage.percentUsed}% מהמכסה ({formatStorageBytes(usage.usedBytes)} /{' '}
          {formatStorageBytes(usage.quotaBytes)}). מומלץ להוריד גיבוי לתיקיית ההורדות.
        </Text>
        <Button
          size="xs"
          radius="xl"
          color={isCritical ? 'red' : 'yellow'}
          variant="filled"
          leftSection={<IconDownload size={14} />}
          onClick={() => {
            backupNow();
          }}
        >
          גבה עכשיו
        </Button>
      </Group>
    </Alert>
  );
}
