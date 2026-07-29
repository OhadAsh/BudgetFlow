import { useState } from 'react';
import {
  ActionIcon,
  Badge,
  NumberInput,
  Select,
  Table,
  TextInput,
  UnstyledButton,
} from '@mantine/core';
import { IconX } from '@tabler/icons-react';
import type { CategoryType, Expense } from '../../types';
import { CATEGORIES, CATEGORY_COLORS, CATEGORY_ICONS, COLORS } from '../../lib/constants';
import { formatCurrency, isCategoryType } from '../../lib/utils';
import { useExpenseStore } from '../../store/useExpenseStore';

interface ExpenseRowProps {
  expense: Expense;
  year: number;
  month: number;
}

type EditingField = 'category' | 'description' | 'amount' | null;

const CATEGORY_OPTIONS = CATEGORIES.map((category) => ({
  value: category,
  label: `${CATEGORY_ICONS[category]} ${category}`,
}));

export function ExpenseRow({ expense, year, month }: ExpenseRowProps): JSX.Element {
  const updateExpense = useExpenseStore((state) => state.updateExpense);
  const removeExpense = useExpenseStore((state) => state.removeExpense);
  const [editing, setEditing] = useState<EditingField>(null);

  const handleCategoryChange = (value: string | null): void => {
    if (value !== null && isCategoryType(value)) {
      updateExpense(year, month, expense.id, { category: value as CategoryType });
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
            data={CATEGORY_OPTIONS}
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
                  backgroundColor: `${CATEGORY_COLORS[expense.category]}1A`,
                  color: CATEGORY_COLORS[expense.category],
                  textTransform: 'none',
                  fontWeight: 600,
                },
              }}
            >
              {`${CATEGORY_ICONS[expense.category]} ${expense.category}`}
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
              updateExpense(year, month, expense.id, {
                description: value.length > 0 ? value : 'הוצאה',
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
            onClick={() => setEditing('description')}
            aria-label={`עריכת תיאור ${expense.description}`}
            style={{ fontSize: 14, color: COLORS.textPrimary, width: '100%', textAlign: 'start' }}
          >
            {expense.description}
          </UnstyledButton>
        )}
      </Table.Td>

      <Table.Td>
        {editing === 'amount' ? (
          <NumberInput
            size="xs"
            autoFocus
            prefix="₪"
            min={0}
            step={50}
            thousandSeparator=","
            hideControls
            aria-label="סכום הוצאה"
            defaultValue={expense.amount}
            onBlur={(event) => {
              const parsed = Number.parseFloat(event.currentTarget.value.replace(/[^\d.-]/g, ''));
              updateExpense(year, month, expense.id, {
                amount: Number.isFinite(parsed) ? Math.abs(parsed) : 0,
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
            style={{ fontSize: 14, fontWeight: 600, color: COLORS.textPrimary }}
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
