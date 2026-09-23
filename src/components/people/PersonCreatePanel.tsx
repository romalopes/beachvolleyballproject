import { useEffect, useState } from "react";
import { Search, UserCheck } from "lucide-react";
import {
  api,
  ApiValidationError,
  type PersonIdentity,
} from "../../api";
import { personName } from "../../utils/training";
import PersonIdentityList from "./PersonIdentityList";
import PersonProfileForm, {
  type PersonProfileValues,
  type ProfileKind,
} from "./PersonProfileForm";

interface PersonCreatePanelProps {
  /** Which profile is being recorded — decides the fields and the endpoint. */
  kind: ProfileKind;
  /** Called after a successful create so the page can reload its list. */
  onCreated: (createdName: string) => void;
  onClose: () => void;
}

/**
 * "Record a player/coach" flow.
 *
 * Identity first, profile second — the order matters for the data model:
 *   1. search the people the club already knows (`/api/v1/people`);
 *   2. either pick one of them (the profile is linked to that Person, and no
 *      second identity is created) or record a new person;
 *   3. finally, the API answers with `possible_duplicates`: people who may be
 *      the same human. They are shown, never merged — a person is a judgement
 *      call, not something a name match should decide.
 */
export default function PersonCreatePanel({
  kind,
  onCreated,
  onClose,
}: PersonCreatePanelProps) {
  const [query, setQuery] = useState("");
  // The results are bound to the exact term they were fetched for, so clearing
  // the box hides them without a state write inside the effect (and a stale
  // response can never show results for a different query).
  const [lookup, setLookup] = useState<{
    term: string;
    people: PersonIdentity[];
  }>({ term: "", people: [] });
  const [selectedPerson, setSelectedPerson] = useState<PersonIdentity | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [createdName, setCreatedName] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<PersonIdentity[]>([]);

  // Live lookup, no debounce: the request is bounded (25 rows) and a shorter
  // round trip beats a loading spinner while the coach keeps typing.
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) return;
    let cancelled = false;
    api
      .people({ q: term })
      .then((people) => {
        if (!cancelled) setLookup({ term, people });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error(err);
        setLookup({ term, people: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  const matches =
    lookup.term === query.trim() && query.trim().length >= 2
      ? lookup.people
      : [];

  const handleSubmit = async (values: PersonProfileValues) => {
    setErrors([]);

    const personId = selectedPerson?.id ?? undefined;
    setSubmitting(true);
    try {
      const result =
        kind === "player"
          ? await api.createPlayer({
              person_id: personId,
              person: personId ? undefined : values.person,
              player_profile: values.profile,
            })
          : await api.createCoach({
              person_id: personId,
              person: personId ? undefined : values.person,
              coach_profile: values.profile,
            });

      const name =
        result.full_name?.trim() ||
        personName(result.person, `New ${kind}`);
      setCreatedName(name);
      setDuplicates(result.possible_duplicates ?? []);
      onCreated(name);
    } catch (err: unknown) {
      setErrors(
        err instanceof ApiValidationError
          ? err.errors
          : [err instanceof Error ? err.message : `Failed to save the ${kind}.`],
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (createdName) {
    return (
      <section
        className="admin-form person-create-panel"
        aria-label={`Record a ${kind}`}
      >
        <h3>
          {createdName} is now a {kind}
        </h3>
        {duplicates.length > 0 ? (
          <div className="person-duplicates">
            <h4>Possible duplicates</h4>
            <p className="related-item-meta">
              These people may already describe {createdName}. Nothing was
              merged automatically — check before scheduling them twice.
            </p>
            <PersonIdentityList people={duplicates} profileKind={kind} />
          </div>
        ) : (
          <p className="related-item-meta">
            No other person looks like {createdName}.
          </p>
        )}
        <div className="admin-form-actions">
          <button
            type="button"
            className="admin-btn admin-btn-add"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="person-create-panel">
      <PersonProfileForm
        kind={kind}
        hidePersonFields={Boolean(selectedPerson)}
        personFieldsLegend="New person (no account)"
        submitting={submitting}
        errors={errors}
        submitLabel={`Add ${kind}`}
        onSubmit={handleSubmit}
        onCancel={onClose}
      >
        <h3>Record a {kind}</h3>
        <p className="related-item-meta">
          Search first. If the club already knows this person, link the profile to
          them instead of recording a second identity.
        </p>
  
        <label className="person-search">
          <Search size={14} aria-hidden="true" />
          <input
            type="search"
            value={query}
            placeholder="Search people by name or email"
            aria-label="Search people"
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedPerson(null);
            }}
          />
        </label>
  
        {selectedPerson ? (
          <p className="person-selected">
            <UserCheck size={14} aria-hidden="true" />
            Recording a {kind} profile for <strong>{selectedPerson.full_name}</strong>
            <button
              type="button"
              className="admin-btn"
              onClick={() => setSelectedPerson(null)}
            >
              Choose someone else
            </button>
          </p>
        ) : (
          <>
            {query.trim().length >= 2 && (
              <PersonIdentityList
                people={matches}
                profileKind={kind}
                onSelect={setSelectedPerson}
                emptyLabel={`No person matches “${query.trim()}”. Record them below.`}
              />
            )}
          </>
        )}
      </PersonProfileForm>
    </section>
  );
}
