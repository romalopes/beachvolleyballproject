import { createContext, useContext } from 'react';

interface TestAccessContextValue {
  /** Signed token from the API (sessionStorage). */
  token: string | null;
  /** True once the stored token has been verified against the API. */
  authenticated: boolean;
  /** True while the boot-time token verification is in flight. */
  verifying: boolean;
  /** Exchanges the password for a signed token. Throws on invalid password. */
  submit: (password: string) => Promise<void>;
  /** Clears the token and returns the user to the gate. */
  exit: () => void;
}

export const TestAccessContext = createContext<TestAccessContextValue | undefined>(
  undefined,
);

export function useTestAccess(): TestAccessContextValue {
  const ctx = useContext(TestAccessContext);
  if (!ctx) {
    throw new Error('useTestAccess must be used within TestAccessProvider');
  }
  return ctx;
}
