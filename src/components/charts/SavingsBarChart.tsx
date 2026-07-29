import { Box, Card, Stack, Text } from '@mantine/core';
import {
  Bar,
  BarChart,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { MonthlySeriesPoint } from '../../types';
import { COLORS, HEBREW_MONTHS, SECTION_TITLE_STYLE } from '../../lib/constants';
import { formatCompactCurrency, formatCurrency } from '../../lib/utils';
import { useExpenseStore } from '../../store/useExpenseStore';
import { useMonthData } from '../../hooks/useMonthData';

interface TooltipEntry {
  payload?: MonthlySeriesPoint;
}

interface SavingsTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
}

function SavingsTooltip({ active, payload }: SavingsTooltipProps): JSX.Element | null {
  const point = active === true && payload && payload.length > 0 ? payload[0].payload : undefined;
  if (!point) return null;

  return (
    <Box
      p="xs"
      bg="#FFFFFF"
      style={{
        borderRadius: 12,
        boxShadow: '0 4px 16px rgba(15, 23, 42, 0.12)',
        direction: 'rtl',
      }}
    >
      <Text fz="sm" fw={700} c={COLORS.textPrimary}>
        {HEBREW_MONTHS[point.month - 1]}
      </Text>
      {point.hasData ? (
        <>
          <Text fz="xs" c={point.saved >= 0 ? COLORS.income : COLORS.expense} fw={600}>
            {`נחסך: ${formatCurrency(point.saved)}`}
          </Text>
          <Text fz="xs" c={COLORS.textSecondary}>
            {`הכנסות ${formatCurrency(point.income)} · הוצאות ${formatCurrency(point.expenses)}`}
          </Text>
        </>
      ) : (
        <Text fz="xs" c={COLORS.textSecondary}>
          אין נתונים
        </Text>
      )}
    </Box>
  );
}

export function SavingsBarChart(): JSX.Element {
  const { monthlySeries, year } = useMonthData();
  const setSelectedPeriod = useExpenseStore((state) => state.setSelectedPeriod);

  // Recharts reports the clicked category by index on the chart itself.
  const handleChartClick = (state: { activeTooltipIndex?: number }): void => {
    const index = state.activeTooltipIndex;
    if (typeof index === 'number' && index >= 0 && index < monthlySeries.length) {
      setSelectedPeriod(year, monthlySeries[index].month);
    }
  };

  return (
    <Card>
      <Stack gap="sm">
        <Text style={SECTION_TITLE_STYLE}>חיסכון לאורך השנה</Text>
        <Box style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={monthlySeries}
              margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
              onClick={handleChartClick}
              style={{ cursor: 'pointer' }}
            >
              <XAxis
                dataKey="label"
                reversed
                tick={{ fontSize: 12, fill: COLORS.textSecondary }}
                axisLine={{ stroke: COLORS.border }}
                tickLine={false}
              />
              <YAxis
                orientation="right"
                tickFormatter={formatCompactCurrency}
                tick={{ fontSize: 11, fill: COLORS.textSecondary }}
                axisLine={false}
                tickLine={false}
                width={58}
              />
              <ReferenceLine y={0} stroke={COLORS.border} />
              <Tooltip content={<SavingsTooltip />} cursor={{ fill: 'rgba(148,163,184,0.12)' }} />
              <Bar
                dataKey="saved"
                radius={[8, 8, 0, 0]}
                isAnimationActive
                animationDuration={600}
              >
                {monthlySeries.map((point) => (
                  <Cell
                    key={point.month}
                    fill={
                      !point.hasData
                        ? COLORS.ghost
                        : point.saved >= 0
                          ? COLORS.income
                          : COLORS.expense
                    }
                    fillOpacity={point.hasData ? 1 : 0.5}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Box>
        <Text fz="xs" c={COLORS.textSecondary} ta="center">
          לחיצה על עמודה עוברת לחודש המתאים
        </Text>
      </Stack>
    </Card>
  );
}
