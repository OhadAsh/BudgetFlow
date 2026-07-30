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
  BankTransaction,
  CategoryType,
} from '../../types';
import { COLORS } from '../../lib/constants';
import {
  UNKNOWN_FORMAT_ERROR,
  buildIncomeFingerprint,
  collectImportedHashes,
  collectImportedIncomeFingerprints,
  isBankIncomeDuplicate,
  mergeBankIncomeResults,
  mergeCardImportResults,
  parseBankIncomeFile,
  parseCardFile,
  periodFromIsoDate,
} from '../../lib/excelParser';
import {
  buildCategorySelectOptions,
  formatCurrency,
  formatMonthYear,
  isCategoryType,
  isCreditAmount,
  lookupMerchant,
  matchesSearchQuery,
  normalizeMerchantName,
} from '../../lib/utils';
import { useExpenseStore } from '../../store/useExpenseStore';
import { ExcelFileDropArea } from './ExcelFileDropArea';

const SOURCE_BADGES: Record<BankSource, { label: string; color: string }> = {
  cal: { label: 'זוהה: כאל ✓', color: 'emerald' },
  max: { label: 'זוהה: מקס ✓', color: 'blue' },
  discount: { label: 'זוהה: בנק דיסקונט ✓', color: 'grape' },
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

/** Same normalized merchant name → apply one category to every matching card row. */
function matchingMerchantIds(
  transactions: BankTransaction[],
  merchant: string
): string[] {
  const key = normalizeMerchantName(merchant);
  if (key.length === 0) return [];
  return transactions
    .filter((row) => normalizeMerchantName(row.merchant) === key)
    .map((row) => row.id);
}

export function BankImportModal({ mode }: BankImportModalProps): JSX.Element {
  const months = useExpenseStore((state) => state.months);
  const addExpense = useExpenseStore((state) => state.addExpense);
  const addIncome = useExpenseStore((state) => state.addIncome);
  const selectedYear = useExpenseStore((state) => state.selectedYear);
  const selectedMonth = useExpenseStore((state) => state.selectedMonth);
  const customCategories = useExpenseStore((state) => state.customCategories);
  const merchantMemory = useExpenseStore((state) => state.merchantMemory);
  const rememberMerchant = useExpenseStore((state) => state.rememberMerchant);

  const [opened, setOpened] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [unknownFormat, setUnknownFormat] = useState<boolean>(false);
  const [cardResult, setCardResult] = useState<BankImportResult | null>(null);
  const [bankResult, setBankResult] = useState<BankIncomeImportResult | null>(null);
  const [categoryOverrides, setCategoryOverrides] = useState<Record<string, CategoryType>>({});
  const [skipped, setSkipped] = useState<Record<string, boolean>>({});
  const [uncheckedIncome, setUncheckedIncome] = useState<Record<string, boolean>>({});
  const [uncheckedExpense, setUncheckedExpense] = useState<Record<string, boolean>>({});
  const [targetPeriod, setTargetPeriod] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [memoryAppliedIds, setMemoryAppliedIds] = useState<Set<string>>(new Set());
  const [memoryPrompt, setMemoryPrompt] = useState<{
    id: string;
    merchant: string;
    category: CategoryType;
    previousCategory: CategoryType;
  } | null>(null);

  const categoryOptions = useMemo(
    () => buildCategorySelectOptions(customCategories),
    [customCategories]
  );

  const existingHashes = useMemo(() => collectImportedHashes(months), [months]);
  const existingIncomeFingerprints = useMemo(
    () => collectImportedIncomeFingerprints(months),
    [months]
  );

  const duplicateIds = useMemo(() => {
    const ids = new Set<string>();
    cardResult?.transactions.forEach((transaction) => {
      if (!transaction.isPending && existingHashes.has(transaction.hash)) {
        ids.add(transaction.id);
      }
    });
    return ids;
  }, [cardResult, existingHashes]);

  const bankExpenseDuplicateIds = useMemo(() => {
    const ids = new Set<string>();
    (bankResult?.expenses ?? []).forEach((expense) => {
      if (existingHashes.has(expense.hash)) {
        ids.add(expense.id);
      }
    });
    return ids;
  }, [bankResult, existingHashes]);

  const bankIncomeDuplicateIds = useMemo(() => {
    const ids = new Set<string>();
    (bankResult?.incomes ?? []).forEach((income) => {
      if (isBankIncomeDuplicate(income, existingIncomeFingerprints, months)) {
        ids.add(income.id);
      }
    });
    return ids;
  }, [bankResult, existingIncomeFingerprints, months]);

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
    return (bankResult?.incomes ?? []).filter(
      (income) =>
        uncheckedIncome[income.id] !== true && !bankIncomeDuplicateIds.has(income.id)
    );
  }, [bankResult, uncheckedIncome, bankIncomeDuplicateIds]);

  const checkedBankExpenses = useMemo(() => {
    return (bankResult?.expenses ?? []).filter(
      (expense) =>
        uncheckedExpense[expense.id] !== true && !bankExpenseDuplicateIds.has(expense.id)
    );
  }, [bankResult, uncheckedExpense, bankExpenseDuplicateIds]);

  const incomeTotal = useMemo(() => {
    return checkedIncomes.reduce((total, income) => total + income.amount, 0);
  }, [checkedIncomes]);

  const bankExpenseTotal = useMemo(() => {
    return checkedBankExpenses.reduce((total, expense) => total + expense.amount, 0);
  }, [checkedBankExpenses]);

  const filteredIncomes = useMemo(() => {
    return (bankResult?.incomes ?? []).filter((income) =>
      matchesSearchQuery(
        `${income.description} ${income.label} ${income.dateLabel}`,
        searchQuery
      )
    );
  }, [bankResult, searchQuery]);

  const filteredBankExpenses = useMemo(() => {
    return (bankResult?.expenses ?? []).filter((expense) =>
      matchesSearchQuery(
        `${expense.description} ${expense.category} ${expense.dateLabel}`,
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
    setUncheckedExpense({});
    setTargetPeriod('');
    setSearchQuery('');
    setMemoryAppliedIds(new Set());
    setMemoryPrompt(null);
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
        setUncheckedExpense({});
        applyPeriod(
          mostCommonPeriod([...merged.incomes, ...merged.expenses]) ?? {
            year: selectedYear,
            month: selectedMonth,
          }
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
        const memoryIds = new Set<string>();
        const transactions: BankTransaction[] = merged.transactions.map((transaction) => {
          const remembered = lookupMerchant(merchantMemory, transaction.merchant);
          if (remembered !== undefined) {
            memoryIds.add(transaction.id);
            return { ...transaction, category: remembered };
          }
          return transaction;
        });
        setCardResult({ ...merged, transactions });
        setMemoryAppliedIds(memoryIds);
        setMemoryPrompt(null);
        setCategoryOverrides({});
        setSkipped({});
        applyPeriod(
          mostCommonPeriod(transactions) ??
            merged.chargePeriod ?? { year: selectedYear, month: selectedMonth }
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
    const fallbackPeriod = parsePeriodValue(targetPeriod);
    if (!fallbackPeriod) return;

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

    const monthsTouched = new Set<string>();
    rows.forEach((transaction) => {
      const isCredit = isCreditAmount(transaction.chargeAmount);
      const noteParts = [
        isCredit ? 'זיכוי' : null,
        transaction.installment ?? null,
      ].filter((part): part is string => part !== null);

      // Bucket by transaction date — never dump everything into the statement charge month.
      const period = periodFromIsoDate(transaction.date) ?? fallbackPeriod;

      addExpense(period.year, period.month, {
        category: categoryOverrides[transaction.id] ?? transaction.category,
        description: transaction.merchant,
        // Negative charge amounts are card credits — they reduce the month's expenses.
        amount: transaction.chargeAmount,
        date: transaction.date.length > 0 ? transaction.date : undefined,
        note: noteParts.length > 0 ? noteParts.join(' · ') : undefined,
        hash: transaction.hash,
      });
      monthsTouched.add(`${period.year}-${period.month.toString().padStart(2, '0')}`);
    });

    const creditRows = rows.filter((transaction) => isCreditAmount(transaction.chargeAmount)).length;
    const monthCount = monthsTouched.size;
    const soleKey = monthsTouched.values().next().value;
    const solePeriod = (soleKey !== undefined ? parsePeriodValue(soleKey) : null) ?? fallbackPeriod;
    const creditSuffix =
      creditRows > 0 ? ` (כולל ${creditRows} זיכויים שמקטינים הוצאות)` : '';

    notifications.show({
      color: 'emerald',
      title: 'הייבוא הושלם',
      message:
        monthCount === 1
          ? `${rows.length} עסקאות בסך ${formatCurrency(importTotal)} נוספו ל${formatMonthYear(solePeriod.year, solePeriod.month)}.${creditSuffix}`
          : `${rows.length} עסקאות בסך ${formatCurrency(importTotal)} פוזרו ל-${monthCount} חודשים לפי תאריך העסקה.${creditSuffix}`,
    });
    close();
  };

  const handleConfirmIncome = (): void => {
    if (!bankResult) return;
    const fallbackPeriod = parsePeriodValue(targetPeriod);
    if (!fallbackPeriod) return;

    if (checkedIncomes.length === 0 && checkedBankExpenses.length === 0) {
      notifications.show({
        color: 'yellow',
        title: 'אין מה לייבא',
        message: 'סמן לפחות הכנסה או הוצאה אחת לייבוא.',
      });
      return;
    }

    const monthsTouched = new Set<string>();

    checkedIncomes.forEach((income) => {
      const period = periodFromIsoDate(income.date) ?? fallbackPeriod;
      addIncome(period.year, period.month, {
        label: income.label,
        amount: income.amount,
        date: income.date.length > 0 ? income.date : undefined,
        hash: buildIncomeFingerprint(income.date, income.description, income.amount),
      });
      monthsTouched.add(`${period.year}-${period.month.toString().padStart(2, '0')}`);
    });

    checkedBankExpenses.forEach((expense) => {
      const period = periodFromIsoDate(expense.date) ?? fallbackPeriod;
      addExpense(period.year, period.month, {
        category: categoryOverrides[expense.id] ?? expense.category,
        description: expense.description,
        amount: expense.amount,
        date: expense.date.length > 0 ? expense.date : undefined,
        note: 'הוראת קבע / תנועת עו״ש',
        hash: expense.hash,
      });
      monthsTouched.add(`${period.year}-${period.month.toString().padStart(2, '0')}`);
    });

    const monthCount = monthsTouched.size;
    const parts: string[] = [];
    if (checkedIncomes.length > 0) {
      parts.push(`${checkedIncomes.length} הכנסות בסך ${formatCurrency(incomeTotal)}`);
    }
    if (checkedBankExpenses.length > 0) {
      parts.push(
        `${checkedBankExpenses.length} הוצאות בסך ${formatCurrency(bankExpenseTotal)}`
      );
    }
    const summary = parts.join(' ו-');

    notifications.show({
      color: 'emerald',
      title: 'הייבוא הושלם',
      message:
        monthCount === 1
          ? `${summary} נוספו לפי תאריך התנועה.`
          : `${summary} פוזרו ל-${monthCount} חודשים לפי תאריך התנועה.`,
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

  const memoryMatchCount = useMemo((): number => {
    if (memoryPrompt === null || cardResult === null) return 0;
    return matchingMerchantIds(cardResult.transactions, memoryPrompt.merchant).length;
  }, [memoryPrompt, cardResult]);

  /** Writes category onto matching card rows and keeps overrides in sync. */
  const refreshCategoriesForMerchant = (
    merchant: string,
    category: CategoryType,
    scope: 'all' | 'one',
    oneId: string
  ): void => {
    const matchIds =
      scope === 'all'
        ? matchingMerchantIds(cardResult?.transactions ?? [], merchant)
        : [oneId];
    const idSet = new Set(matchIds);

    setCardResult((current) => {
      if (current === null) return current;
      return {
        ...current,
        transactions: current.transactions.map((row) =>
          idSet.has(row.id) ? { ...row, category } : row
        ),
      };
    });

    setCategoryOverrides((current) => {
      const next = { ...current };
      matchIds.forEach((id) => {
        next[id] = category;
      });
      return next;
    });

    setMemoryAppliedIds((current) => {
      const next = new Set(current);
      matchIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const closeMemoryPrompt = (): void => {
    setMemoryPrompt(null);
  };

  const handleApplyCategoryToAll = (): void => {
    if (memoryPrompt === null) return;
    rememberMerchant(memoryPrompt.merchant, memoryPrompt.category);
    refreshCategoriesForMerchant(
      memoryPrompt.merchant,
      memoryPrompt.category,
      'all',
      memoryPrompt.id
    );
    notifications.show({
      color: 'violet',
      title: 'הקטגוריה עודכנה',
      message: `הוחלה על ${memoryMatchCount} עסקאות של ${memoryPrompt.merchant} ונשמרה לזיכרון.`,
    });
    closeMemoryPrompt();
  };

  const handleApplyCategoryToOne = (): void => {
    if (memoryPrompt === null) return;
    rememberMerchant(memoryPrompt.merchant, memoryPrompt.category);
    refreshCategoriesForMerchant(
      memoryPrompt.merchant,
      memoryPrompt.category,
      'one',
      memoryPrompt.id
    );
    closeMemoryPrompt();
  };

  const handleCancelCategoryChange = (): void => {
    if (memoryPrompt === null) return;
    const { id, previousCategory } = memoryPrompt;
    setCategoryOverrides((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setCardResult((current) => {
      if (current === null) return current;
      return {
        ...current,
        transactions: current.transactions.map((row) =>
          row.id === id ? { ...row, category: previousCategory } : row
        ),
      };
    });
    closeMemoryPrompt();
  };

  const monthSelect = (
    <Select
      size="xs"
      w={150}
      radius="xl"
      aria-label="חודש ברירת מחדל לשורות ללא תאריך"
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
          aria-label="ייבוא עו״ש מחשבון הבנק"
        >
          ייבוא בנק 🏦
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
        title={mode === 'bank' ? 'ייבוא עו״ש מחשבון הבנק' : 'ייבוא עסקאות מכרטיס אשראי'}
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
                subtitle={
                  mode === 'bank'
                    ? 'מייבאים זכות כהכנסות, וחובה כהוצאות: הו״ק, שיקים ומשיכות מזומן. כרטיסי אשראי וניירות ערך מסוננים אוטומטית.'
                    : 'אפשר כמה קבצים יחד. הקבצים נקראים בדפדפן בלבד ואינם נשלחים לשום מקום. הפורמט מזוהה אוטומטית.'
                }
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

              <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
                <Text fz="sm" c={COLORS.textSecondary} maw={520}>
                  {`${importableIds.length} עסקאות מוכנות לייבוא, ${pendingCount} בקליטה (ידולגו), ${duplicateIds.size} כפילויות${
                    creditCount > 0 ? `, ${creditCount} זיכויים (מקטינים הוצאות)` : ''
                  }. כל עסקה תישמר בחודש של התאריך שלה; בחירת החודש משמשת רק לשורות ללא תאריך.`}
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
                                {memoryAppliedIds.has(transaction.id) &&
                                  categoryOverrides[transaction.id] === undefined && (
                                  <Badge size="xs" color="violet" variant="light" radius="sm">
                                    🧠 זיכרון
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
                            <Stack gap={4}>
                              <Select
                                size="xs"
                                aria-label="קטגוריה"
                                data={categoryOptions}
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
                                    setMemoryAppliedIds((current) => {
                                      const next = new Set(current);
                                      next.delete(transaction.id);
                                      return next;
                                    });
                                    if (value !== transaction.category) {
                                      setMemoryPrompt({
                                        id: transaction.id,
                                        merchant: transaction.merchant,
                                        category: value,
                                        previousCategory: transaction.category,
                                      });
                                    } else {
                                      setMemoryPrompt((current) =>
                                        current?.id === transaction.id ? null : current
                                      );
                                    }
                                  }
                                }}
                              />
                            </Stack>
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
                  <Button
                    variant="subtle"
                    color="gray"
                    radius="xl"
                    onClick={() => {
                      setCardResult(null);
                      setSearchQuery('');
                    }}
                  >
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
                      ? `${bankResult.fileCount} קבצים · ${bankResult.incomes.length} הכנסות · ${(bankResult.expenses ?? []).length} הוצאות`
                      : `גיליון "${bankResult.sheetName}" · ${bankResult.incomes.length} הכנסות · ${(bankResult.expenses ?? []).length} הוצאות`}
                  </Text>
                </Group>
                {monthSelect}
              </Group>

              <Text fz="sm" c={COLORS.textSecondary}>
                כל שורה נשמרת בחודש של התאריך שלה. מיובאים: הו״ק, שיקים יוצאים ומשיכות מזומן. מסוננים: כרטיסי אשראי
                (כבר ב״ייבוא עסקאות״), ניירות ערך/השקעות, עמלות והעברות בין חשבונות שלך.
              </Text>

              <TextInput
                size="xs"
                w={280}
                radius="xl"
                placeholder="חיפוש תיאור / קטגוריה / תאריך"
                aria-label="חיפוש תנועות בנק"
                leftSection={<IconSearch size={14} />}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.currentTarget.value)}
              />

              {bankResult.incomes.length > 0 && (
                <Stack gap="xs">
                  <Text fw={700} fz="sm" c={COLORS.textPrimary}>
                    {`הכנסות (זכות) · ${checkedIncomes.length}/${bankResult.incomes.length}`}
                    {bankIncomeDuplicateIds.size > 0
                      ? ` · ${bankIncomeDuplicateIds.size} כפילויות`
                      : ''}
                  </Text>
                  <Table.ScrollContainer minWidth={640} mah={220} type="native">
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
                        {filteredIncomes.length === 0 ? (
                          <Table.Tr>
                            <Table.Td colSpan={5}>
                              <Text fz="sm" c={COLORS.textSecondary} ta="center" py="md">
                                לא נמצאו הכנסות מתאימות לחיפוש
                              </Text>
                            </Table.Td>
                          </Table.Tr>
                        ) : (
                          filteredIncomes.map((income) => {
                            const isDuplicate = bankIncomeDuplicateIds.has(income.id);
                            const isChecked =
                              uncheckedIncome[income.id] !== true && !isDuplicate;

                            return (
                              <Table.Tr
                                key={income.id}
                                style={{ opacity: isChecked && !isDuplicate ? 1 : 0.45 }}
                              >
                                <Table.Td>
                                  <Checkbox
                                    size="xs"
                                    color="emerald"
                                    checked={isChecked}
                                    disabled={isDuplicate}
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
                                    {isDuplicate && (
                                      <Badge size="xs" color="gray" variant="light" radius="sm">
                                        כבר קיים
                                      </Badge>
                                    )}
                                    {!isDuplicate && income.needsReview && (
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
                          })
                        )}
                      </Table.Tbody>
                    </Table>
                  </Table.ScrollContainer>
                </Stack>
              )}

              {(bankResult.expenses ?? []).length > 0 && (
                <Stack gap="xs">
                  <Text fw={700} fz="sm" c={COLORS.textPrimary}>
                    {`הוצאות (חובה / הו״ק) · ${checkedBankExpenses.length}/${(bankResult.expenses ?? []).length}`}
                  </Text>
                  <Table.ScrollContainer minWidth={720} mah={280} type="native">
                    <Table verticalSpacing="xs" horizontalSpacing="sm" highlightOnHover stickyHeader>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th style={{ width: 52 }}>ייבוא</Table.Th>
                          <Table.Th style={{ width: 92 }}>תאריך</Table.Th>
                          <Table.Th>תיאור התנועה</Table.Th>
                          <Table.Th style={{ width: 168 }}>קטגוריה</Table.Th>
                          <Table.Th style={{ width: 104 }}>סכום</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {filteredBankExpenses.length === 0 ? (
                          <Table.Tr>
                            <Table.Td colSpan={5}>
                              <Text fz="sm" c={COLORS.textSecondary} ta="center" py="md">
                                לא נמצאו הוצאות מתאימות לחיפוש
                              </Text>
                            </Table.Td>
                          </Table.Tr>
                        ) : (
                          filteredBankExpenses.map((expense) => {
                            const isDuplicate = bankExpenseDuplicateIds.has(expense.id);
                            const isChecked =
                              uncheckedExpense[expense.id] !== true && !isDuplicate;
                            const selectedCategory =
                              categoryOverrides[expense.id] ?? expense.category;

                            return (
                              <Table.Tr
                                key={expense.id}
                                style={{ opacity: isChecked && !isDuplicate ? 1 : 0.45 }}
                              >
                                <Table.Td>
                                  <Checkbox
                                    size="xs"
                                    color="red"
                                    checked={isChecked}
                                    disabled={isDuplicate}
                                    aria-label={`ייבוא ${expense.description}`}
                                    onChange={(event) =>
                                      setUncheckedExpense((current) => ({
                                        ...current,
                                        [expense.id]: !event.currentTarget.checked,
                                      }))
                                    }
                                  />
                                </Table.Td>
                                <Table.Td>
                                  <Text fz="xs" c={COLORS.textSecondary}>
                                    {expense.dateLabel}
                                  </Text>
                                </Table.Td>
                                <Table.Td>
                                  <Group gap={6} wrap="nowrap">
                                    <Text fz="sm" c={COLORS.textPrimary}>
                                      {expense.description}
                                    </Text>
                                    {isDuplicate && (
                                      <Badge size="xs" color="gray" variant="light" radius="sm">
                                        כבר קיים
                                      </Badge>
                                    )}
                                  </Group>
                                </Table.Td>
                                <Table.Td>
                                  <Select
                                    size="xs"
                                    radius="xl"
                                    aria-label="קטגוריה"
                                    data={categoryOptions}
                                    value={selectedCategory}
                                    allowDeselect={false}
                                    disabled={isDuplicate}
                                    comboboxProps={{ withinPortal: true }}
                                    onChange={(value) => {
                                      if (value !== null && isCategoryType(value)) {
                                        setCategoryOverrides((current) => ({
                                          ...current,
                                          [expense.id]: value,
                                        }));
                                      }
                                    }}
                                  />
                                </Table.Td>
                                <Table.Td>
                                  <Text fz="sm" fw={600} c={COLORS.expense}>
                                    {formatCurrency(expense.amount)}
                                  </Text>
                                </Table.Td>
                              </Table.Tr>
                            );
                          })
                        )}
                      </Table.Tbody>
                    </Table>
                  </Table.ScrollContainer>
                </Stack>
              )}

              <Group justify="space-between" align="center" wrap="wrap" gap="sm">
                <Stack gap={2}>
                  {checkedIncomes.length > 0 && (
                    <Text fz="sm" fw={700} c={COLORS.income}>
                      {`הכנסות: ${formatCurrency(incomeTotal)}`}
                    </Text>
                  )}
                  {checkedBankExpenses.length > 0 && (
                    <Text fz="sm" fw={700} c={COLORS.expense}>
                      {`הוצאות: ${formatCurrency(bankExpenseTotal)}`}
                    </Text>
                  )}
                </Stack>
                <Group gap="xs">
                  <Button
                    variant="subtle"
                    color="gray"
                    radius="xl"
                    onClick={() => {
                      setBankResult(null);
                      setSearchQuery('');
                      setUncheckedExpense({});
                    }}
                  >
                    בחר קובץ אחר
                  </Button>
                  <Button
                    color="emerald"
                    radius="xl"
                    onClick={handleConfirmIncome}
                    disabled={checkedIncomes.length === 0 && checkedBankExpenses.length === 0}
                  >
                    {`ייבוא ${checkedIncomes.length + checkedBankExpenses.length} תנועות`}
                  </Button>
                </Group>
              </Group>
            </>
          )}
        </Stack>
      </Modal>

      <Modal
        opened={memoryPrompt !== null}
        onClose={handleCancelCategoryChange}
        title="החלת קטגוריה"
        size="sm"
        centered
      >
        <Stack gap="md">
          <Text fz="sm" c={COLORS.textPrimary}>
            {memoryPrompt !== null
              ? `בחרת את הקטגוריה "${memoryPrompt.category}" עבור "${memoryPrompt.merchant}".`
              : ''}
          </Text>
          <Text fz="sm" c={COLORS.textSecondary}>
            {memoryMatchCount > 1
              ? `נמצאו ${memoryMatchCount} עסקאות של אותו עסק בקובץ. אפשר להחיל על כולן ולשמור לזיכרון.`
              : 'אפשר לשמור לזיכרון לפעמים הבאות, או להחיל רק על השורה הזו.'}
          </Text>
          <Stack gap="xs">
            <Button
              color="violet"
              radius="xl"
              fullWidth
              onClick={handleApplyCategoryToAll}
              disabled={memoryPrompt === null}
            >
              {memoryMatchCount > 1
                ? `החל על הכל (${memoryMatchCount}) ושמור לזיכרון`
                : 'החל ושמור לזיכרון'}
            </Button>
            {memoryMatchCount > 1 && (
              <Button
                variant="light"
                color="violet"
                radius="xl"
                fullWidth
                onClick={handleApplyCategoryToOne}
              >
                רק לשורה זו ושמור לזיכרון
              </Button>
            )}
            <Button variant="default" radius="xl" fullWidth onClick={handleCancelCategoryChange}>
              ביטול
            </Button>
          </Stack>
        </Stack>
      </Modal>
    </>
  );
}
