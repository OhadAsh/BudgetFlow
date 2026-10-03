import { useEffect, useState } from 'react';
import { Alert, Button, Loader, Modal, Stack, Text } from '@mantine/core';
import {
  IconAlertTriangle,
  IconCloudDownload,
  IconCloudUpload,
  IconDownload,
} from '@tabler/icons-react';
import { formatDriveBackupExportedAt } from '../../lib/googleDrive';

interface DriveConflictModalProps {
  opened: boolean;
  /** Drive `modifiedTime` of the newer remote file, when known. */
  remoteModifiedTime: string | null;
  busy: boolean;
  onClose: () => void;
  /** Replace the local data with the Drive copy. */
  onLoadRemote: () => void;
  /** Upload the local data anyway, discarding the Drive copy. */
  onOverwriteRemote: () => void;
  /** Save the Drive copy to the Downloads folder without changing anything. */
  onDownloadRemoteCopy: () => void;
}

/**
 * Shown when Drive holds a backup newer than the one this device last synced.
 * The user picks explicitly — the app never resolves the conflict on its own.
 */
export function DriveConflictModal({
  opened,
  remoteModifiedTime,
  busy,
  onClose,
  onLoadRemote,
  onOverwriteRemote,
  onDownloadRemoteCopy,
}: DriveConflictModalProps): JSX.Element {
  const [confirmingOverwrite, setConfirmingOverwrite] = useState<boolean>(false);

  useEffect(() => {
    if (!opened) {
      setConfirmingOverwrite(false);
    }
  }, [opened]);

  const remoteLabel =
    remoteModifiedTime !== null ? formatDriveBackupExportedAt(remoteModifiedTime) : null;

  return (
    <Modal
      opened={opened}
      onClose={() => {
        if (!busy) onClose();
      }}
      title="הגיבוי ב-Drive חדש יותר"
      centered
      closeOnClickOutside={!busy}
      closeOnEscape={!busy}
    >
      <Stack gap="md">
        <Alert color="yellow" icon={<IconAlertTriangle size={18} />}>
          <Text fz="sm">
            {remoteLabel !== null
              ? `הקובץ ב-Google Drive עודכן ב-${remoteLabel}, אחרי הסנכרון האחרון במכשיר הזה.`
              : 'הקובץ ב-Google Drive עודכן אחרי הסנכרון האחרון במכשיר הזה.'}{' '}
            העלאה עכשיו תדרוס את הגרסה החדשה יותר. בחר מה לעשות:
          </Text>
        </Alert>

        <Button
          color="blue"
          radius="xl"
          leftSection={busy ? <Loader size={14} color="blue" /> : <IconCloudDownload size={16} />}
          onClick={onLoadRemote}
          disabled={busy}
          fullWidth
        >
          טען מ-Drive
        </Button>
        <Text fz="xs" c="dimmed" mt={-8}>
          הנתונים המקומיים יוחלפו בגרסה שב-Drive.
        </Text>

        <Button
          variant="light"
          color="gray"
          radius="xl"
          leftSection={<IconDownload size={16} />}
          onClick={onDownloadRemoteCopy}
          disabled={busy}
          fullWidth
        >
          הורד עותק של Drive ואל תשנה כלום
        </Button>
        <Text fz="xs" c="dimmed" mt={-8}>
          הקובץ יישמר בתיקיית ההורדות. הנתונים במכשיר וב-Drive יישארו כפי שהם.
        </Text>

        {confirmingOverwrite ? (
          <Alert color="red" icon={<IconAlertTriangle size={18} />} title="אישור דריסה">
            <Stack gap="xs">
              <Text fz="sm">
                הגרסה שב-Drive תימחק ותוחלף בנתונים המקומיים. הפעולה אינה ניתנת לביטול.
              </Text>
              <Button
                color="red"
                size="xs"
                radius="xl"
                leftSection={
                  busy ? <Loader size={12} color="white" /> : <IconCloudUpload size={14} />
                }
                onClick={onOverwriteRemote}
                disabled={busy}
              >
                כן, דרוס את Drive
              </Button>
              <Button
                variant="subtle"
                color="gray"
                size="xs"
                radius="xl"
                onClick={() => setConfirmingOverwrite(false)}
                disabled={busy}
              >
                ביטול
              </Button>
            </Stack>
          </Alert>
        ) : (
          <Button
            variant="subtle"
            color="red"
            radius="xl"
            leftSection={<IconCloudUpload size={16} />}
            onClick={() => setConfirmingOverwrite(true)}
            disabled={busy}
            fullWidth
          >
            דרוס את Drive
          </Button>
        )}
      </Stack>
    </Modal>
  );
}
