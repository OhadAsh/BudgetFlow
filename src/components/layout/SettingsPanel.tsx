import { useState } from 'react';
import {
  ActionIcon,
  Alert,
  Box,
  Button,
  Divider,
  Drawer,
  Group,
  Modal,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconAlertTriangle,
  IconDownload,
  IconSettings,
  IconTags,
  IconTrash,
} from '@tabler/icons-react';
import { clearAllUserData } from '../../lib/clearUserData';
import { COLORS } from '../../lib/constants';
import {
  buildExportFileName,
  downloadWorkbook,
  exportBackupWorkbook,
} from '../../lib/excelParser';
import { useExpenseStore } from '../../store/useExpenseStore';
import { CategoryManager } from '../categories/CategoryManager';
import { GoogleDriveBackup } from '../excel/GoogleDriveBackup';
import { LocalDataBackup } from '../excel/LocalDataBackup';
import { ThemeModeSettings } from './ThemeModeSelect';

type DeleteStep = null | 1 | 2;

interface SettingsPanelProps {
  opened: boolean;
  onClose: () => void;
}

function SectionHeader({ title }: { title: string }): JSX.Element {
  return (
    <Title order={5} c="dimmed" tt="uppercase" fz="xs" fw={700} lts={0.4}>
      {title}
    </Title>
  );
}

export function SettingsPanel({ opened, onClose }: SettingsPanelProps): JSX.Element {
  const months = useExpenseStore((state) => state.months);
  const customCategories = useExpenseStore((state) => state.customCategories);
  const merchantMemory = useExpenseStore((state) => state.merchantMemory);
  const categoryTargets = useExpenseStore((state) => state.categoryTargets);

  const [deleteStep, setDeleteStep] = useState<DeleteStep>(null);
  const [categoriesOpen, setCategoriesOpen] = useState<boolean>(false);

  const closeDelete = (): void => {
    setDeleteStep(null);
  };

  const exportAllToExcel = (): void => {
    const merchantCount = Object.keys(merchantMemory).length;
    const targetCount = Object.keys(categoryTargets).length;
    if (
      months.length === 0 &&
      customCategories.length === 0 &&
      merchantCount === 0 &&
      targetCount === 0
    ) {
      notifications.show({
        color: 'yellow',
        title: 'אין נתונים לייצוא',
        message: 'הוסף הכנסות, הוצאות או הגדרות לפני ייצוא לאקסל.',
      });
      return;
    }

    try {
      downloadWorkbook(
        exportBackupWorkbook(months, customCategories, merchantMemory, categoryTargets),
        buildExportFileName()
      );
      const parts: string[] = [];
      if (months.length > 0) {
        parts.push(`${months.length} גיליונות חודשיים`);
      }
      parts.push('קטגוריות מותאמות וזיכרון עסקים');
      if (targetCount > 0) {
        parts.push('יעדי קטגוריות');
      }
      notifications.show({
        color: 'emerald',
        title: 'הגיבוי הושלם',
        message: `נוצר קובץ אקסל עם ${parts.join(' ועם ')}.`,
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
    closeDelete();
    onClose();
    notifications.show({
      color: 'emerald',
      title: 'הצלחה',
      message: 'כל הנתונים נמחקו בהצלחה, כולל מפתח ה-AI ו-Google Client ID',
    });
  };

  const openCategories = (): void => {
    setCategoriesOpen(true);
  };

  return (
    <>
      <Drawer
        opened={opened}
        onClose={onClose}
        title="הגדרות"
        position="left"
        size="md"
        padding="md"
      >
        <Stack gap="lg">
          <Stack gap="sm">
            <SectionHeader title="קטגוריות" />
            <Button
              variant="filled"
              color="violet"
              size="md"
              radius="xl"
              leftSection={<IconTags size={20} />}
              onClick={openCategories}
              aria-label="ניהול קטגוריות"
              fullWidth
              styles={{
                root: {
                  height: 'auto',
                  paddingBlock: 14,
                  justifyContent: 'flex-start',
                },
                inner: {
                  justifyContent: 'flex-start',
                },
                label: {
                  whiteSpace: 'normal',
                  textAlign: 'start',
                },
              }}
            >
              <Stack gap={2} align="flex-start">
                <Text fw={700} fz="sm" c="inherit" lh={1.3}>
                  ניהול קטגוריות
                </Text>
                <Text fz="xs" c="violet.1" fw={400} lh={1.3}>
                  התאם קטגוריות, אימוג׳ים וצבעים
                </Text>
              </Stack>
            </Button>
          </Stack>

          <Divider />

          <Stack gap="sm">
            <SectionHeader title="עיצוב" />
            <ThemeModeSettings />
          </Stack>

          <Divider />

          <Stack gap="sm">
            <SectionHeader title="נתונים וגיבוי" />
            <LocalDataBackup embedded />
            <Divider />
            <Text fw={600} fz="sm">
              Google Drive
            </Text>
            <GoogleDriveBackup embedded />
          </Stack>

          <Divider />

          <Box
            p="md"
            style={{
              backgroundColor: COLORS.dangerBg,
              border: `1px solid ${COLORS.expense}`,
              borderRadius: 'var(--mantine-radius-lg)',
            }}
          >
            <Stack gap="sm">
              <SectionHeader title="אזור מסוכן" />
              <Text fz="sm" c="dimmed">
                פעולות בלתי־הפיכות שמוחקות נתונים לצמיתות.
              </Text>
              <Button
                color="red"
                variant="light"
                radius="xl"
                leftSection={<IconTrash size={16} />}
                onClick={() => setDeleteStep(1)}
                aria-label="מחק הכל"
                fullWidth
              >
                מחק הכל
              </Button>
            </Stack>
          </Box>
        </Stack>
      </Drawer>

      <CategoryManager
        hideTrigger
        opened={categoriesOpen}
        onOpenedChange={setCategoriesOpen}
      />

      <Modal
        opened={deleteStep === 1}
        onClose={closeDelete}
        title="מחיקת כל הנתונים"
        centered
      >
        <Stack gap="md">
          <Alert
            color="red"
            icon={<IconAlertTriangle size={18} />}
            title="פעולה בלתי הפיכה"
          >
            פעולה זו תמחק את כל ההוצאות, ההכנסות, מפתח ה-AI, Google Client ID והתובנות השמורות.
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
            <Button variant="default" radius="xl" onClick={closeDelete}>
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
        onClose={closeDelete}
        title="אישור סופי"
        size="sm"
        centered
      >
        <Stack gap="xs">
          <Text ta="center" fw={600} size="lg">
            האם אתה בטוח לחלוטין?
          </Text>
          <Text ta="center" c="dimmed" size="sm" mt="xs">
            כל הנתונים, כולל מפתח ה-AI ו-Google Client ID, יימחקו לצמיתות
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

interface SettingsGearButtonProps {
  onClick: () => void;
}

export function SettingsGearButton({ onClick }: SettingsGearButtonProps): JSX.Element {
  return (
    <ActionIcon
      variant="light"
      color="gray"
      size="md"
      radius="xl"
      onClick={onClick}
      aria-label="הגדרות"
    >
      <IconSettings size={18} />
    </ActionIcon>
  );
}
