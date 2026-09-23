import {
  useCallback,
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
import { TestAccessContext } from './TestAccessContext';

/**
 * Owns the test-access gate state.
 *
 * It lives in its own module because a file that exports a component *and* a
 * hook cannot be fast-refreshed (see `eslint-plugin-react-refresh`): the
 * context + `useTestAccess` stay in `TestAccessContext.tsx`.
 */
export function TestAccessProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    getTestAccessToken(),
  );
  const [authenticated, setAuthenticated] = useState<boolean>(() =>
    Boolean(getTestAccessToken()),
  );
  // The boot-time probe below always runs, so verification starts in flight —
  // initialising it here (rather than in the effect) keeps the gate page from
  // flashing before the probe answers.
  const [verifying, setVerifying] = useState<boolean>(true);

  // Boot-time access check:
  //   - with a stored token: verify it (expired/invalidated -> back to gate);
  //   - with no token: probe the API — while the server-side gate is disabled
  //     (no TEST_ACCESS_PASSWORD configured) the app is open, so auto-unlock
  //     instead of showing a meaningless password form. Setting the env var
  //     on the server makes this same probe return 401 -> the form appears,
  //     with no frontend redeploy needed.
  useEffect(() => {
    let cancelled = false;
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
          // Token expired/invalidated, or the gate is enabled and no valid
          // token is stored — the password is required.
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
    if (result.authenticated && (result.token || result.disabled)) {
      // A real signed token — or, while the server-side gate is disabled
      // (no TEST_ACCESS_PASSWORD configured), a session sentinel so the
      // boot-time verification keeps the app unlocked.
      const stored = result.token || 'gate-disabled';
      setTestAccessToken(stored);
      setToken(stored);
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
