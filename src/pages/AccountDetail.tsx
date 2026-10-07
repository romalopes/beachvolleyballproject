import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type Account } from "../api";
import { useAuth } from "../auth/AuthContext";
import AdminUserRoleControls from "../components/AdminUserRoleControls";
import EmptyState from "../components/EmptyState";
import MembershipSections from "../components/MembershipSections";

const addressLines = (account: Account) =>
  [
    account.address.street_address,
    [account.address.city, account.address.state, account.address.postal_code]
      .filter(Boolean)
      .join(" "),
    account.address.country,
  ].filter(Boolean);

export default function AccountDetail() {
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const accountId = Number(id);
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isInteger(accountId) || accountId < 1) {
      setError("Account not found.");
      return;
    }
    api.accountDetail(accountId).then(setAccount).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : "Failed to load the account.");
    });
  }, [accountId]);

  if (error) return <div className="page"><div className="auth-flash auth-flash-error">{error}</div></div>;
  if (!account) return <div className="loading">Loading…</div>;

  const contactVisible = Boolean(account.email || account.phone || account.date_of_birth || addressLines(account).length);
  return (
    <div className="page">
      <header className="page-header">
        <h1>{account.full_name || `Account #${account.id}`}</h1>
        <p>Account details and linked volleyball profiles.</p>
        {account.can_edit && account.id && (
          <Link className="admin-btn" to={user?.account_id === account.id ? "/account" : `/account?account_id=${account.id}`}>
            Edit account
          </Link>
        )}
      </header>

      {account.user && (
        <section className="detail-section">
          <h2>User roles</h2>
          <AdminUserRoleControls
            adminUser={account.user}
            onUserChange={(updatedUser) => setAccount({ ...account, user: updatedUser })}
            onError={(message) => setError(message || null)}
          />
        </section>
      )}

      <section className="detail-section">
        <h2>Contact information</h2>
        {contactVisible ? (
          <dl className="identity-context">
            {account.email && <><dt>Email</dt><dd>{account.email}</dd></>}
            {account.phone && <><dt>Phone</dt><dd>{account.phone}</dd></>}
            {account.date_of_birth && <><dt>Date of birth</dt><dd>{account.date_of_birth}</dd></>}
            {addressLines(account).length > 0 && <><dt>Address</dt><dd>{addressLines(account).map((line) => <div key={line}>{line}</div>)}</dd></>}
          </dl>
        ) : <p>Contact details are private.</p>}
      </section>

      <section className="detail-section">
        <h2>Player profiles</h2>
        {account.player_profiles?.length ? <ul>{account.player_profiles.map((profile) => <li key={profile.id}><Link to={`/players/${profile.id}`}>{profile.name}</Link></li>)}</ul> : <EmptyState title="No linked player profiles" />}
      </section>
      <section className="detail-section">
        <h2>Coach profiles</h2>
        {account.coach_profiles?.length ? <ul>{account.coach_profiles.map((profile) => <li key={profile.id}><Link to={`/coaches/${profile.id}`}>{profile.name}</Link></li>)}</ul> : <EmptyState title="No linked coach profiles" />}
      </section>

      <MembershipSections
        organisationMemberships={account.organisation_memberships}
        groupMemberships={account.group_memberships}
      />
    </div>
  );
}
