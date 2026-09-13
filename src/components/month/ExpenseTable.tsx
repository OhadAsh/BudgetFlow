import { Fragment, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
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
  UnstyledButton,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconLayoutList, IconListDetails, IconPlus, IconSearch } from '@tabler/icons-react';
import { COLORS, SECTION_TITLE_STYLE } from '../../lib/constants';
import { groupExpensesByCategory } from '../../lib/calculations';
import {
  formatCurrency,
  matchesSearchQuery,
  resolveCategoryMeta,
  sortExpensesForDisplay,
  todayISO,
  type ExpenseSortColumn,
  type SortDirection,
} from '../../lib/utils';
import { useExpenseStore } from '../../store/useExpenseStore';
import { useMonthData } from '../../hooks/useMonthData';
import { ExpenseRow } from './ExpenseRow';

/** Desktop floor — the list grows past this to fill the column next to the charts. */
const EXPENSE_LIST_MIN_HEIGHT = 260;
/** Mobile has no charts column to align with, so the list keeps a viewport-relative height. */
const MOBILE_EXPENSE_LIST_HEIGHT = 'min(70vh, 620px)';

const stickyHeaderCellStyle: CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 3,
  backgroundColor: COLORS.cardBg,
  boxShadow: `inset 0 -1px 0 ${COLORS.border}`,
};

interface SortableHeaderProps {
  label: string;
  column: ExpenseSortColumn;
  activeColumn: ExpenseSortColumn;
  direction: SortDirection;
  width?: number;
  onSort: (column: ExpenseSortColumn) => void;
}

function SortableHeader({
  label,
  column,
  activeColumn,
  direction,
  width,
  onSort,
}: SortableHeaderProps): JSX.Element {
  const isActive = activeColumn === column;
  const ariaSort = isActive ? (direction === 'asc' ? 'ascending' : 'descending') : 'none';

  return (
    <Table.Th
      style={{
        ...stickyHeaderCellStyle,
        width,
        color: isActive ? COLORS.textPrimary : COLORS.textSecondary,
        fontWeight: 600,
        padding: 0,
      }}
      aria-sort={ariaSort}
    >
      <UnstyledButton
        onClick={() => onSort(column)}
        aria-label={`מיון לפי ${label}${isActive ? (direction === 'asc' ? ' עולה' : ' יורד') : ''}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          width: '100%',
          padding: 'var(--mantine-spacing-xs)',
          color: 'inherit',
          fontWeight: 'inherit',
          fontSize: 'inherit',
          cursor: 'pointer',
        }}
      >
        <Text span fz="sm" fw={600} c="inherit">
          {label}
        </Text>
        {isActive && (
          <Text span fz="xs" c={COLORS.primary} aria-hidden>
            {direction === 'asc' ? '▲' : '▼'}
          </Text>
        )}
      </UnstyledButton>
    </Table.Th>
  );
}

interface StaticHeaderProps {
  children?: ReactNode;
  width?: number;
}

function StaticHeader({ children, width }: StaticHeaderProps): JSX.Element {
  return (
    <Table.Th
      style={{
        ...stickyHeaderCellStyle,
        width,
        color: COLORS.textSecondary,
        fontWeight: 600,
      }}
    >
      {children}
    </Table.Th>
  );
}

export function ExpenseTable(): JSX.Element {
  const isDesktop = useMediaQuery('(min-width: 62em)', undefined, {
    getInitialValueInEffect: false,
  });
  const { year, month, monthData, stats } = useMonthData();
  const addExpense = useExpenseStore((state) => state.addExpense);
  const customCategories = useExpenseStore((state) => state.customCategories);
  const [grouped, setGrouped] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortColumn, setSortColumn] = useState<ExpenseSortColumn>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const filteredExpenses = useMemo(() => {
    return monthData.expenses.filter((expense) =>
      matchesSearchQuery(
        `${expense.description} ${expense.category} ${expense.note ?? ''} ${expense.source ?? ''} ${expense.cardLast4 ?? ''}`,
        searchQuery
      )
    );
  }, [monthData.expenses, searchQuery]);

  const sorted = useMemo(
    () => sortExpensesForDisplay(filteredExpenses, sortColumn, sortDirection),
    [filteredExpenses, sortColumn, sortDirection]
  );

  const groups = useMemo(() => {
    const baseGroups = groupExpensesByCategory(filteredExpenses);
    return baseGroups.map((group) => ({
      ...group,
      expenses: sortExpensesForDisplay(group.expenses, sortColumn, sortDirection),
    }));
  }, [filteredExpenses, sortColumn, sortDirection]);

  const handleSort = (column: ExpenseSortColumn): void => {
    if (column === sortColumn) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortColumn(column);
    setSortDirection('desc');
  };

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
  const showsList = hasExpenses && filteredExpenses.length > 0;

  return (
    <Card style={{ flex: showsList ? '1 1 auto' : '0 0 auto', minHeight: 0 }}>
      <Stack gap="sm" style={{ minWidth: 0, flex: '1 1 auto', minHeight: 0 }}>
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
            type="auto"
            offsetScrollbars
            scrollbars="y"
            aria-label="רשימת הוצאות"
            style={{
              flex: '1 1 0',
              minHeight: isDesktop ? EXPENSE_LIST_MIN_HEIGHT : MOBILE_EXPENSE_LIST_HEIGHT,
            }}
            styles={{
              viewport: {
                paddingBottom: 12,
              },
            }}
          >
            <Table verticalSpacing="xs" horizontalSpacing="xs" highlightOnHover miw={520}>
              <Table.Thead>
                <Table.Tr>
                  <SortableHeader
                    label="קטגוריה"
                    column="category"
                    activeColumn={sortColumn}
                    direction={sortDirection}
                    width={130}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="תאריך"
                    column="date"
                    activeColumn={sortColumn}
                    direction={sortDirection}
                    width={88}
                    onSort={handleSort}
                  />
                  <StaticHeader>תיאור</StaticHeader>
                  <StaticHeader width={100}>מקור</StaticHeader>
                  <SortableHeader
                    label="סכום"
                    column="amount"
                    activeColumn={sortColumn}
                    direction={sortDirection}
                    width={110}
                    onSort={handleSort}
                  />
                  <StaticHeader width={44} />
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
