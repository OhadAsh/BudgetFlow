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
  Tooltip,
} from '@mantine/core';
import { IconLayoutList, IconListDetails, IconPlus } from '@tabler/icons-react';
import { CATEGORY_COLORS, CATEGORY_ICONS, COLORS, SECTION_TITLE_STYLE } from '../../lib/constants';
import { groupExpensesByCategory, sortExpenses } from '../../lib/calculations';
import { formatCurrency, todayISO } from '../../lib/utils';
import { useExpenseStore } from '../../store/useExpenseStore';
import { useMonthData } from '../../hooks/useMonthData';
import { ExpenseRow } from './ExpenseRow';

export function ExpenseTable(): JSX.Element {
  const { year, month, monthData, stats } = useMonthData();
  const addExpense = useExpenseStore((state) => state.addExpense);
  const [grouped, setGrouped] = useState<boolean>(false);

  const sorted = useMemo(() => sortExpenses(monthData.expenses), [monthData.expenses]);
  const groups = useMemo(() => groupExpensesByCategory(monthData.expenses), [monthData.expenses]);

  const handleAdd = (): void => {
    addExpense(year, month, {
      category: 'אחר',
      description: 'הוצאה חדשה',
      amount: 0,
      date: todayISO(),
    });
  };

  const totalWithSavings = stats.totalExpenses + stats.totalSavingsCategory;

  return (
    <Card>
      <Stack gap="sm">
        <Group justify="space-between" align="center">
          <Text style={SECTION_TITLE_STYLE}>💸 הוצאות החודש</Text>
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

        {monthData.expenses.length === 0 ? (
          <Text fz="sm" c={COLORS.textSecondary} py="sm" ta="center">
            לא נרשמו הוצאות לחודש זה
          </Text>
        ) : (
          <Table verticalSpacing="xs" horizontalSpacing="xs" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ color: COLORS.textSecondary, fontWeight: 600, width: 150 }}>
                  קטגוריה
                </Table.Th>
                <Table.Th style={{ color: COLORS.textSecondary, fontWeight: 600 }}>תיאור</Table.Th>
                <Table.Th style={{ color: COLORS.textSecondary, fontWeight: 600, width: 120 }}>
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
                          <Text fw={700} fz="sm" c={COLORS.textPrimary}>
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
        )}

        <Divider color={COLORS.border} />

        <Group justify="space-between" align="center">
          <Button
            variant="subtle"
            color="red"
            size="xs"
            leftSection={<IconPlus size={15} />}
            onClick={handleAdd}
          >
            הוסף הוצאה
          </Button>
          <Box>
            <Text fz="xs" c={COLORS.textSecondary} ta="end">
              {stats.totalSavingsCategory > 0
                ? `כולל ${formatCurrency(stats.totalSavingsCategory)} להפקדה לחיסכון`
                : 'סה"כ הוצאות'}
            </Text>
            <Text fw={700} fz="lg" c="red.6" ta="end">
              {formatCurrency(stats.totalSavingsCategory > 0 ? totalWithSavings : stats.totalExpenses)}
            </Text>
          </Box>
        </Group>
      </Stack>
    </Card>
  );
}
