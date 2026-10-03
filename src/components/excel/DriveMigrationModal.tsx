import { Alert, Button, Loader, Modal, Stack, Text } from '@mantine/core';
import { IconAlertTriangle, IconFolderShare, IconTrash } from '@tabler/icons-react';

interface DriveMigrationModalProps {
  opened: boolean;
  busy: boolean;
  onClose: () => void;
  /** Copy into the private folder and delete the visible My Drive file. */
  onMigrateAndDelete: () => void;
  /** Copy into the private folder and leave the old My Drive file in place. */
  onMigrateAndKeep: () => void;
}

/**
 * Shown once after connect when a legacy My Drive backup exists but
 * appDataFolder does not yet hold the private backup.
 */
export function DriveMigrationModal({
  opened,
  busy,
  onClose,
  onMigrateAndDelete,
  onMigrateAndKeep,
}: DriveMigrationModalProps): JSX.Element {
  return (
    <Modal
      opened={opened}
      onClose={() => {
        if (!busy) onClose();
      }}
      title="העברת הגיבוי למיקום פרטי"
      centered
      closeOnClickOutside={!busy}
      closeOnEscape={!busy}
    >
      <Stack gap="md">
        <Alert color="blue" icon={<IconAlertTriangle size={18} />}>
          <Text fz="sm">
            נמצא גיבוי ישן של BudgetFlow ב-Google Drive הרגיל שלך. מעכשיו הגיבוי נשמר בתיקיית
            נתונים פרטית של האפליקציה (לא מוצגת ב-«הכונן שלי»). יש להעביר את הגיבוי לשם — בחר אם
            למחוק גם את הקובץ הישן אחרי ההעברה.
          </Text>
        </Alert>

        <Button
          color="blue"
          radius="xl"
          leftSection={busy ? <Loader size={14} color="blue" /> : <IconTrash size={16} />}
          onClick={onMigrateAndDelete}
          disabled={busy}
          fullWidth
        >
          העבר גיבוי ומחק את הקובץ הישן מ-Drive
        </Button>

        <Button
          variant="light"
          color="gray"
          radius="xl"
          leftSection={busy ? <Loader size={14} color="gray" /> : <IconFolderShare size={16} />}
          onClick={onMigrateAndKeep}
          disabled={busy}
          fullWidth
        >
          העבר גיבוי והשאר את הקובץ הישן
        </Button>
      </Stack>
    </Modal>
  );
}
