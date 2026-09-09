// API base URL:
//   - In development via Vite proxy:  falls back to "/api/v1"
//   - On Vercel / deployed:           set VITE_API_BASE_URL (e.g. "https://api.example.com/api/v1")
const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "/api/v1";

// ---------- API token (bearer auth for cross-origin SPA) ----------
const TOKEN_KEY = "bvb_api_token";

function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage may be unavailable (private mode). Auth still works for the session.
  }
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getToken();
  const headers: Record<string, string> = { ...extra };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

async function fetchAPI<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: authHeaders({ "Content-Type": "application/json" }),
  });
  if (!response.ok) throw new Error(`API Error: ${response.status}`);
  return response.json();
}

export interface Category {
  id: number;
  name: string;
  slug: string;
}

export interface Skill {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  category_id: number;
  category?: Category;
}

export interface Drill {
  id: number;
  title: string;
  slug: string;
  setup_instructions: string;
  training_stage: 'warmup' | 'beginning' | 'middle' | 'end';
  difficulty_level: 'beginner' | 'intermediate' | 'advanced';
  min_players: number;
  max_players: number;
  ideal_num_players: number;
  skills?: Skill[];
  media_assets?: MediaAsset[];
}

export interface MediaAsset {
  id: number;
  drill_id: number;
  skill_id: number | null;
  title: string;
  slug: string;
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

export interface UserWithToken extends User {
  token?: string;
}

export interface AdminUser {
  id: number;
  name: string;
  email_address: string;
  roles: { id: number; name: string }[];
}

export interface AccountAddress {
  street_address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
}

export interface Account {
  id: number | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  date_of_birth: string | null;
  address: AccountAddress;
}


async function postJSON<T>(endpoint: string, body: unknown, method = "POST"): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers: authHeaders({ "Content-Type": "application/json" }),
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
  skill: (slugOrId: string) => fetchAPI<Skill>(`/skills/${encodeURIComponent(slugOrId)}`),
  drills: () => fetchAPI<Drill[]>("/drills"),
  drill: (slugOrId: string) => fetchAPI<Drill>(`/drills/${encodeURIComponent(slugOrId)}`),
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


  // Auth (bearer-token based for cross-origin; the token is cached in localStorage)
  me: () => fetchAPI<User | null>("/me"),
  login: (email_address: string, password: string) =>
    postJSON<UserWithToken>("/sessions", { email_address, password, api: true })
      .then((data) => {
        if (data.token) setToken(data.token);
        return data;
      }),
  logout: () => {
    const request = postJSON<void>("/sessions", {}, "DELETE");
    setToken(null);
    return request;
  },
  register: (name: string, email_address: string, password: string, password_confirmation: string) =>
    postJSON<UserWithToken>("/registrations", {
      user: { name, email_address, password, password_confirmation },
      api: true,
    }).then((data) => {
      if (data.token) setToken(data.token);
      return data;
    }),
  requestPasswordReset: (email_address: string) =>
    postJSON<void>("/passwords", { email_address }),
  resetPassword: (token: string, password: string, password_confirmation: string) =>
    postJSON<void>(`/passwords/${encodeURIComponent(token)}`, {
      password,
      password_confirmation,
    }, "PUT"),

  // Account
  account: (): Promise<Account> => fetchAPI<Account>("/account"),
  updateAccount: (data: {
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    date_of_birth: string | null;
    address: {
      street_address: string | null;
      city: string | null;
      state: string | null;
      postal_code: string | null;
      country: string | null;
    };
  }): Promise<Account> =>
    postJSON<Account>("/account", data, "PATCH"),
  updatePassword: (data: {
    current_password: string;
    password: string;
    password_confirmation: string;
  }): Promise<{ message: string }> =>
    postJSON<{ message: string }>("/account/password", data, "PATCH"),
};
