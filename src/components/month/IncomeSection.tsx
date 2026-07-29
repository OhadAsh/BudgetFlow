import { useState } from 'react';
import {
  ActionIcon,
  Box,
  Button,
  Card,
  Divider,
  Group,
  NumberInput,
  Stack,
  Table,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core';
import { IconPlus, IconX } from '@tabler/icons-react';
import type { IncomeSource } from '../../types';
import { COLORS, SECTION_TITLE_STYLE } from '../../lib/constants';
import { formatCurrency } from '../../lib/utils';
import { useExpenseStore } from '../../store/useExpenseStore';
import { useMonthData } from '../../hooks/useMonthData';

type EditingField = 'label' | 'amount';

interface EditingState {
  id: string;
  field: EditingField;
}

export function IncomeSection(): JSX.Element {
  const { year, month, monthData, stats } = useMonthData();
  const addIncome = useExpenseStore((state) => state.addIncome);
  const updateIncome = useExpenseStore((state) => state.updateIncome);
  const removeIncome = useExpenseStore((state) => state.removeIncome);

  const [editing, setEditing] = useState<EditingState | null>(null);

  const handleAdd = (): void => {
    addIncome(year, month, { label: 'הכנסה חדשה', amount: 0 });
  };

  const isEditing = (source: IncomeSource, field: EditingField): boolean =>
    editing !== null && editing.id === source.id && editing.field === field;

  return (
    <Card style={{ overflow: 'hidden' }}>
      <Stack gap="sm" style={{ minWidth: 0 }}>
        <Group justify="space-between" align="center" wrap="nowrap" gap="sm">
          <Text style={{ ...SECTION_TITLE_STYLE, minWidth: 0 }} truncate>
            💰 הכנסות החודש
          </Text>
          <Text
            fw={700}
            c="emerald.6"
            style={{ direction: 'ltr', unicodeBidi: 'isolate', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            {formatCurrency(stats.totalIncome)}
          </Text>
        </Group>

        {monthData.income.length === 0 ? (
          <Text fz="sm" c={COLORS.textSecondary} py="sm" ta="center">
            לא נרשמו הכנסות לחודש זה
          </Text>
        ) : (
          <Table.ScrollContainer minWidth={280} type="native">
          <Table verticalSpacing="xs" horizontalSpacing="xs" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ color: COLORS.textSecondary, fontWeight: 600 }}>תיאור</Table.Th>
                <Table.Th style={{ color: COLORS.textSecondary, fontWeight: 600, width: 130 }}>
                  סכום
                </Table.Th>
                <Table.Th style={{ width: 44 }} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {monthData.income.map((source) => (
                <Table.Tr key={source.id}>
                  <Table.Td>
                    {isEditing(source, 'label') ? (
                      <TextInput
                        size="xs"
                        autoFocus
                        aria-label="תיאור הכנסה"
                        defaultValue={source.label}
                        onBlur={(event) => {
                          const value = event.currentTarget.value.trim();
                          updateIncome(year, month, source.id, {
                            label: value.length > 0 ? value : 'הכנסה',
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
                        onClick={() => setEditing({ id: source.id, field: 'label' })}
                        aria-label={`עריכת תיאור ${source.label}`}
                        style={{ fontSize: 14, color: COLORS.textPrimary, width: '100%' }}
                      >
                        {source.label}
                      </UnstyledButton>
                    )}
                  </Table.Td>

                  <Table.Td>
                    {isEditing(source, 'amount') ? (
                      <NumberInput
                        size="xs"
                        autoFocus
                        prefix="₪"
                        min={0}
                        step={100}
                        thousandSeparator=","
                        hideControls
                        aria-label="סכום הכנסה"
                        defaultValue={source.amount}
                        onBlur={(event) => {
                          const parsed = Number.parseFloat(
                            event.currentTarget.value.replace(/[^\d.-]/g, '')
                          );
                          updateIncome(year, month, source.id, {
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
                        onClick={() => setEditing({ id: source.id, field: 'amount' })}
                        aria-label={`עריכת סכום ${source.label}`}
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: COLORS.income,
                          direction: 'ltr',
                          unicodeBidi: 'isolate',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {formatCurrency(source.amount)}
                      </UnstyledButton>
                    )}
                  </Table.Td>

                  <Table.Td>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      size="sm"
                      radius="xl"
                      aria-label={`מחיקת הכנסה ${source.label}`}
                      onClick={() => removeIncome(year, month, source.id)}
                    >
                      <IconX size={15} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          </Table.ScrollContainer>
        )}

        <Divider color={COLORS.border} />

        <Group justify="space-between" align="center" wrap="wrap" gap="sm">
          <Button
            variant="subtle"
            color="emerald"
            size="xs"
            leftSection={<IconPlus size={15} />}
            onClick={handleAdd}
          >
            הוסף הכנסה
          </Button>
          <Box style={{ minWidth: 0 }}>
            <Text fz="xs" c={COLORS.textSecondary} ta="end">
              סה"כ הכנסות
            </Text>
            <Text
              fw={700}
              fz="lg"
              c="emerald.6"
              ta="end"
              style={{ direction: 'ltr', unicodeBidi: 'isolate', whiteSpace: 'nowrap' }}
            >
              {formatCurrency(stats.totalIncome)}
            </Text>
          </Box>
        </Group>
      </Stack>
    </Card>
  );
}
