// Fireflies.ai import: pulls meeting transcripts through the GraphQL API, redacts them and keeps only
// meetings tied to a ticket (unless told otherwise). The API key stays server-side (FIREFLIES_API_KEY).
// Docs: https://docs.fireflies.ai/graphql-api/query/transcripts
import { db } from "@/app/lib/db";
import { redactDeep } from "@/app/lib/redact";

const API_URL = process.env.FIREFLIES_API_URL ?? "https://api.fireflies.ai/graphql";
const PAGE_SIZE = 50; // API maximum per query
const MAX_PAGES = 10;

// Same shape as the capture extension's ticket guess (e.g. SUP-142, FAC-1042).
const TICKET_RE = /\b[A-Z][A-Z0-9]{1,9}-\d{1,7}\b/g;

const TRANSCRIPTS_QUERY = `
  query Transcripts($fromDate: DateTime, $toDate: DateTime, $keyword: String, $limit: Int, $skip: Int) {
    transcripts(fromDate: $fromDate, toDate: $toDate, keyword: $keyword, limit: $limit, skip: $skip) {
      id
      title
      dateString
      date
      duration
      transcript_url
      participants
      sentences { index speaker_name text start_time end_time }
      summary { overview action_items keywords shorthand_bullet }
    }
  }
`;

interface FirefliesSentence {
  index?: number | null;
  speaker_name?: string | null;
  text?: string | null;
  start_time?: string | number | null;
  end_time?: string | number | null;
}

interface FirefliesTranscript {
  id: string;
  title?: string | null;
  dateString?: string | null;
  date?: number | null;
  duration?: number | null;
  transcript_url?: string | null;
  participants?: string[] | null;
  sentences?: FirefliesSentence[] | null;
  summary?: {
    overview?: string | null;
    action_items?: string | null;
    keywords?: string | string[] | null;
    shorthand_bullet?: string | null;
  } | null;
}

export interface MeetingSummary {
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
}

export interface MeetingSentence {
  idx: number;
  speaker: string;
  text: string;
  start_s: number | null;
  end_s: number | null;
}

export interface SyncOptions {
  fromDate?: string;
  toDate?: string;
  keyword?: string;
  onlyWithTicket?: boolean;
}

export interface SyncResult {
  fetched: number;
  stored: number;
  skippedNoTicket: number;
  meetings: MeetingSummary[];
}

export class FirefliesError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

db.exec(`
  CREATE TABLE IF NOT EXISTS meetings (
    id                TEXT PRIMARY KEY,
    source            TEXT NOT NULL DEFAULT 'fireflies',
    title             TEXT NOT NULL,
    date              TEXT NOT NULL,
    duration_min      REAL NOT NULL DEFAULT 0,
    transcript_url    TEXT,
    participant_count INTEGER NOT NULL DEFAULT 0,
    ticket_ids        TEXT NOT NULL DEFAULT '[]',
    overview          TEXT NOT NULL DEFAULT '',
    action_items      TEXT NOT NULL DEFAULT '[]',
    keywords          TEXT NOT NULL DEFAULT '[]',
    synced_at         TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS meeting_sentences (
    meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    idx        INTEGER NOT NULL,
    speaker    TEXT NOT NULL,
    text       TEXT NOT NULL,
    start_s    REAL,
    end_s      REAL,
    PRIMARY KEY (meeting_id, idx)
  );
  CREATE TABLE IF NOT EXISTS integration_state (
    name       TEXT PRIMARY KEY,
    last_sync  TEXT,
    last_error TEXT
  );
`);

export function isConfigured(): boolean {
  return !!process.env.FIREFLIES_API_KEY;
}

function clean(text: unknown, max = 4000): string {
  return (redactDeep(String(text ?? "").slice(0, max)) as string).replace(/\s+/g, " ").trim();
}

function toSeconds(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(n) ? n : null;
}

function splitList(value: unknown): string[] {
  const raw = Array.isArray(value) ? value.map(String) : String(value ?? "").split(/\n|,(?=\s*\S)/);
  // Fireflies formats summaries as Markdown (**Name**, "- item"); keep plain text only.
  return raw.map((s) => clean(s.replace(/\*\*|__/g, "").replace(/^[\s*\-•\d.)]+/, ""), 300)).filter(Boolean).slice(0, 50);
}

function findTickets(...texts: string[]): string[] {
  const found = new Set<string>();
  for (const t of texts) for (const m of t.matchAll(TICKET_RE)) found.add(m[0]);
  return [...found].slice(0, 20);
}

