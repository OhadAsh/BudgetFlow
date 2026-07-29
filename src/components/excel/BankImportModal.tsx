import { useMemo, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Checkbox,
  Group,
  Modal,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconBuildingBank,
  IconCreditCard,
  IconEyeOff,
  IconRestore,
  IconSearch,
} from '@tabler/icons-react';
import type {
  BankImportResult,
  BankIncomeImportResult,
  BankSource,
  CategoryType,
} from '../../types';
import { CATEGORIES, CATEGORY_ICONS, COLORS } from '../../lib/constants';
import {
  UNKNOWN_FORMAT_ERROR,
  collectImportedHashes,
  mergeBankIncomeResults,
  mergeCardImportResults,
  parseBankIncomeFile,
  parseCardFile,
  periodFromIsoDate,
} from '../../lib/excelParser';
import { formatCurrency, formatMonthYear, isCategoryType, isCreditAmount, matchesSearchQuery } from '../../lib/utils';
import { useExpenseStore } from '../../store/useExpenseStore';
import { ExcelFileDropArea } from './ExcelFileDropArea';

const CATEGORY_OPTIONS = CATEGORIES.map((category) => ({
  value: category,
  label: `${CATEGORY_ICONS[category]} ${category}`,
}));

const SOURCE_BADGES: Record<BankSource, { label: string; color: string }> = {
  cal: { label: 'זוהה: כאל ✓', color: 'emerald' },
  max: { label: 'זוהה: מקס ✓', color: 'blue' },
  discount: { label: 'זוהה: בנק דיסקונט (הכנסות בלבד) ✓', color: 'grape' },
};

export type BankImportMode = 'card' | 'bank';

interface BankImportModalProps {
  mode: BankImportMode;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'קריאת הקובץ נכשלה.';
}

/** 12 months back through 3 months forward around the statement's charge month. */
function buildMonthOptions(year: number, month: number): Array<{ value: string; label: string }> {
  const options: Array<{ value: string; label: string }> = [];
  for (let offset = -12; offset <= 3; offset += 1) {
    const date = new Date(Date.UTC(year, month - 1 + offset, 1));
    const optionYear = date.getUTCFullYear();
    const optionMonth = date.getUTCMonth() + 1;
    options.push({
      value: `${optionYear}-${optionMonth.toString().padStart(2, '0')}`,
      label: formatMonthYear(optionYear, optionMonth),
    });
  }
  return options;
}

function mostCommonPeriod(rows: Array<{ date: string }>): { year: number; month: number } | null {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    if (row.date.length === 0) return;
    const key = row.date.slice(0, 7);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  const entries = Array.from(counts.entries());
  if (entries.length === 0) return null;

  const best = entries.reduce((acc, entry) => (entry[1] > acc[1] ? entry : acc));
  const [year, month] = best[0].split('-');
  return { year: Number.parseInt(year, 10), month: Number.parseInt(month, 10) };
}

function parsePeriodValue(value: string): { year: number; month: number } | null {
  const [yearText, monthText] = value.split('-');
  const year = Number.parseInt(yearText, 10);
  const month = Number.parseInt(monthText, 10);
  return Number.isFinite(year) && Number.isFinite(month) ? { year, month } : null;
}

