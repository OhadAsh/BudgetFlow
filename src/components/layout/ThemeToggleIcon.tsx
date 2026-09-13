import { useEffect, useState } from 'react';
import { ActionIcon, Tooltip } from '@mantine/core';
import { IconMoon, IconSun } from '@tabler/icons-react';
import {
  COLOR_SCHEME_MODE_OPTIONS,
  resolveColorScheme,
  type ResolvedColorScheme,
} from '../../lib/colorScheme';
import { useSettingsStore } from '../../store/useSettingsStore';

function modeLabel(mode: string): string {
  return COLOR_SCHEME_MODE_OPTIONS.find((option) => option.value === mode)?.label ?? mode;
}

/**
 * Compact sun/moon toggle beside the app title.
 * Light/dark modes toggle on click; system/hour modes are display-only (change in Settings).
 */
export function ThemeToggleIcon(): JSX.Element {
  const colorSchemeMode = useSettingsStore((state) => state.colorSchemeMode);
  const hourDarkBefore = useSettingsStore((state) => state.hourDarkBefore);
  const hourDarkFrom = useSettingsStore((state) => state.hourDarkFrom);
  const setColorSchemeMode = useSettingsStore((state) => state.setColorSchemeMode);
  const [tick, setTick] = useState<number>(() => Date.now());

  useEffect(() => {
    if (colorSchemeMode !== 'hour' && colorSchemeMode !== 'system') {
      return;
    }
    const timer = window.setInterval(() => {
      setTick(Date.now());
    }, 60_000);

    if (colorSchemeMode === 'system') {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      const onChange = (): void => {
        setTick(Date.now());
      };
      media.addEventListener('change', onChange);
      return () => {
        window.clearInterval(timer);
        media.removeEventListener('change', onChange);
      };
    }

    return () => {
      window.clearInterval(timer);
    };
  }, [colorSchemeMode]);

  void tick;
  const resolved: ResolvedColorScheme = resolveColorScheme(
    colorSchemeMode,
    new Date(tick),
    undefined,
    { darkBefore: hourDarkBefore, darkFrom: hourDarkFrom }
  );
  const isAutoMode = colorSchemeMode === 'system' || colorSchemeMode === 'hour';

  const tooltip = isAutoMode
    ? `מוגדר ${modeLabel(colorSchemeMode)} — שנה בהגדרות`
    : resolved === 'dark'
      ? 'עבור למצב בהיר'
      : 'עבור למצב כהה';

  const handleClick = (): void => {
    if (isAutoMode) {
      return;
    }
    setColorSchemeMode(resolved === 'dark' ? 'light' : 'dark');
  };

  return (
    <Tooltip label={tooltip} withArrow>
      <ActionIcon
        variant="subtle"
        color="gray"
        size="sm"
        radius="xl"
        onClick={handleClick}
        aria-label={tooltip}
        style={isAutoMode ? { cursor: 'default' } : undefined}
      >
        {resolved === 'dark' ? <IconMoon size={16} /> : <IconSun size={16} />}
      </ActionIcon>
    </Tooltip>
  );
}
