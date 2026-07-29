import { Fragment, useMemo, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Group,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { IconLayoutList, IconListDetails, IconPlus, IconSearch } from '@tabler/icons-react';
import { CATEGORY_COLORS, CATEGORY_ICONS, COLORS, SECTION_TITLE_STYLE } from '../../lib/constants';
import { groupExpensesByCategory, sortExpenses } from '../../lib/calculations';
import { formatCurrency, matchesSearchQuery, todayISO } from '../../lib/utils';
import { useExpenseStore } from '../../store/useExpenseStore';
import { useMonthData } from '../../hooks/useMonthData';
import { ExpenseRow } from './ExpenseRow';

export function ExpenseTable(): JSX.Element {
  const { year, month, monthData, stats } = useMonthData();
  const addExpense = useExpenseStore((state) => state.addExpense);
  const [grouped, setGrouped] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredExpenses = useMemo(() => {
    return monthData.expenses.filter((expense) =>
      matchesSearchQuery(`${expense.description} ${expense.category} ${expense.note ?? ''}`, searchQuery)
    );
  }, [monthData.expenses, searchQuery]);

  const sorted = useMemo(() => sortExpenses(filteredExpenses), [filteredExpenses]);
  const groups = useMemo(() => groupExpensesByCategory(filteredExpenses), [filteredExpenses]);

  const handleAdd = (): void => {
    addExpense(year, month, {
      category: 'אחר',
      description: 'הוצאה חדשה',
      amount: 0,
      date: todayISO(),
    });
  };

  const totalWithSavings = stats.totalExpenses + stats.totalSavingsCategory;
  const displayTotal = stats.totalSavingsCategory > 0 ? totalWithSavings : stats.totalExpenses;
  const hasExpenses = monthData.expenses.length > 0;

  return (
    <Card style={{ overflow: 'hidden' }}>
      <Stack gap="sm" style={{ minWidth: 0 }}>
        <Group justify="space-between" align="center" wrap="wrap" gap="sm">
          <Text style={{ ...SECTION_TITLE_STYLE, minWidth: 0 }} truncate>
            💸 הוצאות החודש
          </Text>
          <Group gap="xs" wrap="wrap">
            {hasExpenses && (
              <TextInput
                size="xs"
                w={{ base: '100%', xs: 160 }}
                maw="100%"
                radius="xl"
                placeholder="חיפוש הוצאה"
                aria-label="חיפוש הוצאות"
                leftSection={<IconSearch size={14} />}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.currentTarget.value)}
              />
            )}
            <Tooltip label={grouped ? 'תצוגת רשימה' : 'קיבוץ לפי קטגוריה'} withArrow>
              <Button
                variant="subtle"
                color="gray"
                size="xs"
                leftSection={
                  grouped ? <IconListDetails size={15} /> : <IconLayoutList size={15} />
                }
                onClick={() => setGrouped((value) => !value)}
                aria-label={grouped ? 'תצוגת רשימה' : 'קיבוץ לפי קטגוריה'}
              >
                {grouped ? 'רשימה' : 'קיבוץ'}
              </Button>
            </Tooltip>
          </Group>
        </Group>

        {!hasExpenses ? (
          <Text fz="sm" c={COLORS.textSecondary} py="sm" ta="center">
            לא נרשמו הוצאות לחודש זה
          </Text>
        ) : filteredExpenses.length === 0 ? (
          <Text fz="sm" c={COLORS.textSecondary} py="sm" ta="center">
            לא נמצאו הוצאות מתאימות לחיפוש
          </Text>
        ) : (
          <Table.ScrollContainer minWidth={320} type="native">
            <Table verticalSpacing="xs" horizontalSpacing="xs" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ color: COLORS.textSecondary, fontWeight: 600, width: 130 }}>
                    קטגוריה
                  </Table.Th>
                  <Table.Th style={{ color: COLORS.textSecondary, fontWeight: 600 }}>תיאור</Table.Th>
                  <Table.Th style={{ color: COLORS.textSecondary, fontWeight: 600, width: 110 }}>
                    סכום
                  </Table.Th>
                  <Table.Th style={{ width: 44 }} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {grouped
                  ? groups.map((group) => (
                      <Fragment key={`group-${group.category}`}>
                        <Table.Tr bg="#F8FAFC">
                          <Table.Td colSpan={2}>
                            <Badge
                              variant="light"
                              radius="sm"
                              styles={{
                                root: {
                                  backgroundColor: `${CATEGORY_COLORS[group.category]}1A`,
                                  color: CATEGORY_COLORS[group.category],
                                  textTransform: 'none',
                                  fontWeight: 700,
                                },
                              }}
                            >
                              {`${CATEGORY_ICONS[group.category]} ${group.category} · ${group.expenses.length}`}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Text
                              fw={700}
                              fz="sm"
                              c={group.total < 0 ? COLORS.income : COLORS.textPrimary}
                              style={{ direction: 'ltr', unicodeBidi: 'isolate', whiteSpace: 'nowrap' }}
                            >
                              {formatCurrency(group.total)}
                            </Text>
                          </Table.Td>
                          <Table.Td />
                        </Table.Tr>
                        {group.expenses.map((expense) => (
                          <ExpenseRow
                            key={expense.id}
                            expense={expense}
                            year={year}
                            month={month}
                          />
                        ))}
                      </Fragment>
                    ))
                  : sorted.map((expense) => (
                      <ExpenseRow key={expense.id} expense={expense} year={year} month={month} />
                    ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}

        <Divider color={COLORS.border} />

        <Group justify="space-between" align="center" wrap="wrap" gap="sm">
          <Button
            variant="subtle"
            color="red"
            size="xs"
            leftSection={<IconPlus size={15} />}
            onClick={handleAdd}
          >
            הוסף הוצאה
          </Button>
          <Box style={{ minWidth: 0 }}>
            <Text fz="xs" c={COLORS.textSecondary} ta="end">
              {stats.totalSavingsCategory > 0
                ? `כולל ${formatCurrency(stats.totalSavingsCategory)} להפקדה לחיסכון`
                : 'סה"כ הוצאות'}
            </Text>
            <Text
              fw={700}
              fz="lg"
              c={displayTotal < 0 ? 'emerald.7' : 'red.6'}
              ta="end"
              style={{ direction: 'ltr', unicodeBidi: 'isolate', whiteSpace: 'nowrap' }}
            >
              {formatCurrency(displayTotal)}
            </Text>
          </Box>
        </Group>
      </Stack>
    </Card>
  );
}
