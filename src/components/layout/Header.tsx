import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Group,
  Modal,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core';

import { notifications } from '@mantine/notifications';
import {
  IconAlertTriangle,
  IconDownload,
  IconTrash,
  IconWallet,
} from '@tabler/icons-react';
import { COLORS } from '../../lib/constants';
import { clearAllUserData } from '../../lib/clearUserData';
import {
  buildExportFileName,
  downloadWorkbook,
  exportToWorkbook,
} from '../../lib/excelParser';
import { useExpenseStore } from '../../store/useExpenseStore';
import { YearSelector } from '../annual/YearSelector';
import { BankImportModal } from '../excel/BankImportModal';
import { ExcelControls } from '../excel/ExcelControls';

type DeleteStep = null | 1 | 2;

export function Header(): JSX.Element {
  const months = useExpenseStore((state) => state.months);

  const [deleteStep, setDeleteStep] = useState<DeleteStep>(null);

  const closeAll = (): void => {
    setDeleteStep(null);
  };

  const exportAllToExcel = (): void => {
    if (months.length === 0) {
      notifications.show({
        color: 'yellow',
        title: 'אין נתונים לייצוא',
        message: 'הוסף הכנסות או הוצאות לפני ייצוא לאקסל.',
      });
      return;
    }

    try {
      downloadWorkbook(exportToWorkbook(months), buildExportFileName());
      notifications.show({
        color: 'emerald',
        title: 'הגיבוי הושלם',
        message: `נוצר קובץ אקסל עם ${months.length} גיליונות חודשיים.`,
      });
    } catch {
      notifications.show({
        color: 'red',
        title: 'שגיאה',
        message: 'ייצוא הקובץ נכשל. נסה שוב.',
      });
    }
  };

  const handleNuclearDelete = (): void => {
    clearAllUserData();
    closeAll();
    notifications.show({
      color: 'emerald',
      title: 'הצלחה',
      message: 'כל הנתונים נמחקו בהצלחה, כולל מפתח ה-AI',
    });
  };

  return (
    <>
      <Box
        component="header"
        bg={COLORS.cardBg}
        px={{ base: 'md', sm: 'xl' }}
        py="sm"
        style={{ borderBottom: `1px solid ${COLORS.border}` }}
      >
        <Group justify="space-between" wrap="nowrap" gap="sm">
          <Group gap="sm" wrap="nowrap">
            <ThemeIcon size={40} radius="lg" color="emerald" variant="light">
              <IconWallet size={22} />
            </ThemeIcon>
            <Stack gap={0}>
              <Text fw={700} fz="lg" c={COLORS.textPrimary} style={{ lineHeight: 1.2 }}>
                מעקב הוצאות
              </Text>
              <Text fz="xs" c={COLORS.textSecondary}>
                תכנון פיננסי אישי
              </Text>
            </Stack>
          </Group>

          <Group gap="md" wrap="nowrap">
            <Group gap="xs" wrap="nowrap">
              <Box visibleFrom="xs">
                <YearSelector size="sm" width={116} />
              </Box>
              <BankImportModal mode="card" />
              <BankImportModal mode="bank" />
              <ExcelControls compact />
            </Group>

            <Button
              color="red"
              variant="subtle"
              radius="xl"
              size="xs"
              leftSection={<IconTrash size={16} />}
              onClick={() => setDeleteStep(1)}
              aria-label="מחק הכל"
            >
              מחק הכל
            </Button>
          </Group>
        </Group>
      </Box>

      <Modal
        opened={deleteStep === 1}
        onClose={closeAll}
        title="מחיקת כל הנתונים"
        centered
      >
        <Stack gap="md">
          <Alert
            color="red"
            icon={<IconAlertTriangle size={18} />}
            title="פעולה בלתי הפיכה"
          >
            פעולה זו תמחק את כל ההוצאות, ההכנסות, מפתח ה-AI והתובנות השמורות.
            לא ניתן לשחזר את הנתונים לאחר המחיקה.
          </Alert>

          <Text>מומלץ לגבות את הנתונים לפני המחיקה:</Text>
          <Button
            leftSection={<IconDownload size={16} />}
            variant="light"
            color="blue"
            radius="xl"
            onClick={exportAllToExcel}
          >
            גיבוי לאקסל לפני מחיקה
          </Button>

          <Group mt="xl" justify="space-between">
            <Button variant="default" radius="xl" onClick={closeAll}>
              ביטול
            </Button>
            <Button color="red" radius="xl" onClick={() => setDeleteStep(2)}>
              אני מבין, המשך למחיקה
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={deleteStep === 2}
        onClose={closeAll}
        title="אישור סופי"
        size="sm"
        centered
      >
        <Stack gap="xs">
          <Text ta="center" fw={600} size="lg">
            האם אתה בטוח לחלוטין?
          </Text>
          <Text ta="center" c="dimmed" size="sm" mt="xs">
            כל הנתונים, כולל מפתח ה-AI, יימחקו לצמיתות
          </Text>
          <Group mt="xl" justify="center">
            <Button variant="default" radius="xl" onClick={() => setDeleteStep(1)}>
              חזור
            </Button>
            <Button
              color="red"
              variant="filled"
              radius="xl"
              leftSection={<IconTrash size={16} />}
              onClick={handleNuclearDelete}
            >
              מחק הכל סופית
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
