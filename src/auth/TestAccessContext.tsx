import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  testAccessApi,
  getTestAccessToken,
  setTestAccessToken,
  clearTestAccessToken,
} from '../api';

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

const TestAccessContext = createContext<TestAccessContextValue | undefined>(
  undefined,
);

export function TestAccessProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    getTestAccessToken(),
  );
  const [authenticated, setAuthenticated] = useState<boolean>(() =>
    Boolean(getTestAccessToken()),
  );
  const [verifying, setVerifying] = useState<boolean>(() =>
    Boolean(getTestAccessToken()),
  );

  // Boot-time verification: if the stored token has expired (or the gate was
  // turned off server-side with a new password), force re-authentication.
  useEffect(() => {
    let cancelled = false;
    const stored = getTestAccessToken();
    if (!stored) return;

    setVerifying(true);
    testAccessApi
      .verify()
      .then((result) => {
        if (cancelled) return;
        if (result.authenticated) {
          setAuthenticated(true);
        } else {
          setTestAccessToken(null);
          setToken(null);
          setAuthenticated(false);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const gateRejection =
          (err as { code?: string })?.code === "test_access_required" ||
          (err as { status?: number })?.status === 401;
        if (gateRejection) {
          // Token expired or was invalidated — clear it and fall back to the
          // gate (the password is required again).
          setTestAccessToken(null);
          setToken(null);
          setAuthenticated(false);
        } else {
          // Network/API errors must not lock a valid user out of the app; the
          // next real API call will re-check via the 401 handler.
          setAuthenticated(true);
        }
      })
      .finally(() => {
        if (!cancelled) setVerifying(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = useCallback(async (password: string) => {
    const result = await testAccessApi.submit(password);
    if (result.authenticated && result.token) {
      setTestAccessToken(result.token);
      setToken(result.token);
      setAuthenticated(true);
    } else if (!result.authenticated) {
      throw new Error(result.error || 'Invalid password');
    }
  }, []);

  const exit = useCallback(() => {
    clearTestAccessToken();
    setToken(null);
    setAuthenticated(false);
  }, []);

  const value = useMemo(
    () => ({ token, authenticated, verifying, submit, exit }),
    [token, authenticated, verifying, submit, exit],
  );

  return (
    <TestAccessContext.Provider value={value}>
      {children}
    </TestAccessContext.Provider>
  );
}

export function useTestAccess(): TestAccessContextValue {
  const ctx = useContext(TestAccessContext);
  if (!ctx) {
    throw new Error('useTestAccess must be used within TestAccessProvider');
  }
  return ctx;
}
