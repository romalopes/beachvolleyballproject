import { Link } from "react-router-dom";
import type { OrganisationMembership, UserGroupMembership } from "../api";

interface MembershipSectionsProps {
  organisationMemberships?: OrganisationMembership[];
  groupMemberships?: UserGroupMembership[];
}

export default function MembershipSections({
  organisationMemberships,
  groupMemberships,
}: MembershipSectionsProps) {
  return (
    <>
      <section className="detail-section">
        <h2>Organisation memberships</h2>
        {organisationMemberships?.length ? (
          <ul className="identity-link-list">
            {organisationMemberships.map((membership) => (
              <li key={membership.id}>
                <Link className="identity-link" to={`/organisations/${membership.organisation_id}`}>
                  {membership.organisation?.name || `Organisation #${membership.organisation_id}`}
                </Link>{" "}
                · {membership.role} · {membership.status}
              </li>
            ))}
          </ul>
        ) : (
          <p>No organisation memberships.</p>
        )}
      </section>

      <section className="detail-section">
        <h2>Group memberships</h2>
        {groupMemberships?.length ? (
          <ul className="identity-link-list">
            {groupMemberships.map((membership) => (
              <li key={membership.id}>
                <Link className="identity-link" to={`/groups/${membership.group_id}`}>
                  {membership.group.name}
                </Link>{" "}
                · {membership.role} · {membership.status}
                {membership.group.organisation && (
                  <>
                    {" "}·{" "}
                    <Link className="identity-link" to={`/organisations/${membership.group.organisation.id}`}>
                      {membership.group.organisation.name}
                    </Link>
                  </>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p>No group memberships.</p>
        )}
      </section>
    </>
  );
}