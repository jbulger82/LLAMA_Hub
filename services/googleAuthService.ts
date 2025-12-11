
declare const gapi: any;

/* global google, gapi */

declare namespace google {
    namespace accounts {
        namespace oauth2 {
            function initTokenClient(config: any): TokenClient;
            function revoke(token: string, done: () => void): void;
            interface TokenClient {
                requestAccessToken: () => void;
            }
        }
    }
}

const TOKEN_KEY = 'llamahub_google_token';
const TOKEN_EXP_KEY = 'llamahub_google_token_exp';
const USER_KEY = 'llamahub_google_user';
const SCOPES = [
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/gmail.modify', // Read, compose, send, and permanently delete all your email from Gmail.
    'https://www.googleapis.com/auth/calendar.readonly'
].join(' ');


let tokenClient: google.accounts.oauth2.TokenClient | null = null;
let onStateChangeCallback: (state: AuthState) => void = () => {};
let refreshInFlight: Promise<string | null> | null = null;

function setToken(accessToken: string, expiresIn?: number) {
    localStorage.setItem(TOKEN_KEY, accessToken);
    if (expiresIn && Number.isFinite(expiresIn)) {
        const expiresAt = Date.now() + expiresIn * 1000 - 60_000; // 1 minute early
        localStorage.setItem(TOKEN_EXP_KEY, String(expiresAt));
    } else {
        localStorage.removeItem(TOKEN_EXP_KEY);
    }
    gapi.client.setToken({ access_token: accessToken });
}

function isTokenExpired(): boolean {
    const expRaw = localStorage.getItem(TOKEN_EXP_KEY);
    if (!expRaw) return false;
    const exp = Number(expRaw);
    if (!Number.isFinite(exp)) return false;
    return Date.now() > exp;
}

export interface GoogleUserProfile {
    name: string;
    email: string;
    picture?: string;
}

export interface AuthState {
    signedIn: boolean;
    user: GoogleUserProfile | null;
}

interface InitConfig {
    onStateChange: (state: AuthState) => void;
}

function loadGapiClient(developerApiKey: string): Promise<void> {
    return new Promise((resolve) => {
        if (!developerApiKey) {
            console.warn("Google Developer API Key is not configured. Google Workspace features will be unavailable.");
            return resolve();
        }
        gapi.load('client', () => {
            gapi.client.init({
                apiKey: developerApiKey,
                discoveryDocs: [
                    'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',
                    'https://www.googleapis.com/discovery/v1/apis/people/v1/rest',
                    'https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest',
                    'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'
                ],
            }).then(
                () => { // onFulfilled
                    resolve();
                },
                (error: any) => { // onRejected
                    console.error("Failed to initialize gapi client:", error);
                    resolve(); // Resolve even on failure to prevent app crash
                }
            );
        });
    });
}

async function fetchUserProfile(): Promise<GoogleUserProfile | null> {
    try {
        const response = await gapi.client.people.people.get({
            resourceName: 'people/me',
            personFields: 'names,emailAddresses,photos',
        });
        const profile = response.result;
        const primaryName = profile.names?.[0]?.displayName;
        const primaryEmail = profile.emailAddresses?.[0]?.value;
        const primaryPhoto = profile.photos?.[0]?.url;
        
        if (primaryName && primaryEmail) {
            const user: GoogleUserProfile = { name: primaryName, email: primaryEmail, picture: primaryPhoto };
            localStorage.setItem(USER_KEY, JSON.stringify(user));
            return user;
        }
        return null;
    } catch (error) {
        console.error("Error fetching user profile:", error);
        return null;
    }
}

function updateAuthState(signedIn: boolean, user: GoogleUserProfile | null) {
    onStateChangeCallback({ signedIn, user });
}

export function initClient(config: InitConfig, keys: { clientId: string, developerApiKey: string }): void {
    onStateChangeCallback = config.onStateChange;

    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
        gapi.client.setToken({ access_token: token });
        const user = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
        updateAuthState(true, user);
    } else {
        updateAuthState(false, null);
    }
    
    try {
        loadGapiClient(keys.developerApiKey);

        if (keys.clientId) {
            tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: keys.clientId,
                scope: SCOPES,
                callback: async (tokenResponse) => {
                    if (tokenResponse.error) {
                        console.error('OAuth Error:', tokenResponse.error);
                        alert(`Google Sign-In Error: ${tokenResponse.error_description || tokenResponse.error}. Please check your Client ID configuration.`);
                        return;
                    }
                    setToken(tokenResponse.access_token, tokenResponse.expires_in);
                    const user = await fetchUserProfile();
                    updateAuthState(true, user);
                },
            });
        }
    } catch (error) {
        console.error("Error initializing Google Auth Client:", error);
    }
}

export function signIn(): void {
    if (!tokenClient) {
        console.error("Google Auth client is not initialized. Check API credentials in settings.");
        alert("Google Auth client is not initialized. Please configure your Google Client ID in the environment or settings. See README for details.");
        return;
    }
    // Prompt the user to select a Google Account and ask for consent to share their data
    // when establishing a new session.
    tokenClient.requestAccessToken();
}

export function signOut(): void {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
        google.accounts.oauth2.revoke(token, () => {
            console.log('Access token revoked.');
        });
        gapi.client.setToken(null);
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXP_KEY);
    localStorage.removeItem(USER_KEY);
    updateAuthState(false, null);
}

export function isSignedIn(): boolean {
    return !!localStorage.getItem(TOKEN_KEY);
}

export function getAccessToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
}

export function getUserProfile(): GoogleUserProfile | null {
    const userJson = localStorage.getItem(USER_KEY);
    return userJson ? JSON.parse(userJson) : null;
}

export async function ensureFreshAccessToken(): Promise<string | null> {
    if (!tokenClient) {
        console.warn("Google Auth client not initialized.");
        return getAccessToken();
    }
    const token = getAccessToken();
    if (token && !isTokenExpired()) return token;

    if (refreshInFlight) return refreshInFlight;

    refreshInFlight = new Promise<string | null>((resolve) => {
        tokenClient!.callback = (tokenResponse: any) => {
            if (tokenResponse?.access_token) {
                setToken(tokenResponse.access_token, tokenResponse.expires_in);
                resolve(tokenResponse.access_token);
            } else {
                console.error("Failed to refresh Google token:", tokenResponse?.error);
                resolve(null);
            }
            refreshInFlight = null;
        };
        try {
            tokenClient!.requestAccessToken({ prompt: '' });
        } catch (error) {
            console.error("Error requesting Google token:", error);
            refreshInFlight = null;
            resolve(null);
        }
    });

    return refreshInFlight;
}
