import { NumberInput, Radio, Stack, Text } from '@mantine/core';
import {
  COLOR_SCHEME_MODE_OPTIONS,
  type ColorSchemeMode,
} from '../../lib/colorScheme';
import { useSettingsStore } from '../../store/useSettingsStore';

/**
 * Detailed appearance controls for the Settings panel (radio modes + hour window).
 */
export function ThemeModeSettings(): JSX.Element {
  const colorSchemeMode = useSettingsStore((state) => state.colorSchemeMode);
  const hourDarkBefore = useSettingsStore((state) => state.hourDarkBefore);
  const hourDarkFrom = useSettingsStore((state) => state.hourDarkFrom);
  const setColorSchemeMode = useSettingsStore((state) => state.setColorSchemeMode);
  const setHourDarkBefore = useSettingsStore((state) => state.setHourDarkBefore);
  const setHourDarkFrom = useSettingsStore((state) => state.setHourDarkFrom);

  return (
    <Stack gap="sm">
      <Radio.Group
        label="ערכת תצוגה"
        value={colorSchemeMode}
        onChange={(value) => {
          setColorSchemeMode(value as ColorSchemeMode);
        }}
      >
        <Stack gap="xs" mt="xs">
          {COLOR_SCHEME_MODE_OPTIONS.map((option) => (
            <Radio key={option.value} value={option.value} label={option.label} />
          ))}
        </Stack>
      </Radio.Group>

      {colorSchemeMode === 'hour' && (
        <Stack gap="xs">
          <Text fz="sm" c="dimmed">
            מצב כהה לפני שעת הבוקר ומשעת הערב ואילך (שעון מקומי).
          </Text>
          <NumberInput
            label="כהה עד שעה"
            description="לפני השעה הזו בבוקר — מצב כהה"
            value={hourDarkBefore}
            min={0}
            max={23}
            clampBehavior="strict"
            allowDecimal={false}
            radius="xl"
            onChange={(value) => {
              if (typeof value === 'number') {
                setHourDarkBefore(value);
              }
            }}
          />
          <NumberInput
            label="כהה משעה"
            description="מהשעה הזו בערב — מצב כהה"
            value={hourDarkFrom}
            min={0}
            max={23}
            clampBehavior="strict"
            allowDecimal={false}
            radius="xl"
            onChange={(value) => {
              if (typeof value === 'number') {
                setHourDarkFrom(value);
              }
            }}
          />
        </Stack>
      )}

      {colorSchemeMode === 'system' && (
        <Text fz="sm" c="dimmed">
          עוקב אחרי העדפת מערכת ההפעלה (prefers-color-scheme).
        </Text>
      )}
    </Stack>
  );
}
