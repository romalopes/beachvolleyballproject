// API base URL:
//   - In development via Vite proxy:  falls back to "/api/v1"
//   - On Vercel / deployed:           set VITE_API_BASE_URL (e.g. "https://api.example.com/api/v1")
const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "/api/v1";

async function fetchAPI<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) throw new Error(`API Error: ${response.status}`);
  return response.json();
}

export interface Category {
  id: number;
  name: string;
}

export interface Skill {
  id: number;
  title: string;
  description: string | null;
  category_id: number;
  category?: Category;
}

export interface Drill {
  id: number;
  title: string;
  setup_instructions: string;
  player_count: number | null;
  difficulty_level: string | null;
  skills?: Skill[];
  media_assets?: MediaAsset[];
}

export interface MediaAsset {
  id: number;
  drill_id: number;
  skill_id: number | null;
  title: string;
  description: string | null;
  video_url: string;
  asset_type: string;
  thumbnail_url: string | null;
}

export interface TrainingSession {
  id: number;
  drill_id: number;
  scheduled_at: string;
  location: string | null;
  notes: string | null;
  drill?: Drill;
}

export interface User {
  id: number;
  name: string;
  email_address: string;
  roles: string[];
}

export interface AdminUser {
  id: number;
  name: string;
  email_address: string;
  roles: { id: number; name: string }[];
}

export const ROLE_NAMES = ["guest", "player", "coach", "admin"] as const;
export type RoleName = (typeof ROLE_NAMES)[number];


async function postJSON<T>(endpoint: string, body: unknown, method = "POST"): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    if (data?.errors) throw new Error(data.errors.join(". "));
    if (data?.error) throw new Error(data.error);
    throw new Error(`API Error: ${response.status}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

export const api = {
  categories: () => fetchAPI<Category[]>("/categories"),
  skills: () => fetchAPI<Skill[]>("/skills"),
  skill: (id: number) => fetchAPI<Skill>(`/skills/${id}`),
  drills: () => fetchAPI<Drill[]>("/drills"),
  drill: (id: number) => fetchAPI<Drill>(`/drills/${id}`),
  mediaAssets: () => fetchAPI<MediaAsset[]>("/media_assets"),
  trainingSessions: () => fetchAPI<TrainingSession[]>("/training_sessions"),
  trainingSession: (id: number) =>
    fetchAPI<TrainingSession>(`/training_sessions/${id}`),


  // Admin
  adminUsers: () => fetchAPI<AdminUser[]>("/admin/users"),
  adminAddRole: (userId: number, role: string) =>
    postJSON<{ roles: string[] }>(`/admin/users/${userId}/roles`, { role }),
  adminRemoveRole: (userId: number, role: string) =>
    postJSON<{ roles: string[] }>(
      `/admin/users/${userId}/roles/${encodeURIComponent(role)}`,
      {},
      "DELETE"
    ),


  // Auth (cookie-session based; the session cookie flows through the Vite proxy)
  me: () => fetchAPI<User | null>("/me"),
  login: (email_address: string, password: string) =>
    postJSON<User>("/sessions", { email_address, password }),
  logout: () => postJSON<void>("/sessions", {}, "DELETE"),
  register: (name: string, email_address: string, password: string, password_confirmation: string) =>
    postJSON<User>("/registrations", {
      user: { name, email_address, password, password_confirmation },
    }),
  requestPasswordReset: (email_address: string) =>
    postJSON<void>("/passwords", { email_address }),
  resetPassword: (token: string, password: string, password_confirmation: string) =>
    postJSON<void>(`/passwords/${encodeURIComponent(token)}`, {
      password,
      password_confirmation,
    }, "PUT"),
};
