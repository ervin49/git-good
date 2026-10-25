// Live-sync batches received from the capture extension and a debug log of write requests, kept in the
// database so they survive restarts and are shared between serverless instances.
import { all, batch, run } from "@/app/lib/db";

export interface StoredEvent {
  receivedAt: string;
  sessionId: string;
  origin?: string;
  event: unknown;
}

// Debug log of write requests (POST/DELETE), so failed or empty batches are visible too.
export interface RequestLogEntry {
  at: string;
  method: string;
  status: number;
  sessionId: string | null;
  origin?: string;
  eventCount: number;
  error?: string;
}

const MAX_EVENTS = 5000;
const MAX_REQUESTS = 200;

export async function addEvents(entries: StoredEvent[]): Promise<void> {
  if (!entries.length) return;
  await batch([
    ...entries.map((e) => ({
      sql: "INSERT INTO capture_events (received_at, session_id, origin, event) VALUES (?, ?, ?, ?)",
      args: [e.receivedAt, e.sessionId, e.origin ?? null, JSON.stringify(e.event ?? null)],
    })),
    { sql: "DELETE FROM capture_events WHERE id <= (SELECT MAX(id) FROM capture_events) - ?", args: [MAX_EVENTS] },
  ]);
}

export async function listEvents(sessionId?: string): Promise<StoredEvent[]> {
  const rows = sessionId
    ? await all<{ received_at: string; session_id: string; origin: string | null; event: string }>(
        "SELECT received_at, session_id, origin, event FROM capture_events WHERE session_id = ? ORDER BY id", [sessionId])
    : await all<{ received_at: string; session_id: string; origin: string | null; event: string }>(
        "SELECT received_at, session_id, origin, event FROM capture_events ORDER BY id");
  return rows.map((r) => ({
    receivedAt: r.received_at,
    sessionId: r.session_id,
    ...(r.origin ? { origin: r.origin } : {}),
    event: JSON.parse(r.event),
  }));
}

export async function clearEvents(): Promise<void> {
  await run("DELETE FROM capture_events");
}

export async function logRequest(entry: RequestLogEntry): Promise<void> {
  const who = entry.sessionId ? ` session=${entry.sessionId.slice(0, 8)}` : "";
  const err = entry.error ? ` error=${entry.error}` : "";
  console.log(`[events] ${entry.method} ${entry.status}${who} events=${entry.eventCount} origin=${entry.origin ?? "-"}${err}`);
  await batch([
    {
      sql: "INSERT INTO request_log (at, method, status, session_id, origin, event_count, error) VALUES (?, ?, ?, ?, ?, ?, ?)",
      args: [entry.at, entry.method, entry.status, entry.sessionId, entry.origin ?? null, entry.eventCount, entry.error ?? null],
    },
    { sql: "DELETE FROM request_log WHERE id <= (SELECT MAX(id) FROM request_log) - ?", args: [MAX_REQUESTS] },
  ]);
}

export async function listRequests(): Promise<RequestLogEntry[]> {
  const rows = await all<{ at: string; method: string; status: number; session_id: string | null; origin: string | null; event_count: number; error: string | null }>(
    "SELECT at, method, status, session_id, origin, event_count, error FROM request_log ORDER BY id");
  return rows.map((r) => ({
    at: r.at,
    method: r.method,
    status: r.status,
    sessionId: r.session_id,
    ...(r.origin ? { origin: r.origin } : {}),
    eventCount: r.event_count,
    ...(r.error ? { error: r.error } : {}),
  }));
}
