import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.resetPassword(token, password, confirmation);
      navigate('/login', { state: { from: '/' } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password reset failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="page auth-page">
        <div className="auth-card">
          <h2>Invalid reset link</h2>
          <p className="auth-subtitle">This password reset link is invalid or has expired.</p>
          <div className="auth-links">
            <Link to="/forgot-password">Request a new reset email</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page auth-page">
      <div className="auth-card">
        <h2>Choose a new password</h2>
        <p className="auth-subtitle">Enter a new password for your account.</p>

        {error && <div className="auth-flash auth-flash-error">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="reset-password">New password</label>
            <input
              id="reset-password"
              type="password"
              required
              minLength={8}
              autoFocus
              autoComplete="new-password"
              placeholder="At least 8 characters"
              maxLength={72}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="auth-field">
            <label htmlFor="reset-confirmation">Confirm new password</label>
            <input
              id="reset-confirmation"
              type="password"
              required
              autoComplete="new-password"
              placeholder="Repeat new password"
              maxLength={72}
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          </div>
          <button type="submit" className="auth-submit" disabled={submitting}>
            {submitting ? 'Saving...' : 'Save new password'}
          </button>
        </form>
      </div>
    </div>
  );
}
