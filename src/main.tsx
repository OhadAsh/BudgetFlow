import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DirectionProvider, MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import './index.css';
import App from './App';
import { theme } from './theme';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element #root was not found in index.html');
}

// Registered relative to the document so it also works from a GitHub Pages sub-path.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  });
}

createRoot(container).render(
  <StrictMode>
    <DirectionProvider initialDirection="rtl" detectDirection={false}>
      <MantineProvider theme={theme} defaultColorScheme="light" forceColorScheme="light">
        <Notifications position="top-center" limit={3} />
        <App />
      </MantineProvider>
    </DirectionProvider>
  </StrictMode>
);
