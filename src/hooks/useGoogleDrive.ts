import { useCallback, useEffect, useState } from 'react';
import { GOOGLE_DRIVE_SCOPE } from '../lib/constants';
import {
  DriveAuthError,
  buildDriveBackupPayload,
  downloadBackupFromDrive,
  isValidGoogleOAuthClientId,
  uploadBackupToDrive,
} from '../lib/googleDrive';
import type { DriveBackupPayload } from '../types';
import { useExpenseStore } from '../store/useExpenseStore';
import { useGoogleDriveStore } from '../store/useGoogleDriveStore';
import { useSettingsStore } from '../store/useSettingsStore';

const GIS_WAIT_MS = 15_000;
const TOKEN_SKEW_MS = 60_000;

export interface UseGoogleDriveResult {
  /** GIS script finished loading. */
  isReady: boolean;
  /** True while waiting for the GIS script. */
  isLoadingScript: boolean;
  /** True while the OAuth popup / token request is in flight. */
  isConnecting: boolean;
  /** True when a non-expired access token is held in memory. */
  isConnected: boolean;
  /** True when the user has saved a valid Client ID locally. */
  hasClientId: boolean;
  /** Opens the Google consent popup and stores the access token in session store. */
  signIn: () => Promise<void>;
  /** Revokes the access token and clears in-memory auth state. */
  signOut: () => Promise<void>;
  /** Re-requests an access token (used after 401). Pass selectAccount to show the account picker. */
  requestAccessToken: (options?: { selectAccount?: boolean }) => Promise<string>;

  /** Builds a snapshot from the store and uploads/updates it on Drive. */
  backupNow: () => Promise<void>;
  /** Downloads the Drive backup JSON (does not write to the store). */
  fetchBackup: () => Promise<DriveBackupPayload>;
  /** Uploads/downloads busy flag for UI spinners. */
  isBusy: boolean;
}

/** Module-level GIS client — shared across remounts of Settings / GoogleDriveBackup. */
let tokenClient: GoogleTokenClient | null = null;
let lastClientId: string | null = null;
let pendingToken: {
  resolve: (token: string) => void;
  reject: (error: Error) => void;
} | null = null;

function waitForGis(): Promise<GoogleGisNamespace> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve(window.google);
      return;
    }

    const started = Date.now();
    const timer = window.setInterval(() => {
      if (window.google?.accounts?.oauth2) {
        window.clearInterval(timer);
        resolve(window.google);
        return;
      }
      if (Date.now() - started >= GIS_WAIT_MS) {
        window.clearInterval(timer);
        reject(new Error('טעינת Google Identity Services נכשלה. רענן את הדף ונסה שוב.'));
      }
    }, 50);
  });
}

function ensureTokenClient(clientId: string): GoogleTokenClient {
  if (tokenClient !== null && lastClientId === clientId) {
    return tokenClient;
  }

  if (!window.google?.accounts?.oauth2) {
    throw new Error('Google Identity Services עדיין לא מוכן.');
  }

  const client = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: GOOGLE_DRIVE_SCOPE,
    callback: (response: GoogleTokenResponse) => {
      const pending = pendingToken;
      pendingToken = null;

      if (response.error || !response.access_token) {
        const message =
          response.error_description ?? response.error ?? 'ההתחברות ל-Google בוטלה או נכשלה.';
        pending?.reject(new Error(message));
        return;
      }

      const ttlMs =
        typeof response.expires_in === 'number' && response.expires_in > 0
          ? response.expires_in * 1000
          : 3600 * 1000;

      useGoogleDriveStore.getState().setSession(response.access_token, Date.now() + ttlMs);
      pending?.resolve(response.access_token);
    },
    error_callback: (error) => {
      const pending = pendingToken;
      pendingToken = null;
      pending?.reject(new Error(error.message ?? 'ההתחברות ל-Google נכשלה.'));
    },
  });

  tokenClient = client;
  lastClientId = clientId;
  return client;
}

/**
 * Manages Google Drive auth via GIS Token Client (public client_id only).
 * Access tokens live in useGoogleDriveStore (memory only — never localStorage).
 * The OAuth client_id is read from the user settings store (localStorage).
 */
