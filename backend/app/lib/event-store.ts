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

interface Store {
  events: StoredEvent[];
}

const MAX_EVENTS = 5000;

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
