import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, type User } from '../api';

interface ImpersonationState {
  active: boolean;
  realAdmin: { id: number; name: string; email_address: string } | null;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  /** Resolves to the signed-in user, or null when verification is pending. */
  login: (email: string, password: string) => Promise<User | null>;
  /** Resolves to the created user, or null when verification is pending. */
  register: (name: string, email: string, password: string, confirmation: string) => Promise<User | null>;
  resetPassword: (token: string, password: string, confirmation: string) => Promise<void>;
  logout: () => Promise<void>;
  impersonation: ImpersonationState;
  startImpersonating: (userId: number) => Promise<void>;
  stopImpersonating: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [impersonation, setImpersonation] = useState<ImpersonationState>({ active: false, realAdmin: null });

  useEffect(() => {
    api.me()
      .then((u) => {
        setUser(u);
        setImpersonation({
          active: Boolean((u as User & { impersonating?: boolean })?.impersonating),
          realAdmin: (u as User & { real_admin?: { id: number; name: string; email_address: string } })?.real_admin ?? null,
        });
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const result = await api.login(email, password);
    // Unverified accounts get HTTP 202 "pending_verification" — no session was
    // created, so the user must NOT enter the app until the email is verified.
    if (result.status === "pending_verification") {
      setUser(null);
      return null;
    }
    setUser(result);
    return result;
  };

  const register = async (name: string, email: string, password: string, confirmation: string) => {
    const result = await api.register(name, email, password, confirmation);
    // Unverified signups get HTTP 202 "pending_verification" — no session was
    // created, so the user must verify their email before entering the app.
    if (result.status === "pending_verification") {
      setUser(null);
      return null;
    }
    setUser(result);
    return result;
  };

  const resetPassword = async (token: string, password: string, confirmation: string) => {
    setUser(await api.resetPassword(token, password, confirmation));
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
    setImpersonation({ active: false, realAdmin: null });
  };

  const startImpersonating = async (userId: number) => {
    const result = await api.startImpersonation(userId);
    setImpersonation({ active: true, realAdmin: result.real_admin });
    setUser(result.effective_user);
  };

  const stopImpersonating = async () => {
    const result = await api.stopImpersonation();
    setImpersonation({ active: false, realAdmin: null });
    setUser({ ...result.real_admin, roles: ["admin"] });
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, resetPassword, logout, impersonation, startImpersonating, stopImpersonating }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
