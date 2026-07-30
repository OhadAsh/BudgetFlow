import { useState } from 'react';
import {
  Alert,
  Button,
  Divider,
  Group,
  Modal,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconAlertTriangle,
  IconDownload,
  IconTrash,
  IconUpload,
} from '@tabler/icons-react';
import type { ExcelParseResult } from '../../types';
import { COLORS } from '../../lib/constants';
import { clearAllUserData } from '../../lib/clearUserData';
import {
  buildExportFileName,
  downloadWorkbook,
  exportToWorkbook,
  parseExcelFile,
} from '../../lib/excelParser';
import { applySettingsImport } from '../../lib/settingsImport';
import { formatCurrency, formatMonthYear } from '../../lib/utils';
import { useExpenseStore } from '../../store/useExpenseStore';
import { ExcelFileDropArea } from './ExcelFileDropArea';

interface ExcelControlsProps {
  compact?: boolean;
}

export function ExcelControls({ compact = false }: ExcelControlsProps): JSX.Element {
  const months = useExpenseStore((state) => state.months);
  const customCategories = useExpenseStore((state) => state.customCategories);
  const merchantMemory = useExpenseStore((state) => state.merchantMemory);
  const importFromExcel = useExpenseStore((state) => state.importFromExcel);
  const applyImportedSettings = useExpenseStore((state) => state.applyImportedSettings);

  const [importOpen, setImportOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<ExcelParseResult | null>(null);
  const [confirmingReset, setConfirmingReset] = useState<boolean>(false);

  const handleExport = (): void => {
    if (months.length === 0) {
      notifications.show({
        color: 'yellow',
        title: 'אין נתונים לייצוא',
        message: 'הוסף הכנסות או הוצאות לפני ייצוא לאקסל.',
      });
      return;
    }

    try {
      downloadWorkbook(
        exportToWorkbook(months, customCategories, merchantMemory),
        buildExportFileName()
      );
      notifications.show({
        color: 'emerald',
        title: 'הייצוא הושלם',
        message: `נוצר קובץ אקסל עם ${months.length} גיליונות חודשיים ועם הגדרות.`,
      });
    } catch {
      notifications.show({
        color: 'red',
        title: 'שגיאה',
        message: 'ייצוא הקובץ נכשל. נסה שוב.',
      });
    }
  };

  const handleReject = (): void => {
    notifications.show({
      color: 'red',
      title: 'שגיאה',
      message: 'ניתן להעלות קבצי אקסל בפורמט xlsx בלבד.',
    });
  };

  const handleFile = async (file: File): Promise<void> => {
    setLoading(true);
    try {
      const parsed = await parseExcelFile(file, months);
      setResult(parsed);
      if (parsed.skippedSheets.length > 0) {
        notifications.show({
          color: 'yellow',
          title: 'חלק מהגיליונות דולגו',
          message: `לא ניתן לקרוא: ${parsed.skippedSheets.join(', ')}`,
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'הקובץ אינו תקין או שאינו בפורמט xlsx.';
      notifications.show({ color: 'red', title: 'שגיאה', message });
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmImport = (): void => {
    if (!result) return;
    importFromExcel(result.months);

    if (result.settings !== null) {
      const applied = applySettingsImport(
        customCategories,
        merchantMemory,
        result.settings,
        'merge'
      );
      applyImportedSettings(applied.customCategories, applied.merchantMemory);
    }

    const creditTotal = result.preview.reduce((sum, row) => sum + row.creditCount, 0);
    const creditNote =
      creditTotal > 0 ? ` כולל ${creditTotal} זיכויים (סכומים שליליים שמקטינים הוצאות).` : '';

    notifications.show({
      color: 'emerald',
      title: 'הייבוא הושלם',
      message: `${result.months.length} חודשים עודכנו מתוך הקובץ.${creditNote}`,
    });
    closeImport();
  };

  const closeImport = (): void => {
    setImportOpen(false);
    setResult(null);
    setConfirmingReset(false);
  };

  const handleReset = (): void => {
    clearAllUserData();
    setConfirmingReset(false);
    closeImport();
    notifications.show({
      color: 'red',
      title: 'הנתונים נמחקו',
      message: 'כל הנתונים המקומיים הוסרו מהדפדפן, כולל מפתח ה-AI.',
    });
  };

  const totalCredits =
    result?.preview.reduce((sum, row) => sum + row.creditCount, 0) ?? 0;

  return (
    <>
      <Group gap="xs" wrap="nowrap">
        <Button
          variant="light"
          color="emerald"
          size={compact ? 'xs' : 'sm'}
          leftSection={<IconDownload size={16} />}
          onClick={handleExport}
          aria-label="ייצוא לאקסל"
        >
          ייצוא
        </Button>
        <Button
          variant="light"
          color="gray"
          size={compact ? 'xs' : 'sm'}
          leftSection={<IconUpload size={16} />}
          onClick={() => setImportOpen(true)}
          aria-label="ייבוא מאקסל"
        >
          ייבוא
        </Button>
      </Group>

      <Modal opened={importOpen} onClose={closeImport} title="ייבוא נתונים מאקסל" size="lg">
        <Stack gap="md">
          {result === null ? (
            <>
              <ExcelFileDropArea
                loading={loading}
                title="גרור לכאן קובץ xlsx או לחץ לבחירה"
                subtitle='שם כל גיליון צריך להיות בפורמט "ינואר 2026". חודש שקיים במערכת יוחלף בנתוני הקובץ.'
                onFiles={(files) => {
                  const file = files[0];
                  if (file) {
                    void handleFile(file);
                  }
                }}
                onInvalid={handleReject}
              />

              <Divider color={COLORS.border} />

              {confirmingReset ? (
                <Alert color="red" icon={<IconAlertTriangle size={18} />} title="מחיקת כל הנתונים">
                  <Stack gap="xs">
                    <Text fz="sm">
                      הפעולה תמחק את כל החודשים, מפתח ה-AI והתובנות השמורות מהדפדפן ואינה ניתנת
                      לשחזור.
                    </Text>
                    <Group gap="xs">
                      <Button color="red" size="xs" onClick={handleReset}>
                        כן, מחק הכול
                      </Button>
                      <Button
                        variant="subtle"
                        color="gray"
                        size="xs"
                        onClick={() => setConfirmingReset(false)}
                      >
                        ביטול
                      </Button>
                    </Group>
                  </Stack>
                </Alert>
              ) : (
                <Button
                  variant="subtle"
                  color="red"
                  size="xs"
                  leftSection={<IconTrash size={15} />}
                  onClick={() => setConfirmingReset(true)}
                >
                  מחיקת כל הנתונים
                </Button>
              )}
            </>
          ) : (
            <>
              <Text fz="sm" c={COLORS.textSecondary}>
                נמצאו {result.months.length} חודשים בקובץ. בדוק את הנתונים לפני האישור.
              </Text>
              {totalCredits > 0 && (
                <Alert color="blue" title="זיכויים בקובץ">
                  <Text fz="sm">
                    {`זוהו ${totalCredits} שורות עם סכום שלילי (זיכויים/החזרים). הן יישמרו ויקטינו את סך ההוצאות — לא יימחקו.`}
                  </Text>
                </Alert>
              )}
              {result.settings !== null && (
                <Alert color="gray" title="הגדרות בקובץ">
                  <Text fz="sm">
                    {`ייובאו גם ${result.settings.categories.length} קטגוריות מותאמות ו-${result.settings.merchants.length} עסקים בזיכרון (מיזוג עם הקיים).`}
                  </Text>
                </Alert>
              )}
              <Table verticalSpacing="xs" horizontalSpacing="sm" highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>חודש</Table.Th>
                    <Table.Th>הכנסות</Table.Th>
                    <Table.Th>הוצאות</Table.Th>
                    <Table.Th>שורות</Table.Th>
                    <Table.Th>מצב</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {result.preview.map((row) => (
                    <Table.Tr key={`${row.year}-${row.month}`}>
                      <Table.Td>
                        <Text fz="sm" fw={600}>
                          {formatMonthYear(row.year, row.month)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text fz="sm" c={COLORS.income}>
                          {formatCurrency(row.totalIncome)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text fz="sm" c={COLORS.expense}>
                          {formatCurrency(row.totalExpenses)}
                        </Text>
                        {row.creditCount > 0 && (
                          <Text fz="xs" c="blue">
                            {`${row.creditCount} זיכויים`}
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Text fz="sm" c={COLORS.textSecondary}>
                          {`${row.incomeCount} + ${row.expenseCount}`}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text fz="xs" c={row.isReplacing ? COLORS.amber : COLORS.textSecondary}>
                          {row.isReplacing ? 'יחליף נתונים קיימים' : 'חודש חדש'}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>

              <Group justify="flex-end" gap="xs">
                <Button variant="subtle" color="gray" onClick={() => setResult(null)}>
                  בחר קובץ אחר
                </Button>
                <Button color="emerald" onClick={handleConfirmImport}>
                  אישור וייבוא
                </Button>
              </Group>
            </>
          )}
        </Stack>
      </Modal>
    </>
  );
}
