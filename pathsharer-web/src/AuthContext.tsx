/**
 * AuthContext.tsx
 *
 * Provides the current web-guest user and auth state to the whole app.
 * On first mount it calls POST /auth/web-guest, stores the JWT and exposes
 * the guest user via context.
 */

import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { GuestUser, tokenStore, userStore, webGuestLogin } from "./api";

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------
interface AuthState {
  /** null while loading, GuestUser once resolved */
  user: GuestUser | null;
  loading: boolean;
  error: string | null;
  /** Force a new guest session (clears token + re-calls the endpoint) */
  refresh: () => void;
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  error: null,
  refresh: () => {},
});

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<GuestUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0); // increment to trigger re-login

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setLoading(true);
      setError(null);
      try {
        const res = await webGuestLogin();
        if (!cancelled) {
          setUser(res.data);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const msg =
            err instanceof Error ? err.message : "Failed to connect to server";
          setError(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [tick]);

  function refresh() {
    tokenStore.clear();
    userStore.clear();
    setUser(null);
    setTick((t) => t + 1);
  }

  return (
    <AuthContext.Provider value={{ user, loading, error, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useAuth(): AuthState {
  return useContext(AuthContext);
}