async function fetchPage(apiKey: string, variables: Record<string, unknown>): Promise<FirefliesTranscript[]> {
  let response: Response;
  try {
    response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ query: TRANSCRIPTS_QUERY, variables }),
      cache: "no-store",
    });
  } catch {
    throw new FirefliesError("Fireflies nu răspunde.", 502);
  }
  const body = (await response.json().catch(() => null)) as
    | { data?: { transcripts?: FirefliesTranscript[] | null }; errors?: { message?: string; code?: string; extensions?: { code?: string } }[] }
    | null;
  // Fireflies answers a bad key with HTTP 500 + code "auth_failed", not 401.
  const authFailed = body?.errors?.some((e) => e.code === "auth_failed" || e.extensions?.code === "auth_failed");
  if (authFailed || response.status === 401 || response.status === 403) throw new FirefliesError("Cheia Fireflies este invalidă.", 401);
  if (!response.ok || !body) throw new FirefliesError(`Fireflies a răspuns cu ${response.status}.`, 502);
  if (body.errors?.length) throw new FirefliesError(`Fireflies: ${body.errors[0]?.message ?? "eroare GraphQL"}`, 502);
  return body.data?.transcripts ?? [];
}

const upsertMeeting = db.prepare(`
  INSERT INTO meetings (id, title, date, duration_min, transcript_url, participant_count, ticket_ids, overview, action_items, keywords, synced_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    title = excluded.title, date = excluded.date, duration_min = excluded.duration_min,
    transcript_url = excluded.transcript_url, participant_count = excluded.participant_count,
    ticket_ids = excluded.ticket_ids, overview = excluded.overview, action_items = excluded.action_items,
    keywords = excluded.keywords, synced_at = excluded.synced_at
`);
const deleteSentences = db.prepare("DELETE FROM meeting_sentences WHERE meeting_id = ?");
const insertSentence = db.prepare("INSERT INTO meeting_sentences (meeting_id, idx, speaker, text, start_s, end_s) VALUES (?, ?, ?, ?, ?, ?)");

function store(t: FirefliesTranscript, ticketIds: string[], syncedAt: string): void {
  const sentences = (t.sentences ?? []).filter((s) => s.text);
  const date = t.dateString ?? (typeof t.date === "number" ? new Date(t.date).toISOString() : syncedAt);
  db.exec("BEGIN");
  try {
    upsertMeeting.run(
      t.id,
      clean(t.title, 300) || "Ședință fără titlu",
      date,
      typeof t.duration === "number" ? t.duration : 0,
      t.transcript_url ?? null,
      // Participant emails are not stored, only how many there were.
      Array.isArray(t.participants) ? t.participants.length : 0,
      JSON.stringify(ticketIds),
      clean(t.summary?.overview),
      JSON.stringify(splitList(t.summary?.action_items)),
      JSON.stringify(splitList(t.summary?.keywords)),
      syncedAt,
    );
    deleteSentences.run(t.id);
    sentences.slice(0, 5000).forEach((s, i) => {
      insertSentence.run(t.id, s.index ?? i, clean(s.speaker_name, 120) || "Vorbitor", clean(s.text, 2000), toSeconds(s.start_time), toSeconds(s.end_time));
    });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function setState(lastSync: string | null, lastError: string | null): void {
  db.prepare(`
    INSERT INTO integration_state (name, last_sync, last_error) VALUES ('fireflies', ?, ?)
    ON CONFLICT(name) DO UPDATE SET last_sync = COALESCE(excluded.last_sync, last_sync), last_error = excluded.last_error
  `).run(lastSync, lastError);
}

export function getState(): { last_sync: string | null; last_error: string | null } {
  const row = db.prepare("SELECT last_sync, last_error FROM integration_state WHERE name = 'fireflies'").get() as
    | { last_sync: string | null; last_error: string | null }
    | undefined;
  return row ?? { last_sync: null, last_error: null };
}

export async function syncFireflies(options: SyncOptions): Promise<SyncResult> {
  const apiKey = process.env.FIREFLIES_API_KEY;
  if (!apiKey) throw new FirefliesError("Fireflies nu este configurat pe server (lipsește FIREFLIES_API_KEY).", 503);
  const onlyWithTicket = options.onlyWithTicket !== false;
  const variables: Record<string, unknown> = { limit: PAGE_SIZE };
  if (options.fromDate) variables.fromDate = options.fromDate;
  if (options.toDate) variables.toDate = options.toDate;
  if (options.keyword) variables.keyword = options.keyword.slice(0, 255);

  const syncedAt = new Date().toISOString();
  const result: SyncResult = { fetched: 0, stored: 0, skippedNoTicket: 0, meetings: [] };
  const storedIds: string[] = [];
  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      const batch = await fetchPage(apiKey, { ...variables, skip: page * PAGE_SIZE });
      result.fetched += batch.length;
      for (const t of batch) {
        if (!t?.id) continue;
        const ticketIds = findTickets(
          t.title ?? "",
          t.summary?.overview ?? "",
          String(t.summary?.action_items ?? ""),
          ...(t.sentences ?? []).map((s) => s.text ?? ""),
        );
        // Privacy default: a meeting not linked to any ticket is not imported at all.
        if (onlyWithTicket && ticketIds.length === 0) {
          result.skippedNoTicket++;
          continue;
        }
        store(t, ticketIds, syncedAt);
        storedIds.push(t.id);
      }
      if (batch.length < PAGE_SIZE) break;
    }
  } catch (error) {
    setState(null, error instanceof Error ? error.message : String(error));
    throw error;
  }
  setState(syncedAt, null);
  result.stored = storedIds.length;
  result.meetings = listMeetings().filter((m) => storedIds.includes(m.id));
  return result;
}

