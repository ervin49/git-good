// Client for the NOD backend. Calls go to same-origin /api/*, which next.config.ts
// proxies to the backend server (BACKEND_URL, default http://localhost:3001).

export type ClaimStatus = "Observat" | "Deducție AI" | "Confirmat" | "Neconfirmat";

export type DraftClaim = { text: string; status: ClaimStatus; evidence_seq: number[]; reason: string };
export type DraftStep = { order: number; instruction: string; status: ClaimStatus; evidence_seq: number[]; reason: string };
export type DraftUncertainty = { question: string; reason: string; evidence_seq: number[] };

export type ProcedureDraft = {
  session_summary: string;
  ticket_link: { ticket_id: string | null; match_status: "matched" | "candidate" | "unmatched"; basis: string };
  title: string;
  applicability: DraftClaim[];
  prerequisites: DraftClaim[];
  steps: DraftStep[];
  conditions: DraftClaim[];
  exceptions: DraftClaim[];
  uncertainties: DraftUncertainty[];
  outcome: DraftClaim | null;
  sufficient_evidence: boolean;
  missing_information: string[];
};

export type DraftQuality = {
  grounding_score: number | null;
  checks: Record<string, boolean>;
};

export type DraftResponse = { draft: ProcedureDraft; quality: DraftQuality; truncated: boolean };

export type SearchCandidate = {
  procedure_id: string;
  title: string;
  summary: string;
  applicability: string;
  application: string;
  published: boolean;
  allowed: boolean;
};

export type SearchMatch = { procedure_id: string; relevance: "high" | "medium" | "low"; reason: string };
export type SearchResponse = { matches: SearchMatch[]; needs_clarification: boolean; clarification_question: string | null };

export type StoredEvent = { receivedAt: string; sessionId: string; origin?: string; event: unknown };

export type SessionSummary = { sessionId: string; eventCount: number; firstAt: string; lastAt: string; origin?: string };

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...init?.headers }, cache: "no-store" });
  } catch {
    throw new ApiError("Backend-ul nu răspunde. Pornește serverul din folderul backend.", 0);
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const serverMessage = body && typeof body.error === "string" ? body.error : null;
    const message = response.status === 503 && (path.startsWith("/api/ai/") || path.endsWith("/draft"))
      ? "AI-ul nu este configurat pe server (lipsește GEMINI_API_KEY sau OPENAI_API_KEY)."
      : response.status >= 500 && !serverMessage
        ? "Backend-ul nu răspunde. Pornește serverul din folderul backend."
        : serverMessage ?? `Cererea a eșuat (${response.status}).`;
    throw new ApiError(message, response.status);
  }
  if (body === null) throw new ApiError("Răspuns invalid de la backend.", response.status);
  return body as T;
}

