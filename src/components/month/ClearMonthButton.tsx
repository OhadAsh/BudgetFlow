import { useEffect, useState } from 'react';
import { ActionIcon, Button, Group, Modal, Stack, Text, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconTrash } from '@tabler/icons-react';
import { useExpenseStore } from '../../store/useExpenseStore';
import { useMonthData } from '../../hooks/useMonthData';
import { formatCurrency, formatMonthYear, getMonthName } from '../../lib/utils';
import {
  MONTH_CLEAR_UNDO_MS,
  MONTH_CLEAR_UNDO_NOTIFICATION_ID,
  consumeMonthClearUndo,
  discardMonthClearUndo,
  peekMonthClearUndo,
  stashMonthClearUndo,
} from '../../lib/monthClearUndo';

const NO_DATA_REASON = 'אין הכנסות או הוצאות למחיקה בחודש זה';

/** Contextual clear for the currently selected month — muted trash, confirm + undo. */
export function ClearMonthButton(): JSX.Element {
  const { year, month, monthData, stats } = useMonthData();
  const clearMonth = useExpenseStore((state) => state.clearMonth);
  const restoreMonth = useExpenseStore((state) => state.restoreMonth);
  const [confirmOpen, setConfirmOpen] = useState<boolean>(false);

  const hasData = stats.hasData;
  const incomeCount = monthData.income.length;
  const expenseCount = monthData.expenses.length;

  // Leaving the cleared month commits the clear (drops undo). Tab remounts on the
  // same period keep the buffer alive.
  useEffect(() => {
    const pending = peekMonthClearUndo();
    if (pending !== null && (pending.year !== year || pending.month !== month)) {
      discardMonthClearUndo();
      notifications.hide(MONTH_CLEAR_UNDO_NOTIFICATION_ID);
    }
  }, [year, month]);

  const closeConfirm = (): void => {
    setConfirmOpen(false);
  };

  const handleUndo = (): void => {
    const snapshot = consumeMonthClearUndo();
    notifications.hide(MONTH_CLEAR_UNDO_NOTIFICATION_ID);
    if (snapshot === null) return;
    restoreMonth(snapshot);
    notifications.show({
      color: 'emerald',
      title: 'בוטל',
      message: `נתוני ${formatMonthYear(snapshot.year, snapshot.month)} שוחזרו.`,
      autoClose: 3000,
    });
  };

  const handleConfirmClear = (): void => {
    discardMonthClearUndo();
    notifications.hide(MONTH_CLEAR_UNDO_NOTIFICATION_ID);

    const snapshot = clearMonth(year, month);
    closeConfirm();
    if (snapshot === null) return;

    stashMonthClearUndo(snapshot);

    notifications.show({
      id: MONTH_CLEAR_UNDO_NOTIFICATION_ID,
      color: 'gray',
      title: 'החודש נוקה',
      autoClose: MONTH_CLEAR_UNDO_MS,
      withCloseButton: true,
      onClose: () => {
        discardMonthClearUndo();
      },
      message: (
        <Group gap="sm" justify="space-between" wrap="nowrap" mt={4}>
          <Text fz="sm" c="dimmed">
            ניתן לשחזר לזמן קצר
          </Text>
          <Button
            size="compact-sm"
            variant="light"
            color="gray"
            radius="xl"
            onClick={handleUndo}
            aria-label="בטל מחיקת חודש"
          >
            בטל
          </Button>
        </Group>
      ),
    });
  };

  const trashButton = (
    <ActionIcon
      variant="subtle"
      color="gray"
      size="md"
      radius="xl"
      disabled={!hasData}
      aria-label="מחק נתוני חודש זה"
      onClick={() => {
        if (!hasData) return;
        setConfirmOpen(true);
      }}
      styles={{
        root: {
          opacity: hasData ? 1 : 0.45,
          cursor: hasData ? 'pointer' : 'not-allowed',
        },
      }}
    >
      <IconTrash size={18} />
    </ActionIcon>
  );

  return (
    <>
      {hasData ? (
        trashButton
      ) : (
        <Tooltip label={NO_DATA_REASON} withArrow multiline maw={260}>
          <span style={{ display: 'inline-flex', cursor: 'not-allowed' }}>{trashButton}</span>
        </Tooltip>
      )}

      <Modal
        opened={confirmOpen}
        onClose={closeConfirm}
        title={`מחיקת נתוני ${formatMonthYear(year, month)}`}
        centered
        size="sm"
      >
        <Stack gap="md">
          <Text fz="sm">
            {`פעולה זו תמחק ${incomeCount} רשומות הכנסה ו-${expenseCount} רשומות הוצאה עבור ${getMonthName(month)} ${year}, בסך ${formatCurrency(stats.totalIncome)} הכנסות ו-${formatCurrency(stats.totalExpenses)} הוצאות.`}
          </Text>
          <Text fz="xs" c="dimmed">
            קטגוריות מותאמות, יעדי תקציב וזיכרון עסקים לא ייפגעו. נתוני חודשים אחרים יישמרו.
          </Text>
          <Group grow>
            <Button variant="default" radius="xl" onClick={closeConfirm} autoFocus>
              ביטול
            </Button>
            <Button color="red" radius="xl" onClick={handleConfirmClear}>
              מחק נתוני חודש
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
