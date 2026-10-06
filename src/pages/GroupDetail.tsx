import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type GroupDetail as Group } from "../api";

export default function GroupDetail() {
  const { id } = useParams<{ id: string }>();
  const [group, setGroup] = useState<Group | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (id) api.group(id).then(({ group: value }) => setGroup(value)).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Failed to load group.")); }, [id]);
  if (error) return <div className="page"><div className="auth-flash auth-flash-error">{error}</div></div>;
  if (!group) return <div className="loading">Loading…</div>;
  return <div className="page"><header className="page-header"><h1>{group.name}</h1><p>{group.description || "Group roster"}</p></header>
    <section className="detail-section"><h2>Details</h2><dl className="identity-context"><dt>Status</dt><dd>{group.status_label}</dd><dt>Visibility</dt><dd>{group.visibility}</dd>{group.organisation && <><dt>Organisation</dt><dd><Link className="identity-link" to={`/organisations/${group.organisation.id}`}>{group.organisation.name}</Link></dd></>}</dl></section>
    <section className="detail-section"><h2>Members</h2>{group.members.length ? <ul className="identity-link-list">{group.members.map((member) => <li key={member.id}>{member.player_profile_id ? <Link className="identity-link" to={`/players/${member.player_profile_id}`}>{member.name || `Player profile #${member.player_profile_id}`}</Link> : member.name || "Member"} · {member.role} · {member.status}</li>)}</ul> : <p>No members.</p>}</section>
  </div>;
}