export async function listSessions(): Promise<SessionSummary[]> {
  const { events } = await request<{ events: StoredEvent[] }>("/api/events");
  const sessions = new Map<string, SessionSummary>();
  for (const entry of events) {
    const current = sessions.get(entry.sessionId);
    if (!current) {
      sessions.set(entry.sessionId, { sessionId: entry.sessionId, eventCount: 1, firstAt: entry.receivedAt, lastAt: entry.receivedAt, origin: entry.origin });
      continue;
    }
    current.eventCount += 1;
    if (entry.receivedAt < current.firstAt) current.firstAt = entry.receivedAt;
    if (entry.receivedAt > current.lastAt) current.lastAt = entry.receivedAt;
  }
  return [...sessions.values()].sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

export function generateDraft(sessionId: string): Promise<DraftResponse> {
  return request<DraftResponse>("/api/ai/draft", { method: "POST", body: JSON.stringify({ sessionId }) });
}

export function searchProcedures(query: string, procedures: SearchCandidate[]): Promise<SearchResponse> {
  return request<SearchResponse>("/api/ai/search", { method: "POST", body: JSON.stringify({ query, procedures }) });
}

export type AllowedDomain = { domain: string; created_at: string };

export async function listDomains(): Promise<AllowedDomain[]> {
  return (await request<{ domains: AllowedDomain[] }>("/api/settings/domains")).domains;
}

export async function addDomain(domain: string): Promise<AllowedDomain[]> {
  return (await request<{ domains: AllowedDomain[] }>("/api/settings/domains", { method: "POST", body: JSON.stringify({ domain }) })).domains;
}

export async function removeDomain(domain: string): Promise<AllowedDomain[]> {
  return (await request<{ domains: AllowedDomain[] }>(`/api/settings/domains?domain=${encodeURIComponent(domain)}`, { method: "DELETE" })).domains;
}

export type Meeting = {
  id: string;
  title: string;
  date: string;
  duration_min: number;
  transcript_url: string | null;
  participant_count: number;
  ticket_ids: string[];
  overview: string;
  action_items: string[];
  keywords: string[];
  sentence_count: number;
  synced_at: string;
};

export type MeetingSentence = { idx: number; speaker: string; text: string; start_s: number | null; end_s: number | null };

export type FirefliesStatus = { configured: boolean; last_sync: string | null; last_error: string | null; meetings: Meeting[] };

export type FirefliesSyncResult = { fetched: number; stored: number; skippedNoTicket: number; meetings: Meeting[] };

export function getFirefliesStatus(ticket?: string): Promise<FirefliesStatus> {
  return request<FirefliesStatus>(`/api/integrations/fireflies${ticket ? `?ticket=${encodeURIComponent(ticket)}` : ""}`);
}

export function syncFireflies(options: { days: number; keyword?: string; onlyWithTicket: boolean }): Promise<FirefliesSyncResult> {
  return request<FirefliesSyncResult>("/api/integrations/fireflies", { method: "POST", body: JSON.stringify(options) });
}

export async function getMeeting(id: string): Promise<Meeting & { sentences: MeetingSentence[] }> {
  return (await request<{ meeting: Meeting & { sentences: MeetingSentence[] } }>(`/api/meetings/${encodeURIComponent(id)}`)).meeting;
}

export async function deleteMeeting(id: string): Promise<void> {
  await request<{ ok: boolean }>(`/api/meetings/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export type MeetingDraft = { ticket_id: string; draft: ProcedureDraft; quality: DraftQuality; created_at: string };

export async function listMeetingDrafts(id: string): Promise<MeetingDraft[]> {
  return (await request<{ drafts: MeetingDraft[] }>(`/api/meetings/${encodeURIComponent(id)}/draft`)).drafts;
}

export function generateMeetingDraft(id: string, ticketId?: string): Promise<MeetingDraft> {
  return request<MeetingDraft>(`/api/meetings/${encodeURIComponent(id)}/draft`, { method: "POST", body: JSON.stringify({ ticketId }) });
}

export type NotificationKind = "capture" | "capture_done" | "meeting" | "draft" | "error";

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  href: string | null;
  created_at: string;
  read_at: string | null;
};

export type NotificationList = { notifications: AppNotification[]; unread: number };

export function listNotifications(): Promise<NotificationList> {
  return request<NotificationList>("/api/notifications");
}

export function markNotificationsRead(id?: string): Promise<NotificationList> {
  return request<NotificationList>("/api/notifications", { method: "POST", body: JSON.stringify({ id }) });
}

export type TeamsAnalysis = MeetingDraft & {
  conversation_id: string;
  ticket_id: string | null;
  messages: { author: string; time: string | null; text: string }[];
};

// Sends a pasted Teams conversation to the backend, which redacts it and has the AI write the procedure.
export function analyzeTeamsConversation(text: string, ticketId?: string): Promise<TeamsAnalysis> {
  return request<TeamsAnalysis>("/api/teams/analyze", { method: "POST", body: JSON.stringify({ text, ticketId }) });
}
