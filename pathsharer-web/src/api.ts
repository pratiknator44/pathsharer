/**
 * api.ts — thin fetch wrapper for the Pathsharer backend.
 *
 * Usage:
 *   import { api } from './api';
 *   const data = await api.get('/users/me');
 *   const result = await api.post('/journeys', { ... });
 */

const BASE_URL =
  process.env.REACT_APP_API_URL?.trim() || "http://localhost:5000/api/v1";

const TOKEN_KEY = "pathsharer_token";

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------
export const tokenStore = {
  get: (): string | null => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

const USER_KEY = "pathsharer_user";
export const userStore = {
  get: (): GuestUser | null => {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as GuestUser;
    } catch {
      return null;
    }
  },
  set: (user: GuestUser) => localStorage.setItem(USER_KEY, JSON.stringify(user)),
  clear: () => localStorage.removeItem(USER_KEY),
};

// ---------------------------------------------------------------------------
// Core fetch wrapper
// ---------------------------------------------------------------------------
async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const token = tokenStore.get();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    if (res.status === 401) {
      tokenStore.clear();
      userStore.clear();
    }
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error?.error ?? `HTTP ${res.status}`);
  }

  // 204 No Content
  if (res.status === 204) return undefined as unknown as T;

  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};

// ---------------------------------------------------------------------------
// Web-guest auto-login
// ---------------------------------------------------------------------------
export interface GuestUser {
  _id: string;
  name: string;
  phone: string;
  email: string | null;
  gender: string;
}

export interface GuestLoginResponse {
  data: GuestUser;
  token: string;
}

/**
 * Calls POST /auth/web-guest, stores the JWT, and returns the guest user.
 * Safe to call multiple times — if a valid token already exists it skips the
 * network call and returns the cached user instead.
 */
export async function webGuestLogin(): Promise<GuestLoginResponse> {
  const cachedToken = tokenStore.get();
  const cachedUser = userStore.get();
  if (cachedToken && cachedUser) {
    return { data: cachedUser, token: cachedToken };
  }

  const res = await api.post<GuestLoginResponse>("/auth/web-guest");
  tokenStore.set(res.token);
  userStore.set(res.data);
  return res;
}
