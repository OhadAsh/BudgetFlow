import { useCallback, useEffect, useRef, useState } from 'react';
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
  /** Opens the Google consent popup and stores the access token in React state. */
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

/**
 * Manages Google Drive auth via GIS Token Client (public client_id only).
 * Access tokens stay in React state — never localStorage.
 * The OAuth client_id is read from the user settings store (localStorage).
 */
export function useGoogleDrive(): UseGoogleDriveResult {
  const [isReady, setIsReady] = useState<boolean>(false);
  const [isLoadingScript, setIsLoadingScript] = useState<boolean>(true);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isBusy, setIsBusy] = useState<boolean>(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number>(0);

  const tokenClientRef = useRef<GoogleTokenClient | null>(null);
  const lastClientIdRef = useRef<string | null>(null);
  const pendingTokenRef = useRef<{
    resolve: (token: string) => void;
    reject: (error: Error) => void;
  } | null>(null);

  const googleOAuthClientId = useSettingsStore((state) => state.googleOAuthClientId);

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
    if (
      lastClientIdRef.current !== null &&
      lastClientIdRef.current !== googleOAuthClientId
    ) {
      setAccessToken(null);
      setExpiresAt(0);
      tokenClientRef.current = null;
    }
  }, [googleOAuthClientId]);

  const ensureTokenClient = useCallback(
    (clientId: string): GoogleTokenClient => {
      if (
        tokenClientRef.current !== null &&
        lastClientIdRef.current === clientId
      ) {
        return tokenClientRef.current;
      }

      if (!window.google?.accounts?.oauth2) {
        throw new Error('Google Identity Services עדיין לא מוכן.');
      }

      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: GOOGLE_DRIVE_SCOPE,
        callback: (response: GoogleTokenResponse) => {
          const pending = pendingTokenRef.current;
          pendingTokenRef.current = null;

          if (response.error || !response.access_token) {
            const message =
              response.error_description ??
              response.error ??
              'ההתחברות ל-Google בוטלה או נכשלה.';
            pending?.reject(new Error(message));
            setIsConnecting(false);
            return;
          }

          const ttlMs =
            typeof response.expires_in === 'number' && response.expires_in > 0
              ? response.expires_in * 1000
              : 3600 * 1000;

          setAccessToken(response.access_token);
          setExpiresAt(Date.now() + ttlMs);
          setIsConnecting(false);
          pending?.resolve(response.access_token);
        },
        error_callback: (error) => {
          const pending = pendingTokenRef.current;
          pendingTokenRef.current = null;
          setIsConnecting(false);
          pending?.reject(new Error(error.message ?? 'ההתחברות ל-Google נכשלה.'));
        },
      });

      tokenClientRef.current = client;
      lastClientIdRef.current = clientId;
      return client;
    },
    []
  );

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
        return Promise.reject(
          error instanceof Error ? error : new Error('אתחול Google נכשל.')
        );
      }

      return new Promise<string>((resolve, reject) => {
        pendingTokenRef.current = { resolve, reject };
        setIsConnecting(true);
        try {
          // select_account lets the user pick which Google account to use.
          // Empty prompt is for silent re-auth after 401 when a grant already exists.
          client.requestAccessToken({
            prompt: options?.selectAccount ? 'select_account' : '',
          });
        } catch (error) {
          pendingTokenRef.current = null;
          setIsConnecting(false);
          reject(error instanceof Error ? error : new Error('בקשת הרשאה נכשלה.'));
        }
      });
    },
    [ensureTokenClient, isReady]
  );

  const signIn = useCallback(async (): Promise<void> => {
    await requestAccessToken({ selectAccount: true });
  }, [requestAccessToken]);

  const signOut = useCallback(async (): Promise<void> => {
    const token = accessToken;
    setAccessToken(null);
    setExpiresAt(0);

    if (!token || !window.google?.accounts?.oauth2) {
      return;
    }

    await new Promise<void>((resolve) => {
      window.google?.accounts.oauth2.revoke(token, () => resolve());
      window.setTimeout(() => resolve(), 2000);
    });
  }, [accessToken]);

  const withFreshToken = useCallback(
    async <T,>(operation: (token: string) => Promise<T>): Promise<T> => {
      let token = accessToken;
      if (!token || Date.now() >= expiresAt - TOKEN_SKEW_MS) {
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
    [accessToken, expiresAt, requestAccessToken]
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
