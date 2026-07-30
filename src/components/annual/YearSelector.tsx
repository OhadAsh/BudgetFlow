import { useEffect } from 'react';
import { Select } from '@mantine/core';
import { IconCalendar } from '@tabler/icons-react';
import { useExpenseStore } from '../../store/useExpenseStore';
import { useMonthData } from '../../hooks/useMonthData';

interface YearSelectorProps {
  size?: 'xs' | 'sm' | 'md';
  width?: number;
}

export function YearSelector({ size = 'sm', width = 120 }: YearSelectorProps): JSX.Element {
  const { availableYears, year } = useMonthData();
  const setSelectedYear = useExpenseStore((state) => state.setSelectedYear);

  useEffect(() => {
    if (availableYears.length > 0 && !availableYears.includes(year)) {
      setSelectedYear(availableYears[0]);
    }
  }, [availableYears, year, setSelectedYear]);

  return (
    <Select
      size={size}
      w={width}
      radius="xl"
      aria-label="בחירת שנה"
      leftSection={<IconCalendar size={16} />}
      data={availableYears.map((value) => ({ value: value.toString(), label: value.toString() }))}
      value={year.toString()}
      allowDeselect={false}
      withCheckIcon={false}
      comboboxProps={{ withinPortal: true }}
      onChange={(value) => {
        if (value !== null) {
          const parsed = Number.parseInt(value, 10);
          if (Number.isFinite(parsed)) {
            setSelectedYear(parsed);
          }
        }
      }}
    />
  );
}
