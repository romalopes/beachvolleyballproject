import { useEffect, useState } from "react";
import { api, type Account } from "../api";
import { useAuth } from "../auth/AuthContext";

const emptyAccount: Account = {
  id: null, first_name: null, last_name: null, phone: null, date_of_birth: null,
  address: { street_address: null, city: null, state: null, postal_code: null, country: null },
};

export default function AccountPage() {
  const { user } = useAuth();
  const [account, setAccount] = useState<Account>(emptyAccount);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    api.account().then(setAccount).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [user]);

  if (!user) {
    return (
      <div className="page">
        <div className="auth-flash auth-flash-error">Please sign in to view your account.</div>
      </div>
    );
  }
  if (loading) return <div className="loading">Loading…</div>;

  const updateField = <K extends keyof Account>(key: K, value: Account[K]) => {
    setAccount((prev) => ({ ...prev, [key]: value }));
    setError(null);
    setSuccess(null);
  };

  const updateAddress = (key: keyof Account["address"], value: string | null) => {
    setAccount((prev) => ({ ...prev, address: { ...prev.address, [key]: value } }));
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const saved = await api.updateAccount({
        first_name: account.first_name || null,
        last_name: account.last_name || null,
        phone: account.phone || null,
        date_of_birth: account.date_of_birth || null,
        address: {
          street_address: account.address.street_address || null,
          city: account.address.city || null,
          state: account.address.state || null,
          postal_code: account.address.postal_code || null,
          country: account.address.country || null,
        },
      });
      setAccount(saved);
      setSuccess("Account updated successfully.");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSaving(true);
    setPasswordError(null);
    setPasswordSuccess(null);
    try {
      await api.updatePassword({
        current_password: currentPassword,
        password: newPassword,
        password_confirmation: confirmPassword,
      });
      setPasswordSuccess("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e: any) {
      setPasswordError(e.message);
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <h1>Account</h1>
        <p>Manage your personal information and address.</p>
      </header>

      {error && <div className="auth-flash auth-flash-error">{error}</div>}
      {success && <div className="auth-flash auth-flash-notice">{success}</div>}

      <form className="auth-form" onSubmit={handleSubmit}>
        <section className="detail-section">
          <h2>Personal information</h2>
          <div className="auth-field">
            <label htmlFor="first_name">First name</label>
            <input id="first_name" type="text" maxLength={50} value={account.first_name ?? ""} onChange={(e) => updateField("first_name", e.target.value)} />
          </div>
          <div className="auth-field">
            <label htmlFor="last_name">Last name</label>
            <input id="last_name" type="text" maxLength={50} value={account.last_name ?? ""} onChange={(e) => updateField("last_name", e.target.value)} />
          </div>
          <div className="auth-field">
            <label htmlFor="phone">Phone</label>
            <input id="phone" type="tel" maxLength={30} value={account.phone ?? ""} onChange={(e) => updateField("phone", e.target.value)} />
          </div>
          <div className="auth-field">
            <label htmlFor="date_of_birth">Date of birth</label>
            <input id="date_of_birth" type="date" value={account.date_of_birth ?? ""} onChange={(e) => updateField("date_of_birth", e.target.value)} />
          </div>
        </section>

        <section className="detail-section">
          <h2>Address</h2>
          <div className="auth-field">
            <label htmlFor="street_address">Street address</label>
            <input id="street_address" type="text" maxLength={255} value={account.address.street_address ?? ""} onChange={(e) => updateAddress("street_address", e.target.value)} />
          </div>
          <div className="auth-field">
            <label htmlFor="city">City</label>
            <input id="city" type="text" maxLength={100} value={account.address.city ?? ""} onChange={(e) => updateAddress("city", e.target.value)} />
          </div>
          <div className="auth-field">
            <label htmlFor="state">State</label>
            <input id="state" type="text" maxLength={100} value={account.address.state ?? ""} onChange={(e) => updateAddress("state", e.target.value)} />
          </div>
          <div className="auth-field">
            <label htmlFor="postal_code">Postal code</label>
            <input id="postal_code" type="text" maxLength={100} value={account.address.postal_code ?? ""} onChange={(e) => updateAddress("postal_code", e.target.value)} />
          </div>
          <div className="auth-field">
            <label htmlFor="country">Country</label>
            <input id="country" type="text" maxLength={100} value={account.address.country ?? ""} onChange={(e) => updateAddress("country", e.target.value)} />
          </div>
        </section>

        <button type="submit" className="auth-submit" disabled={saving}>
          {saving ? "Saving..." : "Save changes"}
        </button>
      </form>

      <section className="detail-section">
        <h2>Security</h2>
          <p style={{ marginBottom: "1rem", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
            Choose a strong password you don't use anywhere else.
          </p>
          {passwordError && <div className="auth-flash auth-flash-error">{passwordError}</div>}
          {passwordSuccess && <div className="auth-flash auth-flash-notice">{passwordSuccess}</div>}
          <form className="auth-form" onSubmit={handlePasswordSubmit}>
            <div className="auth-field">
              <label htmlFor="current_password">Current password</label>
              <input id="current_password" type="password" required minLength={1} maxLength={72} autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </div>
            <div className="auth-field">
              <label htmlFor="new_password">New password</label>
              <input id="new_password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div className="auth-field">
              <label htmlFor="confirm_password">Confirm new password</label>
              <input id="confirm_password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
            <button type="submit" className="auth-submit" disabled={passwordSaving}>
              {passwordSaving ? "Changing..." : "Change password"}
            </button>
          </form>
      </section>
    </div>
  );
}

