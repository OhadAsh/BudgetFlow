import { Switch, Text, Tooltip } from '@mantine/core';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useMonthData } from '../../hooks/useMonthData';

const NO_OUTLIERS_REASON =
  'אין חודשים חריגים מסומנים בשנה זו — סמן חודש כחריג במסך החודש כדי להשתמש בפילטר הזה';

interface ExcludeOutliersToggleProps {
  /** Compact label for chart headers. */
  compact?: boolean;
  /**
   * When true, the control is fully inert (no outliers to filter).
   * Distinct from checked=false — use this prop so OFF-available vs disabled are not CSS-only.
   */
  disabled?: boolean;
  /** Explains why the toggle is disabled (shown in tooltip). */
  disabledReason?: string;
}

/** Global toggle: include vs exclude outlier months from year-level stats/charts. */
export function ExcludeOutliersToggle({
  compact = false,
  disabled: disabledProp,
  disabledReason: disabledReasonProp,
}: ExcludeOutliersToggleProps): JSX.Element {
  const excludeOutliersFromStats = useSettingsStore((state) => state.excludeOutliersFromStats);
  const setExcludeOutliersFromStats = useSettingsStore(
    (state) => state.setExcludeOutliersFromStats
  );
  const { outlierMonths } = useMonthData();
  const hasOutliers = outlierMonths.length > 0;

  const disabled = disabledProp ?? !hasOutliers;
  const disabledReason = disabledReasonProp ?? NO_OUTLIERS_REASON;
  const isOn = excludeOutliersFromStats;

  const switchControl = (
    <Switch
      size={compact ? 'xs' : 'sm'}
      color="emerald"
      checked={isOn}
      onChange={(event) => {
        if (disabled) return;
        setExcludeOutliersFromStats(event.currentTarget.checked);
      }}
      disabled={disabled}
      label={
        <Text fz={compact ? 'xs' : 'sm'} c={disabled ? 'dimmed' : undefined}>
          {isOn ? 'ללא חריגים' : 'כולל חריגים'}
        </Text>
      }
      description={
        compact
          ? undefined
          : hasOutliers
            ? `${outlierMonths.length} חודשים מסומנים כחריגים בשנה זו`
            : 'אין חודשים חריגים בשנה זו'
      }
      aria-label="החרגת חודשים חריגים מהסטטיסטיקה"
      styles={{
        track: {
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          // State ב: off but clickable — mid gray track (not washed-out disabled gray)
          ...(!disabled && !isOn
            ? {
                backgroundColor: 'var(--mantine-color-gray-4)',
                borderColor: 'var(--mantine-color-gray-4)',
              }
            : {}),
          // State ג: fully disabled — lighter track than the off-available state
          ...(disabled
            ? {
                backgroundColor: 'var(--mantine-color-gray-2)',
                borderColor: 'var(--mantine-color-gray-2)',
              }
            : {}),
        },
        thumb: {
          backgroundColor: '#ffffff',
          borderColor: disabled
            ? 'var(--mantine-color-gray-3)'
            : !isOn
              ? 'var(--mantine-color-gray-3)'
              : undefined,
        },
        input: {
          cursor: disabled ? 'not-allowed' : 'pointer',
        },
        label: {
          cursor: disabled ? 'not-allowed' : 'pointer',
        },
      }}
    />
  );

  if (disabled) {
    return (
      <Tooltip label={disabledReason} withArrow multiline maw={280}>
        <span style={{ display: 'inline-flex', cursor: 'not-allowed' }}>{switchControl}</span>
      </Tooltip>
    );
  }

  return switchControl;
}
