import { Box, Card, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { CategoryBreakdownItem } from '../../types';
import { COLORS, SECTION_TITLE_STYLE } from '../../lib/constants';
import { formatCurrency, formatPercent } from '../../lib/utils';
import { useMonthData } from '../../hooks/useMonthData';

interface TooltipEntry {
  payload?: CategoryBreakdownItem;
}

interface CategoryTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
}

function CategoryTooltip({ active, payload }: CategoryTooltipProps): JSX.Element | null {
  const item = active === true && payload && payload.length > 0 ? payload[0].payload : undefined;
  if (!item) return null;

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
        {`${item.icon} ${item.category}`}
      </Text>
      <Text fz="sm" c={item.color} fw={600}>
        {formatCurrency(item.amount)}
      </Text>
      <Text fz="xs" c={COLORS.textSecondary}>
        {`${formatPercent(item.percentage)} מסך ההוצאות`}
      </Text>
    </Box>
  );
}

export function CategoryPieChart(): JSX.Element {
  const { breakdown, largestCategory, stats } = useMonthData();

  return (
    <Card>
      <Stack gap="sm">
        <Text style={SECTION_TITLE_STYLE}>לאן הלך הכסף?</Text>

        {breakdown.length === 0 ? (
          <Text fz="sm" c={COLORS.textSecondary} py="xl" ta="center">
            אין הוצאות להצגה בחודש זה
          </Text>
        ) : (
          <>
            <Box style={{ position: 'relative', width: '100%', height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={breakdown}
                    dataKey="amount"
                    nameKey="category"
                    innerRadius={60}
                    outerRadius={95}
                    paddingAngle={2}
                    stroke="none"
                    isAnimationActive
                    animationDuration={600}
                  >
                    {breakdown.map((item) => (
                      <Cell key={item.category} fill={item.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CategoryTooltip />} />
                </PieChart>
              </ResponsiveContainer>

              <Stack
                gap={0}
                align="center"
                style={{
                  position: 'absolute',
                  inset: 0,
                  justifyContent: 'center',
                  pointerEvents: 'none',
                }}
              >
                <Text fz="xs" c={COLORS.textSecondary}>
                  הקטגוריה המובילה
                </Text>
                <Text fz="sm" fw={700} c={COLORS.textPrimary}>
                  {largestCategory ? `${largestCategory.icon} ${largestCategory.category}` : '—'}
                </Text>
                <Text fz="sm" fw={700} c={largestCategory?.color ?? COLORS.textPrimary}>
                  {formatCurrency(largestCategory?.amount ?? 0)}
                </Text>
              </Stack>
            </Box>

            <SimpleGrid cols={2} spacing={6} verticalSpacing={6}>
              {breakdown.map((item) => (
                <Group key={item.category} gap={6} wrap="nowrap">
                  <Box
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 999,
                      backgroundColor: item.color,
                      flexShrink: 0,
                    }}
                  />
                  <Text fz="xs" c={COLORS.textPrimary} style={{ whiteSpace: 'nowrap' }}>
                    {item.category}
                  </Text>
                  <Text fz="xs" fw={600} c={COLORS.textSecondary} style={{ whiteSpace: 'nowrap' }}>
                    {`${formatCurrency(item.amount)} · ${formatPercent(item.percentage)}`}
                  </Text>
                </Group>
              ))}
            </SimpleGrid>

            <Text fz="xs" c={COLORS.textSecondary} ta="center">
              {`סך ההוצאות: ${formatCurrency(stats.totalExpenses)}`}
            </Text>
          </>
        )}
      </Stack>
    </Card>
  );
}
