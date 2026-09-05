import { Box, Card, Group, Progress, SimpleGrid, Stack, Text } from '@mantine/core';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { CategoryBreakdownItem } from '../../types';
import { COLORS, SECTION_TITLE_STYLE } from '../../lib/constants';
import { formatCurrency, formatPercent } from '../../lib/utils';
import { useMonthData } from '../../hooks/useMonthData';
import { useExpenseStore } from '../../store/useExpenseStore';

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
  const categoryTargets = useExpenseStore((state) => state.categoryTargets);

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

            <SimpleGrid cols={1} spacing={8}>
              {breakdown.map((item) => {
                const target = categoryTargets[item.category];
                const hasTarget = typeof target === 'number' && target > 0;
                const ratio = hasTarget ? (item.amount / target) * 100 : null;
                const overTarget = ratio !== null && ratio > 100;

                return (
                  <Box key={item.category}>
                    <Group gap={6} wrap="nowrap" justify="space-between">
                      <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
                        <Box
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 999,
                            backgroundColor: item.color,
                            flexShrink: 0,
                          }}
                        />
                        <Text fz="xs" c={COLORS.textPrimary} truncate>
                          {item.category}
                        </Text>
                      </Group>
                      <Text
                        fz="xs"
                        fw={600}
                        c={overTarget ? COLORS.expense : COLORS.textSecondary}
                        style={{ whiteSpace: 'nowrap', direction: 'ltr', unicodeBidi: 'isolate' }}
                      >
                        {hasTarget
                          ? `${formatCurrency(item.amount)} / ${formatCurrency(target)}`
                          : `${formatCurrency(item.amount)} · ${formatPercent(item.percentage)}`}
                      </Text>
                    </Group>
                    {hasTarget && ratio !== null && (
                      <Progress
                        mt={4}
                        size="sm"
                        radius="xl"
                        value={Math.min(ratio, 100)}
                        color={overTarget ? 'red' : 'emerald'}
                        aria-label={`התקדמות יעד ${item.category}`}
                      />
                    )}
                    {hasTarget && ratio !== null && (
                      <Text fz={11} c={overTarget ? COLORS.expense : COLORS.textSecondary} mt={2}>
                        {overTarget
                          ? `${formatPercent(ratio)} מהיעד (חריגה)`
                          : `${formatPercent(ratio)} מהיעד · נותר ${formatCurrency(Math.max(target - item.amount, 0))}`}
                      </Text>
                    )}
                  </Box>
                );
              })}
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
