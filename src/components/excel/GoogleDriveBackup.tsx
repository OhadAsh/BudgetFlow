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
import {
  DriveApiDisabledError,
  DriveNetworkError,
  DriveNotFoundError,
  DriveParseError,
  formatDriveBackupExportedAt,
  type DriveBackupDownload,
} from '../../lib/googleDrive';
import { buildLocalJsonBackupFileName, downloadJsonBackup } from '../../lib/localBackup';
import { formatMonthYear } from '../../lib/utils';
import { useGoogleDriveStore } from '../../store/useGoogleDriveStore';
import { DriveConflictModal } from './DriveConflictModal';
import { GoogleClientIdModal } from './GoogleClientIdModal';

const REMOTE_NEWER_NOTIFY_ID = 'drive-remote-newer';

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
    applyRestore,
    checkRemoteState,
  } = useGoogleDrive();

  const conflictOpen = useGoogleDriveStore((state) => state.conflictOpen);
  const setConflictOpen = useGoogleDriveStore((state) => state.setConflictOpen);

  const [pendingRestore, setPendingRestore] = useState<DriveBackupDownload | null>(null);
  const [conflictModifiedTime, setConflictModifiedTime] = useState<string | null>(null);
  const [clientIdOpened, setClientIdOpened] = useState<boolean>(false);
  const [connectAfterSave, setConnectAfterSave] = useState<boolean>(false);
  const size = compact ? 'xs' : 'sm';

  const openConflict = (remoteModifiedTime: string | null): void => {
    notifications.hide(REMOTE_NEWER_NOTIFY_ID);
    setConflictModifiedTime(remoteModifiedTime);
    setConflictOpen(true);
  };

  const closeConflict = (): void => {
    setConflictOpen(false);
    setConflictModifiedTime(null);
  };

  /** Loads the Drive copy over the local state and records the sync. */
  const loadRemoteIntoApp = async (): Promise<void> => {
    const download = await fetchBackup();
    applyRestore(download);
    notifications.show({
      color: 'emerald',
      title: 'נטען מ-Drive',
      message: `הנתונים המקומיים הוחלפו בגיבוי מ-${formatDriveBackupExportedAt(download.payload.exportedAt)}.`,
    });
  };

  /**
   * Right after connecting: compare with Drive before anything can upload.
   * Remote-only changes get a dismissible offer; two-sided changes get the modal.
   */
  const runPostConnectCheck = async (): Promise<void> => {
    try {
      const remote = await checkRemoteState();
      if (!remote.hasRemote || !remote.remoteIsNewer) {
        return;
      }

      if (remote.hasLocalChanges) {
        openConflict(remote.remoteModifiedTime);
        return;
      }

      notifications.show({
        id: REMOTE_NEWER_NOTIFY_ID,
        color: 'blue',
        title: 'יש ב-Drive גיבוי חדש יותר',
        autoClose: false,
        withCloseButton: true,
        message: (
          <Stack gap="xs" align="flex-start">
            <Text fz="sm">
              {remote.remoteModifiedTime !== null
                ? `הגיבוי ב-Drive עודכן ב-${formatDriveBackupExportedAt(remote.remoteModifiedTime)} ואין שינויים מקומיים שלא גובו.`
                : 'הגיבוי ב-Drive עודכן ואין שינויים מקומיים שלא גובו.'}
            </Text>
            <Button
              size="xs"
              radius="xl"
              color="blue"
              leftSection={<IconCloudDownload size={14} />}
              onClick={() => {
                notifications.hide(REMOTE_NEWER_NOTIFY_ID);
                void loadRemoteIntoApp().catch((error: unknown) => {
                  notifications.show({
                    color: 'red',
                    title: 'שגיאה בשחזור',
                    message: errorMessage(error),
                  });
                });
              }}
            >
              טען מ-Drive
            </Button>
          </Stack>
        ),
      });
    } catch (error) {
      notifications.show({
        color: 'yellow',
        title: 'לא ניתן לבדוק את מצב הגיבוי ב-Drive',
        message: errorMessage(error),
      });
    }
  };

  const runSignIn = async (): Promise<void> => {
    try {
      await signIn();
      notifications.show({
        color: 'emerald',
        title: 'מחובר ל-Google Drive',
        message: 'אפשר לגבות ולשחזר את הנתונים בענן.',
      });
      await runPostConnectCheck();
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

  const handleBackup = async (force = false): Promise<void> => {
    try {
      const outcome = await backupNow(force ? { force: true } : undefined);

      if (outcome.status === 'blocked') {
        return;
      }

      if (outcome.status === 'conflict') {
        openConflict(outcome.remoteModifiedTime);
        return;
      }

      closeConflict();
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
      const download = await fetchBackup();
      setPendingRestore(download);
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
    const download = pendingRestore;
    applyRestore(download);
    setPendingRestore(null);
    const payload = download.payload;
    const periodLabel = formatMonthYear(payload.selectedYear, payload.selectedMonth);
    const backupDate = formatDriveBackupExportedAt(payload.exportedAt);
    notifications.show({
      color: 'emerald',
      title: 'השחזור הושלם',
      message: `כל הנתונים המקומיים הוחלפו בגיבוי מ-${backupDate} (${payload.months.length} חודשים). התקופה הנבחרת: ${periodLabel}.`,
    });
  };

  const handleConflictLoadRemote = async (): Promise<void> => {
    try {
      await loadRemoteIntoApp();
      closeConflict();
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'שגיאה בשחזור',
        message: errorMessage(error),
      });
    }
  };

  const handleConflictDownloadCopy = async (): Promise<void> => {
    try {
      const download = await fetchBackup();
      downloadJsonBackup(download.payload, buildLocalJsonBackupFileName());
      closeConflict();
      notifications.show({
        color: 'emerald',
        title: 'עותק של Drive הורד',
        message: 'הקובץ נשמר בתיקיית ההורדות. לא בוצע שינוי בנתונים המקומיים ולא ב-Drive.',
      });
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'שגיאה בהורדת הגיבוי',
        message: errorMessage(error),
      });
    }
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
    pendingRestore !== null
      ? formatDriveBackupExportedAt(pendingRestore.payload.exportedAt)
      : '';

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

      <DriveConflictModal
        opened={conflictOpen}
        remoteModifiedTime={conflictModifiedTime}
        busy={isBusy}
        onClose={closeConflict}
        onLoadRemote={() => {
          void handleConflictLoadRemote();
        }}
        onOverwriteRemote={() => {
          void handleBackup(true);
        }}
        onDownloadRemoteCopy={() => {
          void handleConflictDownloadCopy();
        }}
      />

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
