import { useMemo, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Group,
  NumberInput,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core';
import { IconX } from '@tabler/icons-react';
import type { Expense } from '../../types';
import { COLORS } from '../../lib/constants';
import {
  buildCategorySelectOptions,
  formatCurrency,
  isCategoryType,
  isCreditAmount,
  resolveCategoryMeta,
} from '../../lib/utils';
import { useExpenseStore } from '../../store/useExpenseStore';

interface ExpenseRowProps {
  expense: Expense;
  year: number;
  month: number;
}

type EditingField = 'category' | 'description' | 'amount' | null;

export function ExpenseRow({ expense, year, month }: ExpenseRowProps): JSX.Element {
  const updateExpense = useExpenseStore((state) => state.updateExpense);
  const removeExpense = useExpenseStore((state) => state.removeExpense);
  const rememberMerchant = useExpenseStore((state) => state.rememberMerchant);
  const customCategories = useExpenseStore((state) => state.customCategories);
  const [editing, setEditing] = useState<EditingField>(null);
  const isCredit = isCreditAmount(expense.amount);

  const categoryOptions = useMemo(
    () => buildCategorySelectOptions(customCategories),
    [customCategories]
  );
  const meta = resolveCategoryMeta(expense.category, customCategories);

  const handleCategoryChange = (value: string | null): void => {
    if (value !== null && isCategoryType(value)) {
      updateExpense(year, month, expense.id, { category: value });
      if (expense.description.trim().length > 0) {
        rememberMerchant(expense.description, value);
      }
    }
    setEditing(null);
  };

  return (
    <Table.Tr>
      <Table.Td>
        {editing === 'category' ? (
          <Select
            size="xs"
            autoFocus
            searchable
            withCheckIcon={false}
            aria-label="קטגוריה"
            data={categoryOptions}
            value={expense.category}
            comboboxProps={{ withinPortal: true }}
            onChange={handleCategoryChange}
            onDropdownClose={() => setEditing(null)}
          />
        ) : (
          <UnstyledButton
            onClick={() => setEditing('category')}
            aria-label={`שינוי קטגוריה — ${expense.category}`}
          >
            <Badge
              variant="light"
              radius="sm"
              styles={{
                root: {
                  backgroundColor: `${meta.color}1A`,
                  color: meta.color,
                  textTransform: 'none',
                  fontWeight: 600,
                },
              }}
            >
              {`${meta.emoji} ${meta.name}`}
            </Badge>
          </UnstyledButton>
        )}
      </Table.Td>

      <Table.Td>
        {editing === 'description' ? (
          <TextInput
            size="xs"
            autoFocus
            aria-label="תיאור הוצאה"
            defaultValue={expense.description}
            onBlur={(event) => {
              const value = event.currentTarget.value.trim();
              const description = value.length > 0 ? value : 'הוצאה';
              updateExpense(year, month, expense.id, { description });
              rememberMerchant(description, expense.category);
              setEditing(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.currentTarget.blur();
              }
              if (event.key === 'Escape') {
                setEditing(null);
              }
            }}
          />
        ) : (
          <Stack gap={2}>
            <UnstyledButton
              onClick={() => setEditing('description')}
              aria-label={`עריכת תיאור ${expense.description}`}
              style={{ fontSize: 14, color: COLORS.textPrimary, width: '100%', textAlign: 'start' }}
            >
              {expense.description}
            </UnstyledButton>
            {(isCredit || (expense.note !== undefined && expense.note.length > 0)) && (
              <Group gap={4}>
                {isCredit && (
                  <Badge size="xs" color="emerald" variant="light" radius="sm">
                    זיכוי
                  </Badge>
                )}
                {expense.note !== undefined &&
                  expense.note.length > 0 &&
                  expense.note !== 'זיכוי' && (
                    <Text fz="xs" c={COLORS.textSecondary}>
                      {expense.note.replace(/^זיכוי · /, '')}
                    </Text>
                  )}
              </Group>
            )}
          </Stack>
        )}
      </Table.Td>

      <Table.Td>
        {editing === 'amount' ? (
          <NumberInput
            size="xs"
            autoFocus
            prefix="₪"
            allowNegative
            decimalScale={2}
            thousandSeparator=","
            hideControls
            aria-label="סכום הוצאה"
            defaultValue={expense.amount}
            onBlur={(event) => {
              const parsed = Number.parseFloat(event.currentTarget.value.replace(/[^\d.-]/g, ''));
              updateExpense(year, month, expense.id, {
                amount: Number.isFinite(parsed) ? parsed : 0,
              });
              setEditing(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.currentTarget.blur();
              }
              if (event.key === 'Escape') {
                setEditing(null);
              }
            }}
          />
        ) : (
          <UnstyledButton
            onClick={() => setEditing('amount')}
            aria-label={`עריכת סכום ${expense.description}`}
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: isCredit ? COLORS.income : COLORS.expense,
              direction: 'ltr',
              unicodeBidi: 'isolate',
              whiteSpace: 'nowrap',
            }}
          >
            {formatCurrency(expense.amount)}
          </UnstyledButton>
        )}
      </Table.Td>

      <Table.Td>
        <ActionIcon
          variant="subtle"
          color="red"
          size="sm"
          radius="xl"
          aria-label={`מחיקת הוצאה ${expense.description}`}
          onClick={() => removeExpense(year, month, expense.id)}
        >
          <IconX size={15} />
        </ActionIcon>
      </Table.Td>
    </Table.Tr>
  );
}
