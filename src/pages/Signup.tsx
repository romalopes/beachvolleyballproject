import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api';
import { clearClaimInvitationPath, rememberClaimInvitationPath, safeInternalReturnPath } from '../auth/invitationReturnPath';

export default function Signup() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = safeInternalReturnPath((location.state as { from?: string } | null)?.from);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setPendingEmail(null);
    setResent(false);
    setSubmitting(true);
    try {
      rememberClaimInvitationPath(from);
      const user = await register(firstName, lastName, email, password, confirmation);
      if (user === null) {
        // Email verification pending — stay here with guidance.
        setPendingEmail(email);
        return;
      }
      clearClaimInvitationPath();
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed.');
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

  if (pendingEmail) {
    return (
      <div className="page auth-page">
        <div className="auth-card">
          <div className="auth-logo">
            <span className="sidebar-logo-icon">
              <img src="/ball.png" width="28" height="28" alt="" />
            </span>
            BVB Project
          </div>
          <h2>One click away</h2>
          <p className="auth-subtitle">We just need to know it&apos;s really you.</p>

          {error && <div className="auth-flash auth-flash-error">{error}</div>}

          <div className="auth-flash auth-flash-notice" role="alert">
            <p style={{ margin: '0 0 8px' }}>
              Account created! We sent a verification link to ({pendingEmail}).
              Please verify your email address before signing in.
            </p>
            {resent && (
              <p style={{ margin: '0 0 8px' }}>
                A new verification email has been sent — please check your inbox.
              </p>
            )}
          </div>

          <ol className="verify-steps">
            <li>Open your inbox</li>
            <li>Locate our verification email</li>
            <li>Click the verification link</li>
          </ol>
          <p className="verify-hint">No email yet? Check your spam folder.</p>

          <button
            type="button"
            className="auth-submit verify-resend"
            onClick={handleResend}
            disabled={submitting}
          >
            {submitting ? 'Sending...' : 'Resend verification email'}
          </button>

          <div className="auth-links">
            <Link to="/login" state={{ from }}>
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <span className="sidebar-logo-icon">
<img src="/ball.png" width="28" height="28" alt="" />
          </span>
          BVB Project
        </div>
        <h2>Create your account</h2>
        <p className="auth-subtitle">Sign up to organise skills, drills and training sessions.</p>

        {error && <div className="auth-flash auth-flash-error">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="signup-first-name">First name</label>
            <input
              id="signup-first-name"
              type="text"
              required
              autoFocus
              autoComplete="given-name"
              placeholder="First name"
              maxLength={50}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
          <div className="auth-field">
            <label htmlFor="signup-last-name">Last name</label>
            <input
              id="signup-last-name"
              type="text"
              required
              autoComplete="family-name"
              placeholder="Last name"
              maxLength={50}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
          <div className="auth-field">
            <label htmlFor="signup-email">Email</label>
            <input
              id="signup-email"
              type="email"
              required
              autoComplete="username"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="auth-field">
            <label htmlFor="signup-password">Password</label>
            <input
              id="signup-password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              maxLength={72}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="auth-field">
            <label htmlFor="signup-confirmation">Confirm password</label>
            <input
              id="signup-confirmation"
              type="password"
              required
              autoComplete="new-password"
              placeholder="Repeat your password"
              maxLength={72}
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          </div>
          <button type="submit" className="auth-submit" disabled={submitting}>
            {submitting ? 'Creating account...' : 'Sign up'}
          </button>
        </form>

        <div className="auth-links">
          <Link to="/login" state={{ from }}>Already have an account? Sign in</Link>
        </div>
      </div>
    </div>
  );
}
