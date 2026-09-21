import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  const from = (location.state as { from?: string } | null)?.from || '/';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setResent(false);
    setSubmitting(true);
    try {
      const user = await login(email, password);
      if (user === null) {
        // Email verification pending — stay on the login page with guidance.
        setPendingEmail(email);
        return;
      }
      setPendingEmail(null);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!pendingEmail) return;
    setError(null);
    setSubmitting(true);
    try {
      await api.resendVerification(pendingEmail);
      setResent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend the verification email.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <span className="sidebar-logo-icon">
<img src="/ball.png" width="28" height="28" alt="" />
          </span>
          BVB Project
        </div>
        <h2>Sign in</h2>
        <p className="auth-subtitle">Welcome back. Sign in to access your training database.</p>

        {error && <div className="auth-flash auth-flash-error">{error}</div>}

        {pendingEmail && (
          <div className="auth-flash auth-flash-error" role="alert">
            <p style={{ margin: '0 0 8px' }}>
              Please verify your email address ({pendingEmail}) before signing
              in. We sent you a verification link.
            </p>
            {resent && (
              <p style={{ margin: '0 0 8px' }}>
                A new verification email has been sent — please check your inbox.
              </p>
            )}
            <button
              type="button"
              className="auth-submit"
              onClick={handleResend}
              disabled={submitting}
            >
              {submitting ? 'Sending...' : 'Resend verification email'}
            </button>
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              required
              autoFocus
              autoComplete="username"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="auth-field">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="Your password"
              maxLength={72}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="auth-submit" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="auth-links">
          <Link to="/forgot-password">Forgot your password?</Link>
          <Link to="/signup">Create an account</Link>
        </div>
      </div>
    </div>
  );
}
