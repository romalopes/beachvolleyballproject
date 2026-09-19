// Pure payload-verification helpers used by the API health checks.
// Kept dependency-free so they can be unit-tested.
//
// Each validator is defensive: the health page hits the live API, so a
// validator must return false (not throw) on unexpected shapes.

type RecordLike = Record<string, unknown>;

const isRecord = (data: unknown): data is RecordLike =>
  typeof data === "object" && data !== null;

export const isValidArray = (data: unknown): data is unknown[] =>
  Array.isArray(data);

export const hasStatusOk = (data: unknown): boolean =>
  isRecord(data) && data.status === "ok";

export const isHealthyDetailedPayload = (data: unknown): boolean =>
  isRecord(data) && data.status === "ok" && data.database === "ok";

// GET /me returns { id, name, email_address, roles } for the BVB API.
export const isAuthMePayload = (data: unknown): boolean =>
  isRecord(data) &&
  typeof data.id === "number" &&
  typeof data.email_address === "string" &&
  Array.isArray(data.roles);

export const isCategoryPayload = (data: unknown): boolean =>
  isRecord(data) &&
  typeof data.id === "number" &&
  typeof data.name === "string" &&
  typeof data.slug === "string";

export const isSkillPayload = (data: unknown): boolean =>
  isRecord(data) &&
  typeof data.id === "number" &&
  typeof data.title === "string" &&
  typeof data.slug === "string" &&
  typeof data.category_id === "number";

export const isSkillListPayload = (data: unknown): boolean =>
  isValidArray(data) && data.every(isSkillPayload);

// The drills index excludes the raw JSONB `definition` column and embeds
// skills — both are part of the React↔Rails contract worth verifying.
export const isDrillPayload = (data: unknown): boolean => {
  if (
    !isRecord(data) ||
    typeof data.id !== "number" ||
    typeof data.title !== "string" ||
    typeof data.slug !== "string"
  ) {
    return false;
  }
  if ("definition" in data) return false;
  if (data.skills !== undefined && !isValidArray(data.skills)) return false;
  return true;
};

export const isDrillListPayload = (data: unknown): boolean =>
  isValidArray(data) && data.every(isDrillPayload);

export const isTrainingSessionPayload = (data: unknown): boolean =>
  isRecord(data) &&
  typeof data.id === "number" &&
  typeof data.title === "string" &&
  typeof data.starts_at === "string" &&
  typeof data.ends_at === "string" &&
  typeof data.status === "string";

export const isTrainingSessionListPayload = (data: unknown): boolean =>
  isValidArray(data) && data.every(isTrainingSessionPayload);

export const isVideoPayload = (data: unknown): boolean =>
  isRecord(data) &&
  typeof data.id === "number" &&
  typeof data.title === "string" &&
  typeof data.provider === "string" &&
  typeof data.source_url === "string" &&
  typeof data.external_url === "string" &&
  typeof data.reference_count === "number";

export const isVideoListPayload = (data: unknown): boolean =>
  isValidArray(data) && data.every(isVideoPayload);

// GET /account returns { id, first_name, ..., address: { ... } }.
export const isAccountPayload = (data: unknown): boolean => {
  if (!isRecord(data)) return false;
  if (!("address" in data)) return false;
  const address = data.address;
  if (address !== null && !isRecord(address)) return false;
  return true;
};
