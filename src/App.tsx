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

      <Container
        size="xl"
        px={{ base: 'sm', sm: 'lg' }}
        py="md"
        pb={isDesktop ? 'xl' : 96}
        style={{ overflowX: 'clip', maxWidth: '100%' }}
      >
        {isDesktop ? (
          <Stack gap="lg">
            <MonthlySummary />

            <Grid gutter="md" align="stretch" styles={{ inner: { width: '100%' } }}>
              <Grid.Col span={5} style={{ minWidth: 0, maxWidth: '100%' }}>
                <Stack gap="md" style={{ minWidth: 0 }}>
                  <MonthSelector />
                  <IncomeSection />
                  <ExpenseTable />
                </Stack>
              </Grid.Col>
              <Grid.Col span={7} style={{ minWidth: 0, maxWidth: '100%' }}>
                <Stack gap="md" style={{ minWidth: 0 }}>
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
