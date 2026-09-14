import { useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Loader,
  Modal,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconBrandGoogleDrive,
  IconCloudDownload,
  IconCloudUpload,
  IconLogout,
  IconSettings,
} from '@tabler/icons-react';
import { useGoogleDrive } from '../../hooks/useGoogleDrive';
import { applyFullBackupRestore } from '../../lib/clearUserData';
import {
  DriveApiDisabledError,
  DriveNetworkError,
  DriveNotFoundError,
  DriveParseError,
  formatDriveBackupExportedAt,
} from '../../lib/googleDrive';
import { formatMonthYear } from '../../lib/utils';
import type { DriveBackupPayload } from '../../types';
import { GoogleClientIdModal } from './GoogleClientIdModal';

interface GoogleDriveBackupProps {
  compact?: boolean;
  /** Stacked layout for the settings panel (no separate gear icon). */
  embedded?: boolean;
}

function errorMessage(error: unknown): string {
  if (
    error instanceof DriveApiDisabledError ||
    error instanceof DriveNetworkError ||
    error instanceof DriveNotFoundError ||
    error instanceof DriveParseError
  ) {
    return error.message;
  }
  if (error instanceof Error && error.message === 'MISSING_CLIENT_ID') {
    return 'יש להגדיר תחילה Google OAuth Client ID.';
  }
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return 'אירעה שגיאה לא צפויה. נסה שוב.';
}

