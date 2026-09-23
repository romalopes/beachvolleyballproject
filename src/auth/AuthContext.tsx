import { createContext, useContext } from 'react';
import type { User } from '../api';

export interface ImpersonationState {
  active: boolean;
  realAdmin: { id: number; name: string; email_address: string } | null;
}

export interface AuthContextValue {
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

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
