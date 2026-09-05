import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface SettingsState {
  openRouterApiKey: string | null;
  /** Public Google OAuth Web client ID — user-supplied, stored only in this browser. */
  googleOAuthClientId: string | null;
  setOpenRouterApiKey: (key: string | null) => void;
  setGoogleOAuthClientId: (clientId: string | null) => void;
  clearSettings: () => void;
}

export const SETTINGS_STORAGE_KEY = 'expense-settings-v1';

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      openRouterApiKey: null,
      googleOAuthClientId: null,
      setOpenRouterApiKey: (key) => set({ openRouterApiKey: key }),
      setGoogleOAuthClientId: (clientId) => set({ googleOAuthClientId: clientId }),
      clearSettings: () => set({ openRouterApiKey: null, googleOAuthClientId: null }),
    }),
    {
      name: SETTINGS_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 2,
      migrate: (persisted) => {
        const state = (persisted ?? {}) as Record<string, unknown>;
        return {
          openRouterApiKey:
            typeof state.openRouterApiKey === 'string' ? state.openRouterApiKey : null,
          googleOAuthClientId:
            typeof state.googleOAuthClientId === 'string' ? state.googleOAuthClientId : null,
        };
      },
      partialize: (state) => ({
        openRouterApiKey: state.openRouterApiKey,
        googleOAuthClientId: state.googleOAuthClientId,
      }),
    }
  )
);