interface MeetingRow {
  id: string;
  title: string;
  date: string;
  duration_min: number;
  transcript_url: string | null;
  participant_count: number;
  ticket_ids: string;
  overview: string;
  action_items: string;
  keywords: string;
  synced_at: string;
  sentence_count: number;
}

function toSummary(row: MeetingRow): MeetingSummary {
  return {
    ...row,
    ticket_ids: JSON.parse(row.ticket_ids) as string[],
    action_items: JSON.parse(row.action_items) as string[],
    keywords: JSON.parse(row.keywords) as string[],
  };
}

const SUMMARY_SQL = `
  SELECT m.*, (SELECT COUNT(*) FROM meeting_sentences s WHERE s.meeting_id = m.id) AS sentence_count
  FROM meetings m
`;

export function listMeetings(ticketId?: string): MeetingSummary[] {
  const rows = db.prepare(`${SUMMARY_SQL} ORDER BY m.date DESC`).all() as unknown as MeetingRow[];
  const all = rows.map(toSummary);
  return ticketId ? all.filter((m) => m.ticket_ids.includes(ticketId)) : all;
}

export function getMeeting(id: string): (MeetingSummary & { sentences: MeetingSentence[] }) | null {
  const row = db.prepare(`${SUMMARY_SQL} WHERE m.id = ?`).get(id) as unknown as MeetingRow | undefined;
  if (!row) return null;
  const sentences = db
    .prepare("SELECT idx, speaker, text, start_s, end_s FROM meeting_sentences WHERE meeting_id = ? ORDER BY idx")
    .all(id) as unknown as MeetingSentence[];
  return { ...toSummary(row), sentences };
}

export function deleteMeeting(id: string): boolean {
  deleteSentences.run(id);
  db.prepare("DELETE FROM meeting_drafts WHERE meeting_id = ?").run(id);
  return db.prepare("DELETE FROM meetings WHERE id = ?").run(id).changes > 0;
}

// ---------- meetings → procedure drafts ----------

db.exec(`
  CREATE TABLE IF NOT EXISTS meeting_drafts (
    meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    ticket_id  TEXT NOT NULL DEFAULT '',
    draft      TEXT NOT NULL,
    quality    TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (meeting_id, ticket_id)
  );
`);

// Shapes a meeting like a normalized capture (capture-session.v1) so ai/processor.mjs can turn it into
// a cited, step-by-step procedure: each spoken line becomes one "utterance" step the draft can cite.
export function meetingToCapture(meeting: MeetingSummary & { sentences: MeetingSentence[] }, ticketId: string | null) {
  const start = Date.parse(meeting.date) || Date.now();
  return {
    schema_version: "1.0",
    session: {
      id: `meeting:${meeting.id}`,
      source: "meeting",
      application: `Ședință Fireflies – ${meeting.title}`,
      started_at: new Date(start).toISOString(),
      status: "completed",
      ticket: ticketId
        ? { external_id: ticketId, system: "other", title: meeting.title, description: [meeting.overview, ...meeting.action_items].filter(Boolean).join("\n") }
        : null,
    },
    steps: meeting.sentences.slice(0, 1000).map((s, i) => ({
      id: `${meeting.id}:${s.idx}`,
      seq: i + 1,
      ts: new Date(start + Math.round((s.start_s ?? 0) * 1000)).toISOString(),
      type: "utterance",
      description: `${s.speaker}: ${s.text}`,
      app: { domain: "fireflies", title: meeting.title },
      value: null,
      masked: false,
      mask_reasons: [],
    })),
  };
}

export interface StoredDraft {
  ticket_id: string;
  draft: unknown;
  quality: unknown;
  created_at: string;
}

export function saveDraft(meetingId: string, ticketId: string | null, draft: unknown, quality: unknown): StoredDraft {
  const row = { ticket_id: ticketId ?? "", draft, quality, created_at: new Date().toISOString() };
  db.prepare(`
    INSERT INTO meeting_drafts (meeting_id, ticket_id, draft, quality, created_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(meeting_id, ticket_id) DO UPDATE SET draft = excluded.draft, quality = excluded.quality, created_at = excluded.created_at
  `).run(meetingId, row.ticket_id, JSON.stringify(draft), JSON.stringify(quality), row.created_at);
  return row;
}

export function listDrafts(meetingId: string): StoredDraft[] {
  const rows = db.prepare("SELECT ticket_id, draft, quality, created_at FROM meeting_drafts WHERE meeting_id = ? ORDER BY created_at DESC")
    .all(meetingId) as unknown as { ticket_id: string; draft: string; quality: string; created_at: string }[];
  return rows.map((r) => ({ ...r, draft: JSON.parse(r.draft), quality: JSON.parse(r.quality) }));
}
