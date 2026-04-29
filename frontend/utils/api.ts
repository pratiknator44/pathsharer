import Constants from 'expo-constants';

/**
 * Returns the backend API base URL.
 *
 * In development (Expo Go / dev build on a physical device), `localhost`
 * won't reach your PC. We derive the correct LAN IP from the Expo dev
 * server's own host URI so the phone can always talk to the backend.
 *
 * In production set EXPO_PUBLIC_API_URL to your real server URL.
 */
function resolveApiUrl(): string {
  // Explicit env var always wins (production builds, CI, etc.)
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl && !envUrl.includes('localhost')) {
    return envUrl;
  }

  // Expo injects the dev-server host as  "192.168.x.x:8081"
  // Strip the Expo port and substitute the backend port.
  const hostUri = Constants.expoConfig?.hostUri ?? Constants.manifest?.debuggerHost;
  if (hostUri) {
    const host = hostUri.split(':')[0]; // e.g. "192.168.1.42"
    return `http://${host}:5000/api/v1`;
  }

  // Last-resort fallback (simulators / web where localhost is fine)
  return envUrl ?? 'http://localhost:5000/api/v1';
}

export const API_URL = resolveApiUrl();
