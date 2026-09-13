import { create } from 'zustand';

/**
 * In-memory Google Drive OAuth session — never persisted to localStorage.
 * Survives Settings drawer unmount / navigation; cleared on full page reload or sign-out.
 */
interface GoogleDriveSessionState {
  accessToken: string | null;
  /** Epoch ms when the access token expires. */
  expiresAt: number;
  setSession: (accessToken: string, expiresAt: number) => void;
  clearSession: () => void;
}

export const useGoogleDriveStore = create<GoogleDriveSessionState>()((set) => ({
  accessToken: null,
  expiresAt: 0,
  setSession: (accessToken, expiresAt) => set({ accessToken, expiresAt }),
  clearSession: () => set({ accessToken: null, expiresAt: 0 }),
}));
