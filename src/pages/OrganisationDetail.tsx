import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type Organisation } from "../api";

export default function OrganisationDetail() {
  const { id } = useParams<{ id: string }>();
  const [organisation, setOrganisation] = useState<Organisation | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (id) api.organisation(Number(id)).then(setOrganisation).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Failed to load organisation.")); }, [id]);
  if (error) return <div className="page"><div className="auth-flash auth-flash-error">{error}</div></div>;
  if (!organisation) return <div className="loading">Loading…</div>;
  return <div className="page"><header className="page-header"><h1>{organisation.name}</h1><p>{organisation.description || organisation.organisation_type.replaceAll("_", " ")}</p></header>
    <section className="detail-section"><h2>Details</h2><dl className="identity-context"><dt>Type</dt><dd>{organisation.organisation_type.replaceAll("_", " ")}</dd><dt>Status</dt><dd>{organisation.status_label}</dd>{organisation.acronym && <><dt>Acronym</dt><dd>{organisation.acronym}</dd></>}{organisation.parent_organisation && <><dt>Parent organisation</dt><dd><Link className="identity-link" to={`/organisations/${organisation.parent_organisation.id}`}>{organisation.parent_organisation.name}</Link></dd></>}</dl></section>
  </div>;
}
