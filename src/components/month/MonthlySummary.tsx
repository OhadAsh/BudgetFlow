import { Card, Group, Progress, RingProgress, SimpleGrid, Stack, Text } from '@mantine/core';
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

      <Card h="100%" style={{ overflow: 'hidden' }}>
        <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm" h="100%">
          <Stack gap={6} style={{ flex: 1, minWidth: 0 }} justify="space-between">
            <Text style={SECTION_TITLE_STYLE} fz="0.8125rem">
              ✨ נחסך
            </Text>
            <Text style={BIG_NUMBER_STYLE} c={savingsColor}>
              {formatCurrency(stats.netSaved)}
            </Text>
            <Text fz="xs" c={COLORS.textSecondary} lineClamp={2}>
              {`${formatPercent(stats.savingsRate)} מההכנסה · ${getSavingsRateLabel(stats.savingsRate)}`}
            </Text>
            <Progress
              value={ringValue}
              color={rateColor}
              size="sm"
              radius="xl"
              aria-label="שיעור חיסכון"
            />
          </Stack>
          <RingProgress
            size={64}
            thickness={7}
            roundCaps
            style={{ flexShrink: 0 }}
            aria-label="טבעת שיעור חיסכון"
            sections={[{ value: ringValue, color: rateColor }]}
            label={
              <Text
                ta="center"
                fw={700}
                fz="xs"
                c={savingsColor}
                style={{ direction: 'ltr', unicodeBidi: 'isolate', whiteSpace: 'nowrap' }}
              >
                {formatPercent(stats.savingsRate)}
              </Text>
            }
          />
        </Group>
      </Card>
    </SimpleGrid>
  );
}
