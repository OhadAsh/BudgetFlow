import { useEffect, useState } from 'react';
import { useMantineColorScheme } from '@mantine/core';
import { resolveColorScheme } from '../../lib/colorScheme';
import { useSettingsStore } from '../../store/useSettingsStore';

const HOUR_POLL_MS = 60_000;

/**
 * Keeps Mantine's color scheme in sync with expense-settings-v1.
 * Handles light / dark / system / hour (re-checked every minute).
 */
export function ColorSchemeSync(): null {
  const mode = useSettingsStore((state) => state.colorSchemeMode);
  const hourDarkBefore = useSettingsStore((state) => state.hourDarkBefore);
  const hourDarkFrom = useSettingsStore((state) => state.hourDarkFrom);
  const { setColorScheme } = useMantineColorScheme();
  const [nowTick, setNowTick] = useState<number>(() => Date.now());

  useEffect(() => {
    if (mode !== 'hour') {
      return;
    }
    const timer = window.setInterval(() => {
      setNowTick(Date.now());
    }, HOUR_POLL_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, [mode]);

  useEffect(() => {
    if (mode === 'system') {
      setColorScheme('auto');
      return;
    }

    const resolved = resolveColorScheme(mode, new Date(nowTick), undefined, {
      darkBefore: hourDarkBefore,
      darkFrom: hourDarkFrom,
    });
    setColorScheme(resolved);
  }, [mode, hourDarkBefore, hourDarkFrom, nowTick, setColorScheme]);

  useEffect(() => {
    if (mode !== 'system') {
      return;
    }
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (): void => {
      setColorScheme('auto');
    };
    media.addEventListener('change', onChange);
    return () => {
      media.removeEventListener('change', onChange);
    };
  }, [mode, setColorScheme]);

  return null;
}
