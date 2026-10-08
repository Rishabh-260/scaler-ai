export const API = "/api";

export type MeetingCard = {
  id: string;
  title: string;
  meeting_date: string;
  duration_seconds: number;
  participants: string[];
  preview: string;
};

export type TranscriptSegment = {
  id: number;
  sequence: number;
  timestamp_seconds: number;
  speaker: string;
  text: string;
};

export type ActionItem = {
  id: number;
  description: string;
  owner: string | null;
  due_date: string | null;
  is_complete: number;
  source: string;
};

export type Meeting = MeetingCard & {
  transcript: TranscriptSegment[];
  summary: { overview: string; generated_at: string } | null;
  topics: { id: number; title: string; timestamp_seconds: number; sequence: number }[];
  action_items: ActionItem[];
};

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new Error("Can't reach the API. Make sure the backend is running on port 8000.");
  }
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      message = body.detail || message;
    } catch { /* response did not contain JSON */ }
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const formatDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  return `${minutes} min`;
};

export const formatTime = (seconds: number) => {
  const value = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
};

export const formatDate = (value: string) => new Intl.DateTimeFormat("en", {
  month: "short", day: "numeric", year: "numeric",
}).format(new Date(value));

