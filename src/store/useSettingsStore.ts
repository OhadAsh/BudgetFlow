import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface SettingsState {
  openRouterApiKey: string | null;
  setOpenRouterApiKey: (key: string | null) => void;
  clearSettings: () => void;
}

export const SETTINGS_STORAGE_KEY = 'expense-settings-v1';

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      openRouterApiKey: null,
      setOpenRouterApiKey: (key) => set({ openRouterApiKey: key }),
      clearSettings: () => set({ openRouterApiKey: null }),
    }),
    {
      name: SETTINGS_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (state) => ({
        openRouterApiKey: state.openRouterApiKey,
      }),
    }
  )
);
