import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks(id: string): string | undefined {
          const path = id.replace(/\\/g, '/');
          if (!path.includes('/node_modules/')) {
            return undefined;
          }
          if (
            /\/node_modules\/(react|react-dom|react-is|scheduler|use-sync-external-store)\//.test(
              path
            )
          ) {
            return 'vendor-react';
          }
          if (path.includes('/node_modules/@mantine/')) {
            return 'vendor-mantine';
          }
          if (
            path.includes('/node_modules/recharts') ||
            path.includes('/node_modules/victory-vendor/') ||
            /\/node_modules\/d3-[\w-]+\//.test(path)
          ) {
            return 'vendor-charts';
          }
          if (path.includes('/node_modules/xlsx/')) {
            return 'vendor-excel';
          }
          if (path.includes('/node_modules/@tabler/icons-react/')) {
            return 'vendor-icons';
          }
          return undefined;
        },
      },
    },
  },
});