export function useGoogleDrive(): UseGoogleDriveResult {
  const [isReady, setIsReady] = useState<boolean>(false);
  const [isLoadingScript, setIsLoadingScript] = useState<boolean>(true);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isBusy, setIsBusy] = useState<boolean>(false);

  const accessToken = useGoogleDriveStore((state) => state.accessToken);
  const expiresAt = useGoogleDriveStore((state) => state.expiresAt);
  const clearSession = useGoogleDriveStore((state) => state.clearSession);

  const googleOAuthClientId = useSettingsStore((state) => state.googleOAuthClientId);
  const openRouterApiKey = useSettingsStore((state) => state.openRouterApiKey);

  const months = useExpenseStore((state) => state.months);
  const selectedYear = useExpenseStore((state) => state.selectedYear);
  const selectedMonth = useExpenseStore((state) => state.selectedMonth);
  const customCategories = useExpenseStore((state) => state.customCategories);
  const merchantMemory = useExpenseStore((state) => state.merchantMemory);
  const categoryTargets = useExpenseStore((state) => state.categoryTargets);

  const hasClientId =
    googleOAuthClientId !== null && isValidGoogleOAuthClientId(googleOAuthClientId);

  const isConnected =
    accessToken !== null && accessToken.length > 0 && Date.now() < expiresAt - TOKEN_SKEW_MS;

  useEffect(() => {
    let cancelled = false;

    const init = async (): Promise<void> => {
      try {
        await waitForGis();
        if (!cancelled) {
          setIsReady(true);
        }
      } catch (error) {
        if (!cancelled) {
          setIsReady(false);
          console.error(error);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingScript(false);
        }
      }
    };

    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  // Drop in-memory Drive session if the user clears/changes the Client ID.
  useEffect(() => {
    if (lastClientId !== null && lastClientId !== googleOAuthClientId) {
      clearSession();
      tokenClient = null;
      lastClientId = null;
    }
  }, [googleOAuthClientId, clearSession]);

  const requestAccessToken = useCallback(
    (options?: { selectAccount?: boolean }): Promise<string> => {
      const clientId = useSettingsStore.getState().googleOAuthClientId;
      if (clientId === null || !isValidGoogleOAuthClientId(clientId)) {
        return Promise.reject(new Error('MISSING_CLIENT_ID'));
      }

      if (!isReady) {
        return Promise.reject(new Error('Google Identity Services עדיין לא מוכן.'));
      }

      let client: GoogleTokenClient;
      try {
        client = ensureTokenClient(clientId.trim());
      } catch (error) {
        return Promise.reject(error instanceof Error ? error : new Error('אתחול Google נכשל.'));
      }

      return new Promise<string>((resolve, reject) => {
        pendingToken = {
          resolve: (token) => {
            setIsConnecting(false);
            resolve(token);
          },
          reject: (error) => {
            setIsConnecting(false);
            reject(error);
          },
        };
        setIsConnecting(true);
        try {
          // select_account lets the user pick which Google account to use.
          // Empty prompt is for silent re-auth after 401 when a grant already exists.
          client.requestAccessToken({
            prompt: options?.selectAccount ? 'select_account' : '',
          });
        } catch (error) {
          pendingToken = null;
          setIsConnecting(false);
          reject(error instanceof Error ? error : new Error('בקשת הרשאה נכשלה.'));
        }
      });
    },
    [isReady]
  );

  const signIn = useCallback(async (): Promise<void> => {
    await requestAccessToken({ selectAccount: true });
  }, [requestAccessToken]);

  const signOut = useCallback(async (): Promise<void> => {
    const token = useGoogleDriveStore.getState().accessToken;
    clearSession();

    if (!token || !window.google?.accounts?.oauth2) {
      return;
    }

    await new Promise<void>((resolve) => {
      window.google?.accounts.oauth2.revoke(token, () => resolve());
      window.setTimeout(() => resolve(), 2000);
    });
  }, [clearSession]);

  const withFreshToken = useCallback(
    async <T,>(operation: (token: string) => Promise<T>): Promise<T> => {
      const session = useGoogleDriveStore.getState();
      let token = session.accessToken;
      if (!token || Date.now() >= session.expiresAt - TOKEN_SKEW_MS) {
        token = await requestAccessToken();
      }

      try {
        return await operation(token);
      } catch (error) {
        if (error instanceof DriveAuthError) {
          const refreshed = await requestAccessToken();
          return operation(refreshed);
        }
        throw error;
      }
    },
    [requestAccessToken]
  );

  const backupNow = useCallback(async (): Promise<void> => {
    setIsBusy(true);
    try {
      const payload = buildDriveBackupPayload({
        months,
        selectedYear,
        selectedMonth,
        customCategories,
        merchantMemory,
        categoryTargets,
        openRouterApiKey,
      });
      await withFreshToken((token) => uploadBackupToDrive(token, payload));
    } finally {
      setIsBusy(false);
    }
  }, [
    months,
    selectedYear,
    selectedMonth,
    customCategories,
    merchantMemory,
    categoryTargets,
    openRouterApiKey,
    withFreshToken,
  ]);

  const fetchBackup = useCallback(async (): Promise<DriveBackupPayload> => {
    setIsBusy(true);
    try {
      return await withFreshToken((token) => downloadBackupFromDrive(token));
    } finally {
      setIsBusy(false);
    }
  }, [withFreshToken]);

  return {
    isReady,
    isLoadingScript,
    isConnecting,
    isConnected,
    hasClientId,
    signIn,
    signOut,
    requestAccessToken,
    backupNow,
    fetchBackup,
    isBusy,
  };
}
