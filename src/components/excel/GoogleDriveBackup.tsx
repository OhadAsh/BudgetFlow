import { useState } from 'react';
import { ActionIcon, Button, Group, Loader, Modal, Stack, Text, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconBrandGoogleDrive,
  IconCloudDownload,
  IconCloudUpload,
  IconLogout,
  IconSettings,
} from '@tabler/icons-react';
import { useGoogleDrive } from '../../hooks/useGoogleDrive';
import {
  DriveNetworkError,
  DriveNotFoundError,
  DriveParseError,
} from '../../lib/googleDrive';
import { formatMonthYear } from '../../lib/utils';
import { useExpenseStore } from '../../store/useExpenseStore';
import { GoogleClientIdModal } from './GoogleClientIdModal';

interface GoogleDriveBackupProps {
  compact?: boolean;
}

function errorMessage(error: unknown): string {
  if (
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

export function GoogleDriveBackup({ compact = false }: GoogleDriveBackupProps): JSX.Element {
  const restoreFromBackup = useExpenseStore((state) => state.restoreFromBackup);
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

  const [confirmRestore, setConfirmRestore] = useState<boolean>(false);
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

  const handleRestoreConfirm = async (): Promise<void> => {
    try {
      const payload = await fetchBackup();
      restoreFromBackup(payload);
      setConfirmRestore(false);
      const periodLabel = formatMonthYear(payload.selectedYear, payload.selectedMonth);
      notifications.show({
        color: 'emerald',
        title: 'השחזור הושלם',
        message: `הנתונים שוחזרו מ-Drive (${payload.months.length} חודשים). התקופה הנבחרת: ${periodLabel}.`,
      });
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'שגיאה בשחזור',
        message: errorMessage(error),
      });
    }
  };

  const settingsButton = (
    <Tooltip label="הגדרת Google Client ID" withArrow>
      <ActionIcon
        variant="subtle"
        color="gray"
        size={compact ? 'sm' : 'md'}
        radius="xl"
        onClick={() => {
          setConnectAfterSave(false);
          setClientIdOpened(true);
        }}
        aria-label="הגדרת Google Client ID"
      >
        <IconSettings size={16} />
      </ActionIcon>
    </Tooltip>
  );

  return (
    <>
      {!isConnected ? (
        <Group gap={4} wrap="nowrap">
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
          {settingsButton}
        </Group>
      ) : (
        <Group gap="xs" wrap="nowrap">
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
            onClick={() => setConfirmRestore(true)}
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
          {settingsButton}
        </Group>
      )}

      <Modal
        opened={confirmRestore}
        onClose={() => setConfirmRestore(false)}
        title="שחזור מגיבוי Google Drive"
        centered
      >
        <Stack gap="md">
          <Text fz="sm">
            השחזור יחליף את כל הנתונים המקומיים (חודשים, קטגוריות, זיכרון עסקים ויעדים) בתוכן
            קובץ הגיבוי מ-Drive. הפעולה אינה ניתנת לביטול.
          </Text>
          <Group justify="flex-end" gap="xs">
            <Button
              variant="default"
              radius="xl"
              onClick={() => setConfirmRestore(false)}
              disabled={isBusy}
            >
              ביטול
            </Button>
            <Button
              color="blue"
              radius="xl"
              leftSection={
                isBusy ? <Loader size={14} color="white" /> : <IconCloudDownload size={16} />
              }
              onClick={() => {
                void handleRestoreConfirm();
              }}
              disabled={isBusy}
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
