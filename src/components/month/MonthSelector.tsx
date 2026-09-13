import { ActionIcon, Box, Card, Group, Indicator, Stack, Text, UnstyledButton } from '@mantine/core';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { HEBREW_MONTHS, SHORT_MONTHS, COLORS } from '../../lib/constants';
import { formatMonthYear, nextPeriod, previousPeriod } from '../../lib/utils';
import { useExpenseStore } from '../../store/useExpenseStore';
import { useMonthData } from '../../hooks/useMonthData';
import { OutlierMonthControls } from './OutlierMonthControls';

export function MonthSelector(): JSX.Element {
  const setSelectedPeriod = useExpenseStore((state) => state.setSelectedPeriod);
  const { year, month, monthsWithData, outlierMonths, stats } = useMonthData();

  const goPrevious = (): void => {
    const target = previousPeriod(year, month);
    setSelectedPeriod(target.year, target.month);
  };

  const goNext = (): void => {
    const target = nextPeriod(year, month);
    setSelectedPeriod(target.year, target.month);
  };

  return (
    <Card style={{ overflow: 'hidden' }}>
      <Stack gap="md" style={{ minWidth: 0 }}>
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

          <Stack gap={0} align="center" style={{ flex: 1, minWidth: 0 }}>
            <Text
              fw={700}
              fz={{ base: '1.25rem', sm: '1.5rem' }}
              c={COLORS.textPrimary}
              ta="center"
              truncate
            >
              {formatMonthYear(year, month)}
            </Text>
            <Text fz="xs" c={COLORS.textSecondary} ta="center">
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
            gap: 6,
            width: '100%',
            minWidth: 0,
          }}
        >
          {HEBREW_MONTHS.map((name, index) => {
            const monthNumber = index + 1;
            const isActive = monthNumber === month;
            const hasData = monthsWithData.includes(monthNumber);
            const isOutlier = outlierMonths.includes(monthNumber);
            const shortName = SHORT_MONTHS[index];

            return (
              <Indicator
                key={name}
                w="100%"
                disabled={(!hasData && !isOutlier) || isActive}
                color={isOutlier ? 'orange' : 'emerald'}
                size={6}
                offset={4}
                position="top-end"
                style={{ minWidth: 0 }}
              >
                <UnstyledButton
                  onClick={() => setSelectedPeriod(year, monthNumber)}
                  aria-label={`${name} ${year}${isOutlier ? ' (חריג)' : ''}`}
                  aria-pressed={isActive}
                  title={isOutlier ? `${name} · חודש חריג` : name}
                  style={{
                    width: '100%',
                    minWidth: 0,
                    padding: '6px 2px',
                    borderRadius: 999,
                    textAlign: 'center',
                    fontSize: 12,
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? '#FFFFFF' : COLORS.textSecondary,
                    backgroundColor: isActive
                      ? isOutlier
                        ? COLORS.amber
                        : COLORS.primary
                      : COLORS.mutedBg,
                    transition: 'background-color 150ms ease, color 150ms ease',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {shortName}
                </UnstyledButton>
              </Indicator>
            );
          })}
        </Box>

        <OutlierMonthControls />
      </Stack>
    </Card>
  );
}
