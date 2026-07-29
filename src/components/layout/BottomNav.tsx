import { Box, Tabs } from '@mantine/core';
import { IconCalendar, IconChartPie, IconList } from '@tabler/icons-react';
import type { ViewTab } from '../../types';
import { COLORS } from '../../lib/constants';

interface BottomNavProps {
  value: ViewTab;
  onChange: (tab: ViewTab) => void;
}

const TABS: Array<{ value: ViewTab; label: string; icon: JSX.Element }> = [
  { value: 'overview', label: 'סקירה', icon: <IconChartPie size={20} /> },
  { value: 'expenses', label: 'הוצאות', icon: <IconList size={20} /> },
  { value: 'annual', label: 'שנתי', icon: <IconCalendar size={20} /> },
];

export function BottomNav({ value, onChange }: BottomNavProps): JSX.Element {
  return (
    <Box
      hiddenFrom="md"
      bg={COLORS.cardBg}
      style={{
        position: 'fixed',
        bottom: 0,
        insetInline: 0,
        borderTop: `1px solid ${COLORS.border}`,
        boxShadow: '0 -2px 12px rgba(15, 23, 42, 0.06)',
        zIndex: 200,
      }}
    >
      <Tabs
        value={value}
        onChange={(next) => {
          if (next !== null) {
            onChange(next as ViewTab);
          }
        }}
        variant="pills"
        color="emerald"
        radius="xl"
        p={6}
      >
        <Tabs.List grow>
          {TABS.map((tab) => (
            <Tabs.Tab
              key={tab.value}
              value={tab.value}
              leftSection={tab.icon}
              aria-label={tab.label}
              style={{ fontSize: 13, fontWeight: 600 }}
            >
              {tab.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>
    </Box>
  );
}
