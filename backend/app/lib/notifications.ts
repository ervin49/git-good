// In-app notifications (the bell in the frontend header), stored in SQLite. Each one has a stable id
// so the same event (e.g. "capture <session> started") is never announced twice.
import { all, get, run } from "@/app/lib/db";

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

// Creates the notification once; a later call with the same id is ignored unless `refresh` is set,
// which updates the text and marks it unread again (e.g. a newer draft for the same meeting).
export async function notify(n: { id: string; kind: NotificationKind; title: string; body?: string; href?: string | null }, refresh = false): Promise<void> {
  const now = new Date().toISOString();
  const sql = refresh
    ? `INSERT INTO notifications (id, kind, title, body, href, created_at, read_at) VALUES (?, ?, ?, ?, ?, ?, NULL)
       ON CONFLICT(id) DO UPDATE SET title = excluded.title, body = excluded.body, href = excluded.href,
         created_at = excluded.created_at, read_at = NULL`
    : `INSERT OR IGNORE INTO notifications (id, kind, title, body, href, created_at, read_at) VALUES (?, ?, ?, ?, ?, ?, NULL)`;
  await run(sql, [n.id, n.kind, n.title.slice(0, 200), (n.body ?? "").slice(0, 500), n.href ?? null, now]);
  await run(`DELETE FROM notifications WHERE id NOT IN (SELECT id FROM notifications ORDER BY created_at DESC LIMIT ${MAX_KEPT})`);
}

export async function listNotifications(limit = 30): Promise<{ notifications: AppNotification[]; unread: number }> {
  const notifications = await all<AppNotification>("SELECT id, kind, title, body, href, created_at, read_at FROM notifications ORDER BY created_at DESC LIMIT ?", [limit]);
  const row = await get<{ unread: number }>("SELECT COUNT(*) AS unread FROM notifications WHERE read_at IS NULL");
  return { notifications, unread: row?.unread ?? 0 };
}

export async function markRead(id?: string): Promise<void> {
  const now = new Date().toISOString();
  if (id) await run("UPDATE notifications SET read_at = ? WHERE id = ? AND read_at IS NULL", [now, id]);
  else await run("UPDATE notifications SET read_at = ? WHERE read_at IS NULL", [now]);
}

export async function clearNotifications(): Promise<void> {
  await run("DELETE FROM notifications");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Called for every batch the capture extension sends to /api/events.
export async function notifyCaptureBatch(sessionId: string, session: unknown, events: unknown[]): Promise<void> {
  const meta = isRecord(session) ? session : {};
  const ticket = isRecord(meta.ticket) && typeof meta.ticket.external_id === "string"
    ? meta.ticket.external_id
    : events.map((e) => (isRecord(e) && isRecord(e.metadata) && typeof e.metadata.ticket === "string" ? e.metadata.ticket : null)).find(Boolean) ?? null;
  const label = ticket ? `tichetul ${ticket}` : `sesiunea ${sessionId.slice(0, 8)}`;
  const href = `/review?sessionId=${encodeURIComponent(sessionId)}`;
  await notify({ id: `capture:${sessionId}`, kind: "capture", title: `Captură nouă pentru ${label}`, body: "Pașii sosesc din extensia de captură.", href });
  if (meta.status === "completed" || meta.status === "aborted") {
    const steps = typeof meta.step_count === "number" ? meta.step_count : events.length;
    await notify({
      id: `capture-done:${sessionId}`,
      kind: "capture_done",
      title: meta.status === "completed" ? `Captură finalizată: ${label}` : `Captură abandonată: ${label}`,
      body: meta.status === "completed" ? `${steps} pași capturați. Poți genera procedura.` : `${steps} pași capturați înainte de oprire.`,
      href,
    });
  }
}
