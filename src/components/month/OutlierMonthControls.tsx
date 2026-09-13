import { Badge, Group, Stack, Switch, Text, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useExpenseStore } from '../../store/useExpenseStore';
import { useMonthData } from '../../hooks/useMonthData';
import { COLORS } from '../../lib/constants';
import { formatMonthYear } from '../../lib/utils';

/** Mark / unmark the selected month as a one-off outlier with an optional note. */
export function OutlierMonthControls(): JSX.Element {
  const { year, month, monthData, stats } = useMonthData();
  const setMonthOutlier = useExpenseStore((state) => state.setMonthOutlier);
  const isOutlier = monthData.isOutlier === true;
  const note = monthData.outlierNote ?? '';

  const handleToggle = (checked: boolean): void => {
    if (!stats.hasData && checked) {
      notifications.show({
        color: 'yellow',
        title: 'אין נתונים',
        message: 'אפשר לסמן כחריג רק חודש שיש בו הכנסות או הוצאות.',
      });
      return;
    }
    setMonthOutlier(year, month, checked, checked ? note : null);
    notifications.show({
      color: checked ? 'orange' : 'gray',
      title: checked ? 'החודש סומן כחריג' : 'סימון החריג בוטל',
      message: checked
        ? `${formatMonthYear(year, month)} יוחרג מממוצעים ומגמות כשמצב «ללא חריגים» פעיל.`
        : `${formatMonthYear(year, month)} ייכלל שוב בכל הסטטיסטיקות.`,
    });
  };

  return (
    <Stack gap="xs">
      <Switch
        checked={isOutlier}
        onChange={(event) => handleToggle(event.currentTarget.checked)}
        disabled={!stats.hasData && !isOutlier}
        label={
          <Group gap={6}>
            <Text fz="sm">חודש חריג (חד־פעמי)</Text>
            {isOutlier && (
              <Badge color="orange" variant="light" size="sm">
                חריג
              </Badge>
            )}
          </Group>
        }
        description="למשל חתונה או אירוע חד־פעמי — לא ייספר בממוצע השנתי כשמחריגים חריגים."
      />
      {isOutlier && (
        <TextInput
          label="תיאור (אופציונלי)"
          placeholder="למשל: חתונה, מעבר דירה…"
          value={note}
          onChange={(event) => {
            setMonthOutlier(year, month, true, event.currentTarget.value);
          }}
          size="xs"
          radius="md"
          styles={{ input: { background: COLORS.pageBg } }}
        />
      )}
    </Stack>
  );
}
