import { useState } from 'react';
import { Box, Container, Divider, Grid, Stack } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import type { ViewTab } from './types';
import { COLORS } from './lib/constants';
import { Header } from './components/layout/Header';
import { BottomNav } from './components/layout/BottomNav';
import { MonthSelector } from './components/month/MonthSelector';
import { IncomeSection } from './components/month/IncomeSection';
import { ExpenseTable } from './components/month/ExpenseTable';
import { MonthlySummary } from './components/month/MonthlySummary';
import { CategoryPieChart } from './components/charts/CategoryPieChart';
import { SavingsBarChart } from './components/charts/SavingsBarChart';
import { TrendLineChart } from './components/charts/TrendLineChart';
import { AnnualSummary } from './components/annual/AnnualSummary';
import { DailyInsightBubble } from './components/insights/DailyInsightBubble';

export default function App(): JSX.Element {
  // Resolved on first render so the desktop grid never flashes the mobile layout.
  const isDesktop = useMediaQuery('(min-width: 62em)', undefined, {
    getInitialValueInEffect: false,
  });
  const [tab, setTab] = useState<ViewTab>('overview');

  return (
    <Box bg={COLORS.pageBg} mih="100vh">
      <Box style={{ position: 'sticky', top: 0, zIndex: 150 }}>
        <Header />
      </Box>

      <Container size="xl" px={{ base: 'sm', sm: 'lg' }} py="md" pb={isDesktop ? 'xl' : 96}>
        {isDesktop ? (
          <Stack gap="lg">
            <Grid gutter="md" align="stretch">
              <Grid.Col span={5}>
                <Stack gap="md">
                  <MonthSelector />
                  <IncomeSection />
                  <ExpenseTable />
                </Stack>
              </Grid.Col>
              <Grid.Col span={7}>
                <Stack gap="md">
                  <MonthlySummary />
                  <CategoryPieChart />
                  <SavingsBarChart />
                  <TrendLineChart />
                </Stack>
              </Grid.Col>
            </Grid>

            <Divider color={COLORS.border} />
            <AnnualSummary />
          </Stack>
        ) : (
          <Stack gap="md">
            {tab === 'overview' && (
              <>
                <MonthSelector />
                <MonthlySummary />
                <CategoryPieChart />
                <SavingsBarChart />
                <TrendLineChart />
              </>
            )}

            {tab === 'expenses' && (
              <>
                <MonthSelector />
                <IncomeSection />
                <ExpenseTable />
              </>
            )}

            {tab === 'annual' && <AnnualSummary />}
          </Stack>
        )}
      </Container>

      <BottomNav value={tab} onChange={setTab} />
      <DailyInsightBubble />
    </Box>
  );
}
