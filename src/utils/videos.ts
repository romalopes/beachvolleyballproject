/**
 * Video timestamp + provider helpers.
 *
 * Timestamps are stored as integer seconds in the database (see the backend
 * VideoReference model); the UI accepts and renders the human formats
 * (MM:SS / HH:MM:SS) and converts at the edge.
 */

/**
 * Parses "MM:SS" or "HH:MM:SS" (or bare seconds) into integer seconds.
 * Returns null for anything malformed or negative — callers surface that as a
 * validation error.
 */
export function parseTimestamp(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(":");
  if (parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
  const numbers = parts.map(Number);
  let seconds: number;
  if (numbers.length === 1) seconds = numbers[0];
  else if (numbers.length === 2) seconds = numbers[0] * 60 + numbers[1];
  else seconds = numbers[0] * 3600 + numbers[1] * 60 + numbers[2];
  return seconds >= 0 ? seconds : null;
}

/** Renders integer seconds as "MM:SS" (or "HH:MM:SS" from an hour up). */
export function formatTimestamp(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isInteger(seconds) || seconds < 0) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return hours > 0
    ? `${pad(hours)}:${pad(minutes)}:${pad(secs)}`
    : `${pad(minutes)}:${pad(secs)}`;
}

/** Client-side mirror of the backend provider detection, display-only. */
export interface DetectedVideoProvider {
  provider: string;
  label: string;
  embeddable: boolean;
}

const PROVIDER_HOST_RULES: Array<{
  hosts: string[];
  provider: string;
  label: string;
  embeddable: boolean;
}> = [
  { hosts: ["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"], provider: "youtube", label: "YouTube", embeddable: true },
  { hosts: ["vimeo.com"], provider: "vimeo", label: "Vimeo", embeddable: true },
  { hosts: ["instagram.com", "www.instagram.com"], provider: "instagram", label: "Instagram", embeddable: false },
];

/** Detects the provider for display; the backend stays the source of truth. */
export function detectVideoProvider(url: string): DetectedVideoProvider | null {
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  let host: string;
  try {
    host = new URL(trimmed).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (host.endsWith("tiktok.com")) {
    return { provider: "tiktok", label: "TikTok", embeddable: false };
  }
  const rule = PROVIDER_HOST_RULES.find((rule) => rule.hosts.includes(host));
  if (rule) {
    return { provider: rule.provider, label: rule.label, embeddable: rule.embeddable };
  }
  return { provider: "external", label: "External", embeddable: false };
}

/** Formats the reference window ("04:32 – 06:18") or null when unset. */
export function formatReferenceWindow(
  startSeconds: number | null | undefined,
  endSeconds: number | null | undefined,
): string | null {
  const start = formatTimestamp(startSeconds);
  const end = formatTimestamp(endSeconds);
  if (start && end) return `${start} – ${end}`;
  return start ?? end;
}

/**
 * Tag names are normalized (trimmed + downcased) before they reach the
 * database, so the raw `name` is lower case. Render the title-cased form in
 * the UI while the API keeps owning the canonical value.
 */
export function formatVideoTagName(name: string): string {
  return name.replace(/\b\w/g, (character) => character.toUpperCase());
}