export function BankImportModal({ mode }: BankImportModalProps): JSX.Element {
  const months = useExpenseStore((state) => state.months);
  const addExpense = useExpenseStore((state) => state.addExpense);
  const addIncome = useExpenseStore((state) => state.addIncome);
  const selectedYear = useExpenseStore((state) => state.selectedYear);
  const selectedMonth = useExpenseStore((state) => state.selectedMonth);

  const [opened, setOpened] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [unknownFormat, setUnknownFormat] = useState<boolean>(false);
  const [cardResult, setCardResult] = useState<BankImportResult | null>(null);
  const [bankResult, setBankResult] = useState<BankIncomeImportResult | null>(null);
  const [categoryOverrides, setCategoryOverrides] = useState<Record<string, CategoryType>>({});
  const [skipped, setSkipped] = useState<Record<string, boolean>>({});
  const [uncheckedIncome, setUncheckedIncome] = useState<Record<string, boolean>>({});
  const [targetPeriod, setTargetPeriod] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const existingHashes = useMemo(() => collectImportedHashes(months), [months]);

  const duplicateIds = useMemo(() => {
    const ids = new Set<string>();
    cardResult?.transactions.forEach((transaction) => {
      if (!transaction.isPending && existingHashes.has(transaction.hash)) {
        ids.add(transaction.id);
      }
    });
    return ids;
  }, [cardResult, existingHashes]);

  const pendingCount =
    cardResult?.transactions.filter((transaction) => transaction.isPending).length ?? 0;

  const creditCount =
    cardResult?.transactions.filter(
      (transaction) => !transaction.isPending && isCreditAmount(transaction.chargeAmount)
    ).length ?? 0;

  const importableIds = useMemo(() => {
    return (cardResult?.transactions ?? [])
      .filter(
        (transaction) =>
          !transaction.isPending && !skipped[transaction.id] && !duplicateIds.has(transaction.id)
      )
      .map((transaction) => transaction.id);
  }, [cardResult, skipped, duplicateIds]);

  const importTotal = useMemo(() => {
    const ids = new Set(importableIds);
    return (cardResult?.transactions ?? [])
      .filter((transaction) => ids.has(transaction.id))
      .reduce((total, transaction) => total + transaction.chargeAmount, 0);
  }, [cardResult, importableIds]);

  const filteredCardTransactions = useMemo(() => {
    return (cardResult?.transactions ?? []).filter((transaction) =>
      matchesSearchQuery(
        `${transaction.merchant} ${transaction.branch} ${transaction.dateLabel}`,
        searchQuery
      )
    );
  }, [cardResult, searchQuery]);

  const checkedIncomes = useMemo(() => {
    return (bankResult?.incomes ?? []).filter((income) => uncheckedIncome[income.id] !== true);
  }, [bankResult, uncheckedIncome]);

  const incomeTotal = useMemo(() => {
    return checkedIncomes.reduce((total, income) => total + income.amount, 0);
  }, [checkedIncomes]);

  const filteredIncomes = useMemo(() => {
    return (bankResult?.incomes ?? []).filter((income) =>
      matchesSearchQuery(
        `${income.description} ${income.label} ${income.dateLabel}`,
        searchQuery
      )
    );
  }, [bankResult, searchQuery]);

  const close = (): void => {
    setOpened(false);
    setCardResult(null);
    setBankResult(null);
    setUnknownFormat(false);
    setCategoryOverrides({});
    setSkipped({});
    setUncheckedIncome({});
    setTargetPeriod('');
    setSearchQuery('');
  };

  const applyPeriod = (period: { year: number; month: number }): void => {
    setTargetPeriod(`${period.year}-${period.month.toString().padStart(2, '0')}`);
  };

  const handleReject = (): void => {
    setUnknownFormat(true);
    notifications.show({
      color: 'red',
      title: 'שגיאה',
      message: 'ניתן להעלות קבצי אקסל בפורמט xlsx בלבד.',
    });
  };

  const handleFiles = async (files: File[]): Promise<void> => {
    if (files.length === 0) return;

    setLoading(true);
    setUnknownFormat(false);

    const failures: string[] = [];

    try {
      if (mode === 'bank') {
        const parsedFiles: BankIncomeImportResult[] = [];
        for (const file of files) {
          try {
            parsedFiles.push(await parseBankIncomeFile(file));
          } catch (error) {
            failures.push(`${file.name}: ${errorMessage(error)}`);
          }
        }

        if (parsedFiles.length === 0) {
          const message = failures[0] ?? 'קריאת הקבצים נכשלה.';
          setUnknownFormat(message.startsWith(UNKNOWN_FORMAT_ERROR));
          notifications.show({ color: 'red', title: 'שגיאה', message });
          setBankResult(null);
          return;
        }

        const merged = mergeBankIncomeResults(parsedFiles);
        setBankResult(merged);
        setUncheckedIncome({});
        applyPeriod(
          mostCommonPeriod(merged.incomes) ?? { year: selectedYear, month: selectedMonth }
        );
      } else {
        const parsedFiles: BankImportResult[] = [];
        for (const file of files) {
          try {
            parsedFiles.push(await parseCardFile(file));
          } catch (error) {
            failures.push(`${file.name}: ${errorMessage(error)}`);
          }
        }

        if (parsedFiles.length === 0) {
          const message = failures[0] ?? 'קריאת הקבצים נכשלה.';
          setUnknownFormat(message.startsWith(UNKNOWN_FORMAT_ERROR));
          notifications.show({ color: 'red', title: 'שגיאה', message });
          setCardResult(null);
          return;
        }

        const merged = mergeCardImportResults(parsedFiles);
        setCardResult(merged);
        setCategoryOverrides({});
        setSkipped({});
        applyPeriod(
          merged.chargePeriod ??
            mostCommonPeriod(merged.transactions) ?? { year: selectedYear, month: selectedMonth }
        );
      }

      if (failures.length > 0) {
        notifications.show({
          color: 'yellow',
          title: 'חלק מהקבצים דולגו',
          message: failures.join(' · '),
        });
      }
    } catch (error) {
      const message = errorMessage(error);
      setUnknownFormat(message.startsWith(UNKNOWN_FORMAT_ERROR));
      notifications.show({ color: 'red', title: 'שגיאה', message });
      setCardResult(null);
      setBankResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmExpenses = (): void => {
    if (!cardResult) return;
    const period = parsePeriodValue(targetPeriod);
    if (!period) return;

    const ids = new Set(importableIds);
    const rows = cardResult.transactions.filter((transaction) => ids.has(transaction.id));
    if (rows.length === 0) {
      notifications.show({
        color: 'yellow',
        title: 'אין מה לייבא',
        message: 'כל העסקאות בקובץ דולגו, בקליטה, או כבר קיימות במערכת.',
      });
      return;
    }

    rows.forEach((transaction) => {
      const isCredit = isCreditAmount(transaction.chargeAmount);
      const noteParts = [
        isCredit ? 'זיכוי' : null,
        transaction.installment ?? null,
      ].filter((part): part is string => part !== null);

      addExpense(period.year, period.month, {
        category: categoryOverrides[transaction.id] ?? transaction.category,
        description: transaction.merchant,
        // Negative charge amounts are card credits — they reduce the month's expenses.
        amount: transaction.chargeAmount,
        date: transaction.date.length > 0 ? transaction.date : undefined,
        note: noteParts.length > 0 ? noteParts.join(' · ') : undefined,
        hash: transaction.hash,
      });
    });

    const creditRows = rows.filter((transaction) => isCreditAmount(transaction.chargeAmount)).length;
    notifications.show({
      color: 'emerald',
      title: 'הייבוא הושלם',
      message:
        creditRows > 0
          ? `${rows.length} עסקאות בסך ${formatCurrency(importTotal)} נוספו ל${formatMonthYear(period.year, period.month)} (כולל ${creditRows} זיכויים שמקטינים הוצאות).`
          : `${rows.length} עסקאות בסך ${formatCurrency(importTotal)} נוספו ל${formatMonthYear(period.year, period.month)}.`,
    });
    close();
  };

  const handleConfirmIncome = (): void => {
    if (!bankResult) return;
    const fallbackPeriod = parsePeriodValue(targetPeriod);
    if (!fallbackPeriod) return;

    if (checkedIncomes.length === 0) {
      notifications.show({
        color: 'yellow',
        title: 'אין מה לייבא',
        message: 'כל שורות ההכנסה בוטלו. סמן לפחות שורה אחת לייבוא.',
      });
      return;
    }

    const monthsTouched = new Set<string>();
    checkedIncomes.forEach((income) => {
      const period = periodFromIsoDate(income.date) ?? fallbackPeriod;
      addIncome(period.year, period.month, {
        label: income.label,
        amount: income.amount,
      });
      monthsTouched.add(`${period.year}-${period.month.toString().padStart(2, '0')}`);
    });

    const monthCount = monthsTouched.size;
    notifications.show({
      color: 'emerald',
      title: 'הייבוא הושלם',
      message:
        monthCount === 1
          ? `${checkedIncomes.length} הכנסות בסך ${formatCurrency(incomeTotal)} נוספו ל${formatMonthYear(fallbackPeriod.year, fallbackPeriod.month)}.`
          : `${checkedIncomes.length} הכנסות בסך ${formatCurrency(incomeTotal)} פוזרו ל-${monthCount} חודשים לפי תאריך התנועה.`,
    });
    close();
  };

  const monthOptions = useMemo(() => {
    if (targetPeriod.length === 0) {
      return buildMonthOptions(selectedYear, selectedMonth);
    }
    const period = parsePeriodValue(targetPeriod);
    return period
      ? buildMonthOptions(period.year, period.month)
      : buildMonthOptions(selectedYear, selectedMonth);
  }, [targetPeriod, selectedYear, selectedMonth]);

  const hasResult = cardResult !== null || bankResult !== null;

  const monthSelect = (
    <Select
      size="xs"
      w={150}
      radius="xl"
      aria-label={mode === 'bank' ? 'חודש ברירת מחדל לשורות ללא תאריך' : 'חודש היעד לייבוא'}
      data={monthOptions}
      value={targetPeriod}
      allowDeselect={false}
      withCheckIcon={false}
      comboboxProps={{ withinPortal: true }}
      onChange={(value) => {
        if (value !== null) {
          setTargetPeriod(value);
        }
      }}
    />
  );

  return (
    <>
      {mode === 'bank' ? (
        <Button
          variant="light"
          color="grape"
          size="xs"
          radius="xl"
          leftSection={<IconBuildingBank size={16} />}
          onClick={() => setOpened(true)}
          aria-label="ייבוא הכנסות מחשבון הבנק"
        >
          ייבוא הכנסות 🏦
        </Button>
      ) : (
        <Button
          variant="light"
          color="indigo"
          size="xs"
          radius="xl"
          leftSection={<IconCreditCard size={16} />}
          onClick={() => setOpened(true)}
          aria-label="ייבוא עסקאות מכרטיס אשראי"
        >
          ייבוא עסקאות 💳
        </Button>
      )}

      <Modal
        opened={opened}
        onClose={close}
        title={mode === 'bank' ? 'ייבוא הכנסות מחשבון הבנק' : 'ייבוא עסקאות מכרטיס אשראי'}
        size="xl"
      >
        <Stack gap="md">
          {!hasResult && (
            <>
              <ExcelFileDropArea
                loading={loading}
                multiple
                title={
                  mode === 'bank'
                    ? 'גרור לכאן דוחות עובר ושב מדיסקונט (xlsx) או לחץ לבחירה'
                    : 'גרור לכאן דוחות עסקאות מכאל או ממקס (xlsx) או לחץ לבחירה'
                }
                subtitle="אפשר כמה קבצים יחד. הקבצים נקראים בדפדפן בלבד ואינם נשלחים לשום מקום. הפורמט מזוהה אוטומטית."
                onFiles={(files) => {
                  void handleFiles(files);
                }}
                onInvalid={handleReject}
              />
              {unknownFormat && (
                <Group justify="center">
                  <Badge color="red" variant="light" radius="sm">
                    פורמט לא מוכר ✗
                  </Badge>
                </Group>
              )}
            </>
          )}

          {cardResult !== null && (
            <>
              <Group justify="space-between" align="center">
                <Group gap="xs">
                  {(cardResult.sources ?? [cardResult.source]).map((source) => (
                    <Badge
                      key={source}
                      color={SOURCE_BADGES[source].color}
                      variant="light"
                      radius="sm"
                    >
                      {SOURCE_BADGES[source].label}
                    </Badge>
                  ))}
                  <Text fz="xs" c={COLORS.textSecondary}>
                    {cardResult.fileCount > 1
                      ? `${cardResult.fileCount} קבצים · ${cardResult.transactions.length} עסקאות`
                      : cardResult.chargePeriod
                        ? `חיוב ${formatMonthYear(cardResult.chargePeriod.year, cardResult.chargePeriod.month)} · גיליון "${cardResult.sheetName}"`
                        : `גיליון "${cardResult.sheetName}"`}
                  </Text>
                </Group>
                {monthSelect}
              </Group>

              <Group justify="space-between" align="center" wrap="wrap">
                <Text fz="sm" c={COLORS.textSecondary}>
                  {`${importableIds.length} עסקאות מוכנות לייבוא, ${pendingCount} בקליטה (ידולגו), ${duplicateIds.size} כפילויות${
                    creditCount > 0 ? `, ${creditCount} זיכויים (מקטינים הוצאות)` : ''
                  }`}
                </Text>
                <TextInput
                  size="xs"
                  w={220}
                  radius="xl"
                  placeholder="חיפוש עסק / ענף / תאריך"
                  aria-label="חיפוש עסקאות"
                  leftSection={<IconSearch size={14} />}
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.currentTarget.value)}
                />
              </Group>

              <Table.ScrollContainer minWidth={720} mah={380} type="native">
                <Table verticalSpacing="xs" horizontalSpacing="sm" highlightOnHover stickyHeader>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th style={{ width: 92 }}>תאריך</Table.Th>
                      <Table.Th>שם עסק</Table.Th>
                      <Table.Th style={{ width: 104 }}>סכום חיוב</Table.Th>
                      <Table.Th style={{ width: 130 }}>
                        {(cardResult.sources ?? [cardResult.source]).includes('max') &&
                        (cardResult.sources ?? [cardResult.source]).includes('cal')
                          ? 'ענף / קטגוריה'
                          : cardResult.source === 'max'
                            ? 'קטגוריה במקס'
                            : 'ענף'}
                      </Table.Th>
                      <Table.Th style={{ width: 168 }}>קטגוריה</Table.Th>
                      <Table.Th style={{ width: 52 }}>דלג</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {filteredCardTransactions.length === 0 ? (
                      <Table.Tr>
                        <Table.Td colSpan={6}>
                          <Text fz="sm" c={COLORS.textSecondary} ta="center" py="md">
                            לא נמצאו עסקאות מתאימות לחיפוש
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    ) : (
                      filteredCardTransactions.map((transaction) => {
                      const isDuplicate = duplicateIds.has(transaction.id);
                      const isSkipped = skipped[transaction.id] === true;
                      const isInactive = transaction.isPending || isDuplicate || isSkipped;
                      const category = categoryOverrides[transaction.id] ?? transaction.category;
                      const isCredit = isCreditAmount(transaction.chargeAmount);

                      return (
                        <Table.Tr
                          key={transaction.id}
                          style={{ opacity: isInactive ? 0.45 : 1 }}
                        >
                          <Table.Td>
                            <Text fz="xs" c={COLORS.textSecondary}>
                              {transaction.dateLabel}
                            </Text>
                          </Table.Td>

                          <Table.Td>
                            <Stack gap={2}>
                              <Text fz="sm" c={COLORS.textPrimary}>
                                {transaction.merchant}
                              </Text>
                              <Group gap={4}>
                                {isCredit && (
                                  <Badge size="xs" color="emerald" variant="light" radius="sm">
                                    זיכוי
                                  </Badge>
                                )}
                                {transaction.isPending && (
                                  <Badge size="xs" color="gray" variant="light" radius="sm">
                                    בקליטה
                                  </Badge>
                                )}
                                {isDuplicate && (
                                  <Badge size="xs" color="yellow" variant="light" radius="sm">
                                    כבר קיימת
                                  </Badge>
                                )}
                                {transaction.installment !== undefined && (
                                  <Badge size="xs" color="indigo" variant="light" radius="sm">
                                    {transaction.installment}
                                  </Badge>
                                )}
                              </Group>
                            </Stack>
                          </Table.Td>

                          <Table.Td>
                            <Text
                              fz="sm"
                              fw={600}
                              c={
                                transaction.isPending
                                  ? COLORS.textSecondary
                                  : isCredit
                                    ? COLORS.income
                                    : COLORS.expense
                              }
                            >
                              {transaction.isPending ? '—' : formatCurrency(transaction.chargeAmount)}
                            </Text>
                          </Table.Td>

                          <Table.Td>
                            <Text fz="xs" c={COLORS.textSecondary}>
                              {transaction.branch.length > 0 ? transaction.branch : '—'}
                            </Text>
                          </Table.Td>

                          <Table.Td>
                            <Select
                              size="xs"
                              aria-label="קטגוריה"
                              data={CATEGORY_OPTIONS}
                              value={category}
                              disabled={transaction.isPending}
                              allowDeselect={false}
                              withCheckIcon={false}
                              comboboxProps={{ withinPortal: true }}
                              onChange={(value) => {
                                if (value !== null && isCategoryType(value)) {
                                  setCategoryOverrides((current) => ({
                                    ...current,
                                    [transaction.id]: value,
                                  }));
                                }
                              }}
                            />
                          </Table.Td>

                          <Table.Td>
                            <Tooltip
                              label={
                                isDuplicate
                                  ? 'עסקה זו כבר קיימת ולא תיובא'
                                  : isSkipped
                                    ? 'החזר לייבוא'
                                    : 'דלג על עסקה זו'
                              }
                              withArrow
                            >
                              <ActionIcon
                                variant="subtle"
                                color={isSkipped ? 'emerald' : 'gray'}
                                size="sm"
                                radius="xl"
                                disabled={transaction.isPending || isDuplicate}
                                aria-label={
                                  isSkipped
                                    ? `החזר לייבוא ${transaction.merchant}`
                                    : `דלג על ${transaction.merchant}`
                                }
                                onClick={() =>
                                  setSkipped((current) => ({
                                    ...current,
                                    [transaction.id]: !isSkipped,
                                  }))
                                }
                              >
                                {isSkipped ? <IconRestore size={15} /> : <IconEyeOff size={15} />}
                              </ActionIcon>
                            </Tooltip>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })
                    )}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>

              <Group justify="space-between" align="center">
                <Text fz="sm" fw={700} c={importTotal < 0 ? COLORS.income : COLORS.expense}>
                  {`סה"כ לייבוא: ${formatCurrency(importTotal)}`}
                </Text>
                <Group gap="xs">
                  <Button variant="subtle" color="gray" radius="xl" onClick={() => setCardResult(null)}>
                    בחר קובץ אחר
                  </Button>
                  <Button
                    color="emerald"
                    radius="xl"
                    onClick={handleConfirmExpenses}
                    disabled={importableIds.length === 0}
                  >
                    {`ייבוא ${importableIds.length} עסקאות`}
                  </Button>
                </Group>
              </Group>
            </>
          )}

          {bankResult !== null && (
            <>
              <Group justify="space-between" align="center">
                <Group gap="xs">
                  <Badge color={SOURCE_BADGES.discount.color} variant="light" radius="sm">
                    {SOURCE_BADGES.discount.label}
                  </Badge>
                  <Text fz="xs" c={COLORS.textSecondary}>
                    {bankResult.fileCount > 1
                      ? `${bankResult.fileCount} קבצים · ${bankResult.incomes.length} תנועות`
                      : `גיליון "${bankResult.sheetName}"`}
                  </Text>
                </Group>
                {monthSelect}
              </Group>

              <Text fz="sm" c={COLORS.textSecondary}>
                {`${checkedIncomes.length} מתוך ${bankResult.incomes.length} תנועות זכות מסומנות לייבוא. כל שורה תישמר בחודש של התאריך שלה; בחירת החודש משמשת רק לשורות ללא תאריך. תנועות חובה ועמלות סוננו אוטומטית.`}
              </Text>

              <Table.ScrollContainer minWidth={640} mah={380} type="native">
                <Table verticalSpacing="xs" horizontalSpacing="sm" highlightOnHover stickyHeader>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th style={{ width: 52 }}>ייבוא</Table.Th>
                      <Table.Th style={{ width: 92 }}>תאריך</Table.Th>
                      <Table.Th>תיאור התנועה</Table.Th>
                      <Table.Th style={{ width: 150 }}>מקור הכנסה</Table.Th>
                      <Table.Th style={{ width: 104 }}>סכום</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {bankResult.incomes.map((income) => {
                      const isChecked = uncheckedIncome[income.id] !== true;

                      return (
                        <Table.Tr key={income.id} style={{ opacity: isChecked ? 1 : 0.45 }}>
                          <Table.Td>
                            <Checkbox
                              size="xs"
                              color="emerald"
                              checked={isChecked}
                              aria-label={`ייבוא ${income.description}`}
                              onChange={(event) =>
                                setUncheckedIncome((current) => ({
                                  ...current,
                                  [income.id]: !event.currentTarget.checked,
                                }))
                              }
                            />
                          </Table.Td>

                          <Table.Td>
                            <Text fz="xs" c={COLORS.textSecondary}>
                              {income.dateLabel}
                            </Text>
                          </Table.Td>

                          <Table.Td>
                            <Group gap={6} wrap="nowrap">
                              <Text fz="sm" c={COLORS.textPrimary}>
                                {income.description}
                              </Text>
                              {income.needsReview && (
                                <Badge size="xs" color="yellow" variant="light" radius="sm">
                                  ⚠️ בדוק ידנית
                                </Badge>
                              )}
                            </Group>
                          </Table.Td>

                          <Table.Td>
                            <Text fz="sm" c={COLORS.textPrimary}>
                              {income.label}
                            </Text>
                          </Table.Td>

                          <Table.Td>
                            <Text fz="sm" fw={600} c={COLORS.income}>
                              {formatCurrency(income.amount)}
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>

              <Group justify="space-between" align="center">
                <Text fz="sm" fw={700} c={COLORS.income}>
                  {`סה"כ הכנסות לייבוא: ${formatCurrency(incomeTotal)}`}
                </Text>
                <Group gap="xs">
                  <Button variant="subtle" color="gray" radius="xl" onClick={() => setBankResult(null)}>
                    בחר קובץ אחר
                  </Button>
                  <Button
                    color="emerald"
                    radius="xl"
                    onClick={handleConfirmIncome}
                    disabled={checkedIncomes.length === 0}
                  >
                    {`ייבוא ${checkedIncomes.length} הכנסות`}
                  </Button>
                </Group>
              </Group>
            </>
          )}
        </Stack>
      </Modal>
    </>
  );
}
