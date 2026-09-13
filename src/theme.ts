import { createTheme, type MantineColorsTuple } from '@mantine/core';

const emerald: MantineColorsTuple = [
  '#ecfdf5',
  '#d1fae5',
  '#a7f3d0',
  '#6ee7b7',
  '#34d399',
  '#10b981',
  '#059669',
  '#047857',
  '#065f46',
  '#064e3b',
];

export const theme = createTheme({
  primaryColor: 'emerald',
  colors: { emerald },
  defaultRadius: 'lg',
  fontFamily: 'Heebo, Inter, sans-serif',
  headings: { fontFamily: 'Heebo, Inter, sans-serif', fontWeight: '700' },
  fontSizes: { sm: '0.875rem', md: '0.9375rem' },
  black: '#1E293B',
  white: '#ffffff',
  components: {
    Card: {
      defaultProps: {
        shadow: 'sm',
        radius: 'lg',
        withBorder: false,
        padding: 'lg',
        bg: 'var(--bf-card-bg)',
      },
    },
    Button: { defaultProps: { radius: 'xl' } },
    Paper: { defaultProps: { radius: 'lg', bg: 'var(--bf-card-bg)' } },
    Badge: { defaultProps: { radius: 'sm' } },
    Modal: { defaultProps: { radius: 'lg', centered: true } },
    Tooltip: { defaultProps: { radius: 'md' } },
  },
});
