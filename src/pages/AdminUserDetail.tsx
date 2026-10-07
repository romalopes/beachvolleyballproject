import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type Account, type AdminUser } from "../api";
import AdminUserRoleControls, { adminUserDisplayName } from "../components/AdminUserRoleControls";
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

export default function AdminUserDetail() {
  const { id } = useParams<{ id: string }>();
  const userId = Number(id);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isInteger(userId) || userId < 1) {
      setError("User not found.");
      return;
    }

    let cancelled = false;
    api
      .adminUser(userId)
      .then((user) => {
        if (!cancelled) setAdminUser(user);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(
            reason instanceof Error ? reason.message : "Failed to load the user.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (error) {
    return (
      <div className="page">
        <div className="auth-flash auth-flash-error">{error}</div>
      </div>
    );
  }

  if (!adminUser) return <div className="loading">Loading…</div>;

  const account = adminUser.account;
  const contactVisible = Boolean(
    account &&
      (account.email ||
        account.phone ||
        account.date_of_birth ||
        addressLines(account).length),
  );

  return (
    <div className="page">
      <header className="page-header">
        <h1>{adminUserDisplayName(adminUser)}</h1>
        <p>User, role, account and linked volleyball profile details.</p>
        <Link className="admin-btn" to="/admin/users">
          Back to users
        </Link>
      </header>

      <section className="detail-section">
        <h2>User</h2>
        <AdminUserRoleControls
          adminUser={adminUser}
          linkName={false}
          onUserChange={setAdminUser}
          onError={(message) => setError(message || null)}
        />
        <dl className="identity-context">
          <dt>User ID</dt>
          <dd>{adminUser.id}</dd>
          <dt>Email address</dt>
          <dd>{adminUser.email_address}</dd>
        </dl>
      </section>

      {account ? (
        <>
          <section className="detail-section">
            <h2>Account</h2>
            <dl className="identity-context">
              <dt>Account ID</dt>
              <dd>{account.id}</dd>
              <dt>Name</dt>
              <dd>{account.full_name || `Account #${account.id}`}</dd>
            </dl>
          </section>

          <section className="detail-section">
            <h2>Contact information</h2>
            {contactVisible ? (
              <dl className="identity-context">
                {account.email && (
                  <>
                    <dt>Email</dt>
                    <dd>{account.email}</dd>
                  </>
                )}
                {account.phone && (
                  <>
                    <dt>Phone</dt>
                    <dd>{account.phone}</dd>
                  </>
                )}
                {account.date_of_birth && (
                  <>
                    <dt>Date of birth</dt>
                    <dd>{account.date_of_birth}</dd>
                  </>
                )}
                {addressLines(account).length > 0 && (
                  <>
                    <dt>Address</dt>
                    <dd>
                      {addressLines(account).map((line) => (
                        <div key={line}>{line}</div>
                      ))}
                    </dd>
                  </>
                )}
              </dl>
            ) : (
              <p>No contact details recorded.</p>
            )}
          </section>

          <section className="detail-section">
            <h2>Player profiles</h2>
            {account.player_profiles?.length ? (
              <ul>
                {account.player_profiles.map((profile) => (
                  <li key={profile.id}>
                    <Link to={`/players/${profile.id}`}>{profile.name}</Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No linked player profiles" />
            )}
          </section>

          <section className="detail-section">
            <h2>Coach profiles</h2>
            {account.coach_profiles?.length ? (
              <ul>
                {account.coach_profiles.map((profile) => (
                  <li key={profile.id}>
                    <Link to={`/coaches/${profile.id}`}>{profile.name}</Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No linked coach profiles" />
            )}
          </section>

          <MembershipSections
            organisationMemberships={account.organisation_memberships}
            groupMemberships={account.group_memberships}
          />
        </>
      ) : (
        <section className="detail-section">
          <EmptyState title="This user does not have an account yet." />
        </section>
      )}
    </div>
  );
}