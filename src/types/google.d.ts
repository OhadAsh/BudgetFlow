/** Google Identity Services (GIS) Token Client typings used by useGoogleDrive. */

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  error?: string;
  error_description?: string;
}

interface GoogleTokenClientConfig {
  client_id: string;
  scope: string;
  callback: (response: GoogleTokenResponse) => void;
  error_callback?: (error: { type?: string; message?: string }) => void;
}

interface GoogleTokenClient {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
}

interface GoogleAccountsOAuth2 {
  initTokenClient: (config: GoogleTokenClientConfig) => GoogleTokenClient;
  revoke: (accessToken: string, done?: () => void) => void;
}

interface GoogleAccounts {
  oauth2: GoogleAccountsOAuth2;
}

interface GoogleGisNamespace {
  accounts: GoogleAccounts;
}

interface Window {
  google?: GoogleGisNamespace;
}
