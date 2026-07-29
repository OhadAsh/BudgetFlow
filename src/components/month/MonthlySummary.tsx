import { Card, Group, Progress, SimpleGrid, Stack, Text } from '@mantine/core';
import { IconTrendingDown, IconTrendingUp } from '@tabler/icons-react';
import { BIG_NUMBER_STYLE, COLORS, SECTION_TITLE_STYLE } from '../../lib/constants';
import {
  formatCurrency,
  formatPercent,
  formatSignedCurrency,
  getSavingsRateColor,
  getSavingsRateLabel,
} from '../../lib/utils';
import { useMonthData } from '../../hooks/useMonthData';
import { SavingsRing } from './SavingsRing';

export function MonthlySummary(): JSX.Element {
  const { stats, incomeDelta, expensesDelta, previousStats } = useMonthData();

  const savingsColor = stats.netSaved >= 0 ? COLORS.income : COLORS.expense;
  const rateColor = getSavingsRateColor(stats.savingsRate);
  const ringValue = Math.min(100, Math.max(0, stats.savingsRate));
  const hasPrevious = previousStats.hasData;

  return (
    <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
      <Card h="100%">
        <Stack gap={6} justify="space-between" h="100%">
          <Text style={SECTION_TITLE_STYLE} fz="0.8125rem">
            💚 הכנסות
          </Text>
          <Text style={BIG_NUMBER_STYLE} c={COLORS.income}>
            {formatCurrency(stats.totalIncome)}
          </Text>
          {hasPrevious ? (
            <Group gap={4} align="center" wrap="wrap">
              {incomeDelta >= 0 ? (
                <IconTrendingUp size={16} color={COLORS.income} />
              ) : (
                <IconTrendingDown size={16} color={COLORS.expense} />
              )}
              <Text
                fz="xs"
                c={incomeDelta >= 0 ? 'emerald.7' : 'red.6'}
                fw={600}
                style={{ direction: 'ltr', unicodeBidi: 'isolate', whiteSpace: 'nowrap' }}
              >
                {formatSignedCurrency(incomeDelta)}
              </Text>
              <Text fz="xs" c={COLORS.textSecondary}>
                מול חודש קודם
              </Text>
            </Group>
          ) : (
            <Text fz="xs" c={COLORS.textSecondary}>
              אין נתוני השוואה לחודש קודם
            </Text>
          )}
        </Stack>
      </Card>

      <Card h="100%">
        <Stack gap={6} justify="space-between" h="100%">
          <Text style={SECTION_TITLE_STYLE} fz="0.8125rem">
            🔴 הוצאות
          </Text>
          <Text style={BIG_NUMBER_STYLE} c={COLORS.expense}>
            {formatCurrency(stats.totalExpenses)}
          </Text>
          <Group gap={6} align="center" wrap="wrap">
            <Text fz="xs" c={COLORS.textSecondary}>
              {`קטגוריות: ${stats.activeCategoryCount}`}
            </Text>
            {hasPrevious && (
              <Text
                fz="xs"
                c={expensesDelta <= 0 ? 'emerald.7' : 'red.6'}
                fw={600}
                style={{ direction: 'ltr', unicodeBidi: 'isolate', whiteSpace: 'nowrap' }}
              >
                {formatSignedCurrency(expensesDelta)}
              </Text>
            )}
          </Group>
        </Stack>
      </Card>

      <Card h="100%">
        <Stack gap="sm" h="100%" justify="space-between" style={{ minWidth: 0 }}>
          <Text style={SECTION_TITLE_STYLE} fz="0.8125rem">
            ✨ נחסך
          </Text>

          <Group wrap="nowrap" align="center" gap="md" style={{ minWidth: 0 }}>
            <SavingsRing value={stats.savingsRate} color={rateColor} labelColor={savingsColor} />
            <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
              <Text
                c={savingsColor}
                style={{
                  ...BIG_NUMBER_STYLE,
                  fontSize: 'clamp(1.1rem, 2vw, 1.75rem)',
                }}
              >
                {formatCurrency(stats.netSaved)}
              </Text>
              <Text fz="xs" c={COLORS.textSecondary} lineClamp={2}>
                {`${formatPercent(stats.savingsRate)} מההכנסה · ${getSavingsRateLabel(stats.savingsRate)}`}
              </Text>
            </Stack>
          </Group>

          <Progress
            value={ringValue}
            color={rateColor}
            size="sm"
            radius="xl"
            aria-label="שיעור חיסכון"
          />
        </Stack>
      </Card>
    </SimpleGrid>
  );
}
