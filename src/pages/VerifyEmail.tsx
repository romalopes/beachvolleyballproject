import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';

interface VerifyResult {
  status: string;
  email_address: string;
  name: string;
}

// Verification tokens are single-use, so the endpoint must be called exactly
// once per token. React StrictMode (dev) runs effects twice, which would fire
// two requests — the first consumes the token, the second gets a 422 and the
// page would wrongly show "invalid link". Cache one in-flight result per token.
const verifyResults = new Map<string, Promise<VerifyResult>>();

function verifyOnce(token: string): Promise<VerifyResult> {
  if (!verifyResults.has(token)) {
    verifyResults.set(token, api.verifyEmail(token));
  }
  return verifyResults.get(token)!;
}

/**
 * Public page the verification email links to (`/verify-email?token=...`).
 * Consumes the one-time token via the backend and shows the outcome.
 */
export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [state, setState] = useState<'verifying' | 'success' | 'error'>(
    token ? 'verifying' : 'error',
  );
  const [name, setName] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    verifyOnce(token)
      .then((data) => {
        setName(data.name ?? null);
        setState('success');
      })
      .catch(() => {
        setState('error');
      });
  }, [token]);

  const handleResend = async () => {
    const email = window.prompt(
      'Enter the email address you registered with:',
    );
    if (!email) return;
    setResending(true);
    setResendError(null);
    try {
      await api.resendVerification(email);
      setResent(true);
    } catch (err) {
      setResendError(
        err instanceof Error
          ? err.message
          : 'Could not resend the verification email.',
      );
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="page auth-page">
      <div className="auth-card">
        {state === 'verifying' && (
          <>
            <h2>Verifying your email...</h2>
            <p className="auth-subtitle">Please wait a moment.</p>
          </>
        )}

        {state === 'success' && (
          <>
            <h2>Email verified</h2>
            <p className="auth-subtitle">
              {name ? `Thanks, ${name}! ` : ''}Your email address has been
              verified. You can now sign in to your account.
            </p>
            <div className="auth-links">
              <Link to="/login">Go to sign in</Link>
            </div>
          </>
        )}

        {state === 'error' && (
          <>
            <h2>Invalid verification link</h2>
            <p className="auth-subtitle">
              This verification link is invalid or has expired.
            </p>
            {resent && (
              <div className="auth-flash auth-flash-error" role="alert">
                A new verification email has been sent — please check your
                inbox.
              </div>
            )}
            {resendError && (
              <div className="auth-flash auth-flash-error" role="alert">
                {resendError}
              </div>
            )}
            <div className="auth-links">
              <button
                type="button"
                className="auth-submit"
                onClick={handleResend}
                disabled={resending}
              >
                {resending ? 'Sending...' : 'Resend verification email'}
              </button>
              <Link to="/login">Back to sign in</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
