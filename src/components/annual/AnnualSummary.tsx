import {
  Badge,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Table,
  Text,
  UnstyledButton,
} from '@mantine/core';
import { IconMoodSad, IconTrophy } from '@tabler/icons-react';
import { BIG_NUMBER_STYLE, COLORS, SECTION_TITLE_STYLE } from '../../lib/constants';
import {
  formatCurrency,
  formatPercent,
  getMonthName,
  getSavingsRateColor,
} from '../../lib/utils';
import { calcSavingsRate } from '../../lib/calculations';
import { useExpenseStore } from '../../store/useExpenseStore';
import { useMonthData } from '../../hooks/useMonthData';
import { YearSelector } from './YearSelector';

interface StatCardProps {
  title: string;
  value: number;
  color: string;
  hint: string;
}

function StatCard({ title, value, color, hint }: StatCardProps): JSX.Element {
  return (
    <Card>
      <Stack gap={2}>
        <Text style={SECTION_TITLE_STYLE} fz="0.75rem">
          {title}
        </Text>
        <Text style={{ ...BIG_NUMBER_STYLE, fontSize: '1.625rem' }} c={color}>
          {formatCurrency(value)}
        </Text>
        <Text fz="xs" c={COLORS.textSecondary}>
          {hint}
        </Text>
      </Stack>
    </Card>
  );
}

export function AnnualSummary(): JSX.Element {
  const { annualStats, monthlySeries, year, month } = useMonthData();
  const setSelectedPeriod = useExpenseStore((state) => state.setSelectedPeriod);

  const activeMonths = monthlySeries.filter((point) => point.hasData).length;
  const annualRate = calcSavingsRate(annualStats.totalSaved, annualStats.totalIncome);

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Text style={SECTION_TITLE_STYLE}>📅 סיכום שנתי</Text>
        <YearSelector />
      </Group>

      <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="md">
        <StatCard
          title='סה"כ הכנסות'
          value={annualStats.totalIncome}
          color={COLORS.income}
          hint={`${activeMonths} חודשים עם נתונים`}
        />
        <StatCard
          title='סה"כ הוצאות'
          value={annualStats.totalExpenses}
          color={COLORS.expense}
          hint="ללא הפקדות לחיסכון"
        />
        <StatCard
          title="נחסך"
          value={annualStats.totalSaved}
          color={annualStats.totalSaved >= 0 ? COLORS.income : COLORS.expense}
          hint={`${formatPercent(annualRate)} מההכנסה השנתית`}
        />
        <StatCard
          title="ממוצע חודשי"
          value={annualStats.avgMonthlySavings}
          color={annualStats.avgMonthlySavings >= 0 ? COLORS.income : COLORS.expense}
          hint="חיסכון ממוצע לחודש פעיל"
        />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="md">
        <Card bg="#ECFDF5">
          <Group gap="sm" wrap="nowrap">
            <IconTrophy size={30} color={COLORS.income} />
            <Stack gap={0}>
              <Text fz="xs" c={COLORS.textSecondary} fw={600}>
                החודש הטוב
              </Text>
              <Text fw={700} fz="lg" c={COLORS.textPrimary}>
                {annualStats.bestMonth.month > 0 ? getMonthName(annualStats.bestMonth.month) : '—'}
              </Text>
              <Text fw={700} c="emerald.7">
                {formatCurrency(annualStats.bestMonth.saved)}
              </Text>
            </Stack>
          </Group>
        </Card>

        <Card bg="#FEF2F2">
          <Group gap="sm" wrap="nowrap">
            <IconMoodSad size={30} color={COLORS.expense} />
            <Stack gap={0}>
              <Text fz="xs" c={COLORS.textSecondary} fw={600}>
                החודש הקשה
              </Text>
              <Text fw={700} fz="lg" c={COLORS.textPrimary}>
                {annualStats.worstMonth.month > 0 ? getMonthName(annualStats.worstMonth.month) : '—'}
              </Text>
              <Text fw={700} c="red.6">
                {formatCurrency(annualStats.worstMonth.saved)}
              </Text>
            </Stack>
          </Group>
        </Card>
      </SimpleGrid>

      <Card>
        <Stack gap="sm">
          <Text style={SECTION_TITLE_STYLE} fz="0.875rem">
            {`כל החודשים · ${year}`}
          </Text>
          <Table.ScrollContainer minWidth={480}>
            <Table verticalSpacing="xs" horizontalSpacing="sm" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ color: COLORS.textSecondary, fontWeight: 600 }}>חודש</Table.Th>
                  <Table.Th style={{ color: COLORS.textSecondary, fontWeight: 600 }}>הכנסות</Table.Th>
                  <Table.Th style={{ color: COLORS.textSecondary, fontWeight: 600 }}>הוצאות</Table.Th>
                  <Table.Th style={{ color: COLORS.textSecondary, fontWeight: 600 }}>נחסך</Table.Th>
                  <Table.Th style={{ color: COLORS.textSecondary, fontWeight: 600 }}>שיעור</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {monthlySeries.map((point) => {
                  const rate = calcSavingsRate(point.saved, point.income);
                  const isSelected = point.month === month;

                  return (
                    <Table.Tr
                      key={point.month}
                      bg={isSelected ? '#F1F5F9' : point.hasData ? undefined : '#FCFDFE'}
                    >
                      <Table.Td>
                        <UnstyledButton
                          onClick={() => setSelectedPeriod(year, point.month)}
                          aria-label={`מעבר ל${getMonthName(point.month)} ${year}`}
                          style={{
                            fontSize: 14,
                            fontWeight: isSelected ? 700 : 500,
                            color: point.hasData ? COLORS.textPrimary : COLORS.textSecondary,
                          }}
                        >
                          {getMonthName(point.month)}
                        </UnstyledButton>
                      </Table.Td>
                      <Table.Td>
                        <Text fz="sm" c={point.hasData ? COLORS.income : COLORS.textSecondary}>
                          {point.hasData ? formatCurrency(point.income) : '—'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text fz="sm" c={point.hasData ? COLORS.expense : COLORS.textSecondary}>
                          {point.hasData ? formatCurrency(point.expenses) : '—'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text
                          fz="sm"
                          fw={600}
                          c={
                            point.hasData
                              ? point.saved >= 0
                                ? COLORS.income
                                : COLORS.expense
                              : COLORS.textSecondary
                          }
                        >
                          {point.hasData ? formatCurrency(point.saved) : '—'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        {point.hasData ? (
                          <Badge variant="light" color={getSavingsRateColor(rate)} radius="sm">
                            {formatPercent(rate)}
                          </Badge>
                        ) : (
                          <Text fz="sm" c={COLORS.textSecondary}>
                            —
                          </Text>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Stack>
      </Card>
    </Stack>
  );
}