export function GoogleDriveBackup({
  compact = false,
  embedded = false,
}: GoogleDriveBackupProps): JSX.Element {
  const {
    isReady,
    isLoadingScript,
    isConnecting,
    isConnected,
    hasClientId,
    isBusy,
    signIn,
    signOut,
    backupNow,
    fetchBackup,
  } = useGoogleDrive();

  const [pendingRestore, setPendingRestore] = useState<DriveBackupPayload | null>(null);
  const [clientIdOpened, setClientIdOpened] = useState<boolean>(false);
  const [connectAfterSave, setConnectAfterSave] = useState<boolean>(false);
  const size = compact ? 'xs' : 'sm';

  const runSignIn = async (): Promise<void> => {
    try {
      await signIn();
      notifications.show({
        color: 'emerald',
        title: 'מחובר ל-Google Drive',
        message: 'אפשר לגבות ולשחזר את הנתונים בענן.',
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'MISSING_CLIENT_ID') {
        setConnectAfterSave(true);
        setClientIdOpened(true);
        return;
      }
      notifications.show({
        color: 'red',
        title: 'שגיאה',
        message: errorMessage(error),
      });
    }
  };

  const handleSignInClick = (): void => {
    if (!hasClientId) {
      setConnectAfterSave(true);
      setClientIdOpened(true);
      return;
    }
    void runSignIn();
  };

  const handleClientIdSaved = (): void => {
    if (connectAfterSave) {
      setConnectAfterSave(false);
      // Defer so the settings store + token client pick up the new Client ID.
      window.setTimeout(() => {
        void runSignIn();
      }, 0);
    }
  };

  const handleSignOut = async (): Promise<void> => {
    try {
      await signOut();
      notifications.show({
        color: 'gray',
        title: 'התנתקת',
        message: 'החיבור ל-Google Drive בוטל במכשיר זה.',
      });
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'שגיאה',
        message: errorMessage(error),
      });
    }
  };

  const handleBackup = async (): Promise<void> => {
    try {
      await backupNow();
      notifications.show({
        color: 'emerald',
        title: 'הגיבוי הושלם',
        message: 'הנתונים נשמרו בקובץ budgetflow-backup.json ב-Google Drive.',
      });
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'שגיאה בגיבוי',
        message: errorMessage(error),
      });
    }
  };

  const handleRestoreClick = async (): Promise<void> => {
    try {
      const payload = await fetchBackup();
      setPendingRestore(payload);
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'שגיאה בשחזור',
        message: errorMessage(error),
      });
    }
  };

  const handleRestoreConfirm = (): void => {
    if (pendingRestore === null) {
      return;
    }
    const payload = pendingRestore;
    applyFullBackupRestore(payload);
    setPendingRestore(null);
    const periodLabel = formatMonthYear(payload.selectedYear, payload.selectedMonth);
    const backupDate = formatDriveBackupExportedAt(payload.exportedAt);
    notifications.show({
      color: 'emerald',
      title: 'השחזור הושלם',
      message: `כל הנתונים המקומיים הוחלפו בגיבוי מ-${backupDate} (${payload.months.length} חודשים). התקופה הנבחרת: ${periodLabel}.`,
    });
  };

  const closeRestoreConfirm = (): void => {
    setPendingRestore(null);
  };

  const openClientIdSettings = (): void => {
    setConnectAfterSave(false);
    setClientIdOpened(true);
  };

  const settingsButton = (
    <Tooltip label="הגדרת Google Client ID" withArrow>
      <ActionIcon
        variant="subtle"
        color="gray"
        size={compact ? 'sm' : 'md'}
        radius="xl"
        onClick={openClientIdSettings}
        aria-label="הגדרת Google Client ID"
      >
        <IconSettings size={16} />
      </ActionIcon>
    </Tooltip>
  );

  const statusBadge = (
    <Badge color={isConnected ? 'emerald' : 'gray'} variant="light" radius="sm">
      {isConnected ? 'מחובר' : 'לא מחובר'}
    </Badge>
  );

  const controls = !isConnected ? (
    <Group gap={4} wrap="wrap">
      <Button
        variant="light"
        color="blue"
        size={size}
        radius="xl"
        leftSection={
          isConnecting || isLoadingScript ? (
            <Loader size={14} color="blue" />
          ) : (
            <IconBrandGoogleDrive size={16} />
          )
        }
        onClick={handleSignInClick}
        disabled={!isReady || isConnecting || isLoadingScript}
        aria-label="התחבר ל-Google Drive"
      >
        התחבר ל-Google Drive
      </Button>
      {!embedded && settingsButton}
      {embedded && (
        <Button variant="subtle" color="gray" size={size} radius="xl" onClick={openClientIdSettings}>
          הגדרת Client ID
        </Button>
      )}
    </Group>
  ) : (
    <Group gap="xs" wrap="wrap">
      <Button
        variant="light"
        color="emerald"
        size={size}
        radius="xl"
        leftSection={
          isBusy ? <Loader size={14} color="emerald" /> : <IconCloudUpload size={16} />
        }
        onClick={() => {
          void handleBackup();
        }}
        disabled={isBusy}
        aria-label="גבה עכשיו ל-Google Drive"
      >
        גבה עכשיו
      </Button>
      <Button
        variant="light"
        color="blue"
        size={size}
        radius="xl"
        leftSection={
          isBusy ? <Loader size={14} color="blue" /> : <IconCloudDownload size={16} />
        }
        onClick={() => {
          void handleRestoreClick();
        }}
        disabled={isBusy}
        aria-label="שחזר מגיבוי Google Drive"
      >
        שחזר מגיבוי
      </Button>
      <Button
        variant="subtle"
        color="gray"
        size={size}
        radius="xl"
        leftSection={<IconLogout size={16} />}
        onClick={() => {
          void handleSignOut();
        }}
        disabled={isBusy}
        aria-label="התנתק מ-Google Drive"
      >
        התנתק
      </Button>
      {!embedded && settingsButton}
      {embedded && (
        <Button variant="subtle" color="gray" size={size} radius="xl" onClick={openClientIdSettings}>
          הגדרת Client ID
        </Button>
      )}
    </Group>
  );

  const backupDateLabel =
    pendingRestore !== null ? formatDriveBackupExportedAt(pendingRestore.exportedAt) : '';

  return (
    <>
      {embedded ? (
        <Stack gap="sm">
          <Group gap="xs" justify="space-between" wrap="wrap">
            <Text fz="sm" c="dimmed">
              סטטוס חיבור
            </Text>
            {statusBadge}
          </Group>
          {controls}
        </Stack>
      ) : (
        controls
      )}

      <Modal
        opened={pendingRestore !== null}
        onClose={closeRestoreConfirm}
        title="שחזור מגיבוי Google Drive"
        centered
      >
        <Stack gap="md">
          <Text fz="sm">
            פעולה זו תחליף את כל הנתונים המקומיים בגיבוי מ-{backupDateLabel} — כולל חודשים, קטגוריות,
            זיכרון עסקים, יעדים ומפתח ה-AI (OpenRouter). Google Client ID לא יוחלף. הנתונים הנוכחיים
            במכשיר יימחקו לחלוטין (לא ימוזגו). הפעולה אינה ניתנת לביטול.
          </Text>
          <Group justify="flex-end" gap="xs">
            <Button variant="default" radius="xl" onClick={closeRestoreConfirm}>
              ביטול
            </Button>
            <Button
              color="blue"
              radius="xl"
              leftSection={<IconCloudDownload size={16} />}
              onClick={handleRestoreConfirm}
            >
              כן, שחזר מהגיבוי
            </Button>
          </Group>
        </Stack>
      </Modal>

      <GoogleClientIdModal
        opened={clientIdOpened}
        onClose={() => {
          setClientIdOpened(false);
          setConnectAfterSave(false);
        }}
        onSaved={handleClientIdSaved}
      />
    </>
  );
}
