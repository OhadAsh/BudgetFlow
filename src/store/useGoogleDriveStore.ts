import { create } from 'zustand';

/**
 * In-memory Google Drive OAuth session — never persisted to localStorage.
 * Survives Settings drawer unmount / navigation; cleared on full page reload or sign-out.
 */
interface GoogleDriveSessionState {
  accessToken: string | null;
  /** Epoch ms when the access token expires. */
  expiresAt: number;
  /**
   * True while the "remote is newer" modal is open. Every automatic backup
   * is suspended meanwhile so nothing can overwrite Drive behind the dialog.
   */
  conflictOpen: boolean;
  setSession: (accessToken: string, expiresAt: number) => void;
  setConflictOpen: (open: boolean) => void;
  clearSession: () => void;
}

export const useGoogleDriveStore = create<GoogleDriveSessionState>()((set) => ({
  accessToken: null,
  expiresAt: 0,
  conflictOpen: false,
  setSession: (accessToken, expiresAt) => set({ accessToken, expiresAt }),
  setConflictOpen: (open) => set({ conflictOpen: open }),
  clearSession: () => set({ accessToken: null, expiresAt: 0 }),
}));
