"use client";

import { useCallback, useEffect, useState } from "react";

interface StoredEvent {
  receivedAt: string;
  sessionId: string;
  origin?: string;
  event: Record<string, unknown>;
}

function summarize(event: Record<string, unknown>): string {
  const kind = event.kind as string | undefined;
  if (kind === "action") {
    const meta = (event.metadata ?? {}) as Record<string, unknown>;
    const key = meta.key ? ` ${String(meta.key)}` : "";
    const label = meta.label ?? meta.text ?? event.target ?? "";
    return `${event.actionType}${key} ${label ? `· ${String(label)}` : ""}`.trim();
  }
  if (kind === "console") return `${event.level}: ${String(event.message ?? "").slice(0, 120)}`;
  if (kind === "network") return `${event.method} ${String(event.url ?? "")} ${event.status ?? ""}`;
  return kind ?? JSON.stringify(event).slice(0, 80);
}

interface RequestLogEntry {
  at: string;
  method: string;
  status: number;
  sessionId: string | null;
  origin?: string;
  eventCount: number;
  error?: string;
}

export default function Home() {
  const [events, setEvents] = useState<StoredEvent[]>([]);
  const [requests, setRequests] = useState<RequestLogEntry[]>([]);
  const [live, setLive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const sessionId = new URLSearchParams(window.location.search).get("sessionId");
      setFilter(sessionId);
      const url = sessionId ? `/api/events?sessionId=${encodeURIComponent(sessionId)}` : "/api/events";
      const res = await fetch(url, { cache: "no-store" });
      const data = (await res.json()) as { events: StoredEvent[]; requests?: RequestLogEntry[] };
      setEvents(data.events);
      setRequests(data.requests ?? []);
      setError(null);
    } catch {
      setError("Could not reach /api/events");
    }
  }, []);

  useEffect(() => {
    load();
    if (!live) return;
    const id = setInterval(load, 2000);
    return () => clearInterval(id);
  }, [load, live]);

  const clear = async () => {
    await fetch("/api/events", { method: "DELETE" });
    load();
  };

  const sessions = [...new Set(events.map((e) => e.sessionId))];

  return (
    <main className="mx-auto max-w-4xl px-6 py-10 font-sans">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">NOD — Live events</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Receiving consented, redacted session events from the browser extension.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLive((v) => !v)}
            className="rounded-full border border-black/10 dark:border-white/15 px-4 py-1.5 text-sm"
          >
            {live ? "⏸ Pause" : "▶ Live"}
          </button>
          <button
            type="button"
            onClick={clear}
            className="rounded-full border border-black/10 dark:border-white/15 px-4 py-1.5 text-sm"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="mt-4 flex gap-4 text-sm text-zinc-500 dark:text-zinc-400">
        <span>{events.length} events</span>
        <span>{sessions.length} session(s)</span>
        {filter && (
          <span>
            session {filter.slice(0, 8)} · <a href="/" className="underline">show all</a>
          </span>
        )}
        {error && <span className="text-red-600 dark:text-red-400">{error}</span>}
      </div>

      <h2 className="mt-6 text-sm font-semibold">Requests (debug)</h2>
      <div className="mt-2 max-h-64 overflow-auto rounded-lg border border-black/10 dark:border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-black/[.03] dark:bg-white/[.04] text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Time</th>
              <th className="px-3 py-2 font-medium">Method</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Session</th>
              <th className="px-3 py-2 font-medium">Events</th>
              <th className="px-3 py-2 font-medium">Origin / error</th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-zinc-500">
                  No POST/DELETE requests received yet.
                </td>
              </tr>
            )}
            {[...requests].reverse().map((r, i) => (
              <tr key={i} className="border-t border-black/5 dark:border-white/5">
                <td className="px-3 py-1.5 tabular-nums text-zinc-500 whitespace-nowrap">
                  {new Date(r.at).toLocaleTimeString()}
                </td>
                <td className="px-3 py-1.5 font-mono text-xs">{r.method}</td>
                <td className={`px-3 py-1.5 font-mono text-xs ${r.status >= 400 ? "text-red-600 dark:text-red-400" : ""}`}>
                  {r.status}
                </td>
                <td className="px-3 py-1.5 font-mono text-xs">{r.sessionId ? r.sessionId.slice(0, 8) : "—"}</td>
                <td className="px-3 py-1.5 tabular-nums text-xs">{r.eventCount}</td>
                <td className="px-3 py-1.5 text-xs text-zinc-500">{r.error ?? r.origin ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-6 text-sm font-semibold">Events</h2>
      <div className="mt-2 overflow-hidden rounded-lg border border-black/10 dark:border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-black/[.03] dark:bg-white/[.04] text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Time</th>
              <th className="px-3 py-2 font-medium">Kind</th>
              <th className="px-3 py-2 font-medium">Summary</th>
              <th className="px-3 py-2 font-medium">Origin</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-zinc-500">
                  No events yet. Start a session in the extension with live sync enabled.
                </td>
              </tr>
            )}
            {[...events].reverse().map((e, i) => (
              <tr key={i} className="border-t border-black/5 dark:border-white/5">
                <td className="px-3 py-1.5 tabular-nums text-zinc-500 whitespace-nowrap">
                  {new Date(e.receivedAt).toLocaleTimeString()}
                </td>
                <td className="px-3 py-1.5 font-mono text-xs">
                  {String((e.event as { kind?: string }).kind ?? "—")}
                </td>
                <td className="px-3 py-1.5 font-mono text-xs">{summarize(e.event)}</td>
                <td className="px-3 py-1.5 text-xs text-zinc-500">{e.origin ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
