// In-app notifications (the bell in the frontend header), stored in SQLite. Each one has a stable id
// so the same event (e.g. "capture <session> started") is never announced twice.
import { db } from "@/app/lib/db";

export type NotificationKind = "capture" | "capture_done" | "meeting" | "draft" | "error";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  href: string | null;
  created_at: string;
  read_at: string | null;
}

const MAX_KEPT = 200;

db.exec(`
  CREATE TABLE IF NOT EXISTS notifications (
    id         TEXT PRIMARY KEY,
    kind       TEXT NOT NULL,
    title      TEXT NOT NULL,
    body       TEXT NOT NULL DEFAULT '',
    href       TEXT,
    created_at TEXT NOT NULL,
    read_at    TEXT
  );
`);

// Creates the notification once; a later call with the same id is ignored unless `refresh` is set,
// which updates the text and marks it unread again (e.g. a newer draft for the same meeting).
export function notify(n: { id: string; kind: NotificationKind; title: string; body?: string; href?: string | null }, refresh = false): void {
  const now = new Date().toISOString();
  const sql = refresh
    ? `INSERT INTO notifications (id, kind, title, body, href, created_at, read_at) VALUES (?, ?, ?, ?, ?, ?, NULL)
       ON CONFLICT(id) DO UPDATE SET title = excluded.title, body = excluded.body, href = excluded.href,
         created_at = excluded.created_at, read_at = NULL`
    : `INSERT OR IGNORE INTO notifications (id, kind, title, body, href, created_at, read_at) VALUES (?, ?, ?, ?, ?, ?, NULL)`;
  db.prepare(sql).run(n.id, n.kind, n.title.slice(0, 200), (n.body ?? "").slice(0, 500), n.href ?? null, now);
  db.prepare(`DELETE FROM notifications WHERE id NOT IN (SELECT id FROM notifications ORDER BY created_at DESC LIMIT ${MAX_KEPT})`).run();
}

export function listNotifications(limit = 30): { notifications: AppNotification[]; unread: number } {
  const notifications = db
    .prepare("SELECT id, kind, title, body, href, created_at, read_at FROM notifications ORDER BY created_at DESC LIMIT ?")
    .all(limit) as unknown as AppNotification[];
  const { unread } = db.prepare("SELECT COUNT(*) AS unread FROM notifications WHERE read_at IS NULL").get() as { unread: number };
  return { notifications, unread };
}

export function markRead(id?: string): void {
  const now = new Date().toISOString();
  if (id) db.prepare("UPDATE notifications SET read_at = ? WHERE id = ? AND read_at IS NULL").run(now, id);
  else db.prepare("UPDATE notifications SET read_at = ? WHERE read_at IS NULL").run(now);
}

export function clearNotifications(): void {
  db.prepare("DELETE FROM notifications").run();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Called for every batch the capture extension sends to /api/events.
export function notifyCaptureBatch(sessionId: string, session: unknown, events: unknown[]): void {
  const meta = isRecord(session) ? session : {};
  const ticket = isRecord(meta.ticket) && typeof meta.ticket.external_id === "string"
    ? meta.ticket.external_id
    : events.map((e) => (isRecord(e) && isRecord(e.metadata) && typeof e.metadata.ticket === "string" ? e.metadata.ticket : null)).find(Boolean) ?? null;
  const label = ticket ? `tichetul ${ticket}` : `sesiunea ${sessionId.slice(0, 8)}`;
  const href = `/review?sessionId=${encodeURIComponent(sessionId)}`;
  notify({ id: `capture:${sessionId}`, kind: "capture", title: `Captură nouă pentru ${label}`, body: "Pașii sosesc din extensia de captură.", href });
  if (meta.status === "completed" || meta.status === "aborted") {
    const steps = typeof meta.step_count === "number" ? meta.step_count : events.length;
    notify({
      id: `capture-done:${sessionId}`,
      kind: "capture_done",
      title: meta.status === "completed" ? `Captură finalizată: ${label}` : `Captură abandonată: ${label}`,
      body: meta.status === "completed" ? `${steps} pași capturați. Poți genera procedura.` : `${steps} pași capturați înainte de oprire.`,
      href,
    });
  }
}
