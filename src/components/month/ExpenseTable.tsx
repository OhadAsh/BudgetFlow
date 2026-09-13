import { Fragment, useMemo, useState, type CSSProperties } from 'react';
import {
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Group,
  ScrollArea,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { IconLayoutList, IconListDetails, IconPlus, IconSearch } from '@tabler/icons-react';
import { COLORS, SECTION_TITLE_STYLE } from '../../lib/constants';
import { groupExpensesByCategory, sortExpenses } from '../../lib/calculations';
import { formatCurrency, matchesSearchQuery, resolveCategoryMeta, todayISO } from '../../lib/utils';
import { useExpenseStore } from '../../store/useExpenseStore';
import { useMonthData } from '../../hooks/useMonthData';
import { ExpenseRow } from './ExpenseRow';

/** Relative list viewport — scales with the screen; scrolls only the expense rows. */
const EXPENSE_LIST_HEIGHT = 'min(75vh, 900px)';

const stickyHeaderCellStyle: CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 3,
  backgroundColor: COLORS.cardBg,
  boxShadow: `inset 0 -1px 0 ${COLORS.border}`,
};

export function ExpenseTable(): JSX.Element {
  const { year, month, monthData, stats } = useMonthData();
  const addExpense = useExpenseStore((state) => state.addExpense);
  const customCategories = useExpenseStore((state) => state.customCategories);
  const [grouped, setGrouped] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredExpenses = useMemo(() => {
    return monthData.expenses.filter((expense) =>
      matchesSearchQuery(
        `${expense.description} ${expense.category} ${expense.note ?? ''} ${expense.source ?? ''} ${expense.cardLast4 ?? ''}`,
        searchQuery
      )
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
    <Card>
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
          <ScrollArea
            h={EXPENSE_LIST_HEIGHT}
            type="auto"
            offsetScrollbars
            scrollbars="y"
            aria-label="רשימת הוצאות"
            styles={{
              viewport: {
                paddingBottom: 12,
              },
            }}
          >
            <Table verticalSpacing="xs" horizontalSpacing="xs" highlightOnHover miw={520}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ ...stickyHeaderCellStyle, width: 130, color: COLORS.textSecondary, fontWeight: 600 }}>
                    קטגוריה
                  </Table.Th>
                  <Table.Th style={{ ...stickyHeaderCellStyle, width: 88, color: COLORS.textSecondary, fontWeight: 600 }}>
                    תאריך
                  </Table.Th>
                  <Table.Th style={{ ...stickyHeaderCellStyle, color: COLORS.textSecondary, fontWeight: 600 }}>
                    תיאור
                  </Table.Th>
                  <Table.Th style={{ ...stickyHeaderCellStyle, width: 100, color: COLORS.textSecondary, fontWeight: 600 }}>
                    מקור
                  </Table.Th>
                  <Table.Th style={{ ...stickyHeaderCellStyle, width: 110, color: COLORS.textSecondary, fontWeight: 600 }}>
                    סכום
                  </Table.Th>
                  <Table.Th style={{ ...stickyHeaderCellStyle, width: 44 }} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {grouped
                  ? groups.map((group) => (
                    <Fragment key={`group-${group.category}`}>
                      <Table.Tr bg={COLORS.pageBg}>
                        <Table.Td colSpan={4}>
                          {(() => {
                            const meta = resolveCategoryMeta(group.category, customCategories);
                            return (
                              <Badge
                                variant="light"
                                radius="sm"
                                styles={{
                                  root: {
                                    backgroundColor: `${meta.color}1A`,
                                    color: meta.color,
                                    textTransform: 'none',
                                    fontWeight: 700,
                                  },
                                }}
                              >
                                {`${meta.emoji} ${group.category} · ${group.expenses.length}`}
                              </Badge>
                            );
                          })()}
                        </Table.Td>
                        <Table.Td>
                          <Text
                            fw={700}
                            fz="sm"
                            c={group.total < 0 ? COLORS.income : COLORS.textPrimary}
                            style={{
                              direction: 'ltr',
                              unicodeBidi: 'isolate',
                              whiteSpace: 'nowrap',
                            }}
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
          </ScrollArea>
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
