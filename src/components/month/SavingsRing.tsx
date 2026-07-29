import { Box, Text, useMantineTheme } from '@mantine/core';
import { COLORS } from '../../lib/constants';
import { formatPercent } from '../../lib/utils';

interface SavingsRingProps {
  value: number;
  color: 'emerald' | 'yellow' | 'red';
  labelColor: string;
  size?: number;
  thickness?: number;
}

/**
 * Custom savings-rate ring. Uses CSS grid stacking so the % label is always
 * centered — avoids Mantine RingProgress RTL clipping/offset bugs.
 */
export function SavingsRing({
  value,
  color,
  labelColor,
  size = 64,
  thickness = 7,
}: SavingsRingProps): JSX.Element {
  const theme = useMantineTheme();
  const clamped = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - clamped / 100);
  const stroke = theme.colors[color]?.[6] ?? COLORS.primary;
  const track = theme.colors.gray[2];
  const center = size / 2;

  return (
    <Box
      w={size}
      h={size}
      style={{
        flexShrink: 0,
        display: 'grid',
        placeItems: 'center',
      }}
      aria-label="טבעת שיעור חיסכון"
      role="img"
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden
        style={{ gridArea: '1 / 1', display: 'block' }}
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={track}
          strokeWidth={thickness}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${center} ${center})`}
          style={{ transition: 'stroke-dashoffset 600ms ease' }}
        />
      </svg>
      <Text
        component="span"
        fw={700}
        fz={11}
        c={labelColor}
        style={{
          gridArea: '1 / 1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          direction: 'ltr',
          unicodeBidi: 'isolate',
          lineHeight: 1,
          margin: 0,
          padding: 0,
          zIndex: 1,
        }}
      >
        {formatPercent(value)}
      </Text>
    </Box>
  );
}
