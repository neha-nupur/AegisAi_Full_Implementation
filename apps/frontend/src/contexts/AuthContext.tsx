/**
 * Auth Context — provides the logged-in principal, login, and logout
 * to the entire application. JWT is stored in localStorage keyed by
 * AEGISAI_TOKEN. Decoded claims are parsed client-side only to drive
 * UI behaviour; real authorisation happens server-side.
 */
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import { api, setToken, clearToken, ApiError } from '../lib/api';

export interface AuthUser {
  userId: string;
  organizationId: string;
  role: string;
  email?: string;
  type: 'user' | 'service_account';
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, role: string) => Promise<string>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function parseJwt(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function claimsToUser(claims: Record<string, unknown>): AuthUser | null {
  if (!claims.sub || !claims.organizationId || !claims.role) return null;
  return {
    userId: claims.sub as string,
    organizationId: claims.organizationId as string,
    role: claims.role as string,
    email: claims.email as string | undefined,
    type: (claims.type as 'user' | 'service_account') ?? 'user',
  };
}

function isTokenExpired(claims: Record<string, unknown>): boolean {
  if (!claims.exp) return false;
  return (claims.exp as number) * 1000 < Date.now();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    loading: true,
  });

  // Hydrate from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('aegisai_token');
    if (stored) {
      const claims = parseJwt(stored);
      if (claims && !isTokenExpired(claims)) {
        const user = claimsToUser(claims);
        if (user) {
          // Optionally fetch email since JWT may not carry it
          setState({ user, token: stored, loading: false });
          // Try to enrich with email from /v1/users/me or similar
          enrichUserEmail(user, stored);
          return;
        }
      }
      // Token expired or invalid
      clearToken();
    }
    setState({ user: null, token: null, loading: false });
  }, []);

  const enrichUserEmail = async (user: AuthUser, _token: string) => {
    try {
      const profile = await api.get<{ email: string; id: string }>(`/users/${user.userId}`);
      setState(prev => prev.user
        ? { ...prev, user: { ...prev.user, email: profile.email } }
        : prev
      );
    } catch {
      // Not critical — continue without email
    }
  };

  const login = useCallback(async (email: string, password: string) => {
    // API returns { token, expiresAt, user } inside the { data } envelope.
    // api.post() unwraps .data, so result is { token, expiresAt, user }.
    const result = await api.post<{ token: string; expiresAt: string; user: unknown }>('/auth/login', {
      email,
      password,
    });

    const { token: accessToken } = result;
    if (!accessToken) throw new ApiError(400, { code: 'INVALID_TOKEN', message: 'No token in login response' });
    setToken(accessToken);

    const claims = parseJwt(accessToken);
    if (!claims) throw new ApiError(400, { code: 'INVALID_TOKEN', message: 'Received invalid token' });

    const user = claimsToUser(claims);
    if (!user) throw new ApiError(400, { code: 'INVALID_TOKEN', message: 'Token missing required claims' });

    setState({ user, token: accessToken, loading: false });

    // Enrich email
    await enrichUserEmail(user, accessToken);
  }, []);

  const signup = useCallback(async (email: string, password: string, role: string): Promise<string> => {
    const result = await api.post<{ message: string; user: unknown }>('/auth/signup', {
      email,
      password,
      role
    });

    return result.message || 'Account created. Please check your email to verify your account.';
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setState({ user: null, token: null, loading: false });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        isAuthenticated: !!state.user && !state.loading,
        login,
        signup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export function useUser(): AuthUser {
  const { user } = useAuth();
  if (!user) throw new Error('useUser called without authenticated user');
  return user;
}
