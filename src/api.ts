// API base URL:
//   - In development via Vite proxy:  falls back to "/api/v1"
//   - On Vercel / deployed:           set VITE_API_BASE_URL (e.g. "https://api.example.com/api/v1")
const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api/v1";

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
};
