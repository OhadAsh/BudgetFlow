import { Box, Card, Group, Stack, Text } from '@mantine/core';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { COLORS, HEBREW_MONTHS, SECTION_TITLE_STYLE } from '../../lib/constants';
import { formatCompactCurrency, formatCurrency } from '../../lib/utils';
import { useMonthData } from '../../hooks/useMonthData';

interface TrendPoint {
  month: number;
  label: string;
  income: number;
  expenses: number;
  saved: number;
  savingsZone: [number, number];
  hasData: boolean;
}

interface TooltipEntry {
  payload?: TrendPoint;
}

interface TrendTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
}

function TrendTooltip({ active, payload }: TrendTooltipProps): JSX.Element | null {
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
      <Text fz="xs" c={COLORS.income} fw={600}>
        {`הכנסות: ${formatCurrency(point.income)}`}
      </Text>
      <Text fz="xs" c={COLORS.expense} fw={600}>
        {`הוצאות: ${formatCurrency(point.expenses)}`}
      </Text>
      <Text fz="xs" c={point.saved >= 0 ? COLORS.income : COLORS.expense}>
        {`נחסך: ${formatCurrency(point.saved)}`}
      </Text>
    </Box>
  );
}

export function TrendLineChart(): JSX.Element {
  const { monthlySeries } = useMonthData();

  const data: TrendPoint[] = monthlySeries.map((point) => ({
    ...point,
    savingsZone: [Math.min(point.income, point.expenses), Math.max(point.income, point.expenses)],
  }));

  return (
    <Card>
      <Stack gap="sm">
        <Group justify="space-between" align="center">
          <Text style={SECTION_TITLE_STYLE}>מגמת הכנסות מול הוצאות</Text>
          <Group gap="sm">
            <Group gap={4}>
              <Box style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: COLORS.income }} />
              <Text fz="xs" c={COLORS.textSecondary}>
                הכנסות
              </Text>
            </Group>
            <Group gap={4}>
              <Box style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: COLORS.expense }} />
              <Text fz="xs" c={COLORS.textSecondary}>
                הוצאות
              </Text>
            </Group>
          </Group>
        </Group>

        <Box style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid stroke={COLORS.border} strokeDasharray="3 3" vertical={false} />
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
              <Tooltip content={<TrendTooltip />} />
              <Area
                dataKey="savingsZone"
                stroke="none"
                fill={COLORS.primary}
                fillOpacity={0.1}
                isAnimationActive
                animationDuration={600}
                activeDot={false}
              />
              <Line
                type="monotone"
                dataKey="income"
                stroke={COLORS.income}
                strokeWidth={3}
                dot={{ r: 3, fill: COLORS.income, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                isAnimationActive
                animationDuration={600}
              />
              <Line
                type="monotone"
                dataKey="expenses"
                stroke={COLORS.expense}
                strokeWidth={3}
                dot={{ r: 3, fill: COLORS.expense, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                isAnimationActive
                animationDuration={600}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </Box>
      </Stack>
    </Card>
  );
}
