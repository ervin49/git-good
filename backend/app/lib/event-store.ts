// In-memory store for received live-sync batches. Suitable for a demo / hackathon:
// data lives only as long as the dev server process. Swap for a database for
// anything real. A module-level singleton is shared across route handlers in the
// same server process.

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

interface Store {
  events: StoredEvent[];
  requests?: RequestLogEntry[];
}

const MAX_EVENTS = 5000;
const MAX_REQUESTS = 200;

// Stash on globalThis so it survives module re-evaluation during dev HMR.
const g = globalThis as unknown as { __nodEventStore?: Store };
const store: Store = (g.__nodEventStore ??= { events: [] });

export function addEvents(entries: StoredEvent[]): void {
  store.events.push(...entries);
  if (store.events.length > MAX_EVENTS) {
    store.events.splice(0, store.events.length - MAX_EVENTS);
  }
}

export function listEvents(sessionId?: string): StoredEvent[] {
  const all = store.events;
  return sessionId ? all.filter((e) => e.sessionId === sessionId) : all;
}

export function clearEvents(): void {
  store.events.length = 0;
}

export function logRequest(entry: RequestLogEntry): void {
  const requests = (store.requests ??= []);
  requests.push(entry);
  if (requests.length > MAX_REQUESTS) requests.splice(0, requests.length - MAX_REQUESTS);
  const who = entry.sessionId ? ` session=${entry.sessionId.slice(0, 8)}` : "";
  const err = entry.error ? ` error=${entry.error}` : "";
  console.log(`[events] ${entry.method} ${entry.status}${who} events=${entry.eventCount} origin=${entry.origin ?? "-"}${err}`);
}

export function listRequests(): RequestLogEntry[] {
  return store.requests ?? [];
}
