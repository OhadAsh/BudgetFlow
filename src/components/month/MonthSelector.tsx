import { ActionIcon, Box, Card, Group, Indicator, Stack, Text, UnstyledButton } from '@mantine/core';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { HEBREW_MONTHS, COLORS } from '../../lib/constants';
import { formatMonthYear, nextPeriod, previousPeriod } from '../../lib/utils';
import { useExpenseStore } from '../../store/useExpenseStore';
import { useMonthData } from '../../hooks/useMonthData';

export function MonthSelector(): JSX.Element {
  const setSelectedPeriod = useExpenseStore((state) => state.setSelectedPeriod);
  const { year, month, monthsWithData, stats } = useMonthData();

  const goPrevious = (): void => {
    const target = previousPeriod(year, month);
    setSelectedPeriod(target.year, target.month);
  };

  const goNext = (): void => {
    const target = nextPeriod(year, month);
    setSelectedPeriod(target.year, target.month);
  };

  return (
    <Card>
      <Stack gap="md">
        <Group justify="space-between" wrap="nowrap">
          {/* In RTL the chevron pointing right moves backwards in time. */}
          <ActionIcon
            variant="subtle"
            color="gray"
            size="lg"
            radius="xl"
            aria-label="חודש קודם"
            onClick={goPrevious}
          >
            <IconChevronRight size={22} />
          </ActionIcon>

          <Stack gap={0} align="center">
            <Text fw={700} fz="1.5rem" c={COLORS.textPrimary} ta="center">
              {formatMonthYear(year, month)}
            </Text>
            <Text fz="xs" c={COLORS.textSecondary}>
              {stats.hasData ? `${stats.expenseCount} הוצאות רשומות` : 'אין נתונים לחודש זה'}
            </Text>
          </Stack>

          <ActionIcon
            variant="subtle"
            color="gray"
            size="lg"
            radius="xl"
            aria-label="חודש הבא"
            onClick={goNext}
          >
            <IconChevronLeft size={22} />
          </ActionIcon>
        </Group>

        <Box
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
            gap: 8,
          }}
        >
          {HEBREW_MONTHS.map((name, index) => {
            const monthNumber = index + 1;
            const isActive = monthNumber === month;
            const hasData = monthsWithData.includes(monthNumber);

            return (
              <Indicator
                key={name}
                w="100%"
                disabled={!hasData || isActive}
                color="emerald"
                size={6}
                offset={6}
                position="top-end"
              >
                <UnstyledButton
                  onClick={() => setSelectedPeriod(year, monthNumber)}
                  aria-label={`${name} ${year}`}
                  aria-pressed={isActive}
                  style={{
                    width: '100%',
                    padding: '6px 4px',
                    borderRadius: 999,
                    textAlign: 'center',
                    fontSize: 13,
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? '#FFFFFF' : COLORS.textSecondary,
                    backgroundColor: isActive ? COLORS.primary : '#F1F5F9',
                    transition: 'background-color 150ms ease, color 150ms ease',
                  }}
                >
                  {name}
                </UnstyledButton>
              </Indicator>
            );
          })}
        </Box>
      </Stack>
    </Card>
  );
}
