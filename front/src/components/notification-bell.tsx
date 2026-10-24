"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Bell, CheckCheck, FileText, Radio, Sparkles, Video } from "lucide-react";
import { listNotifications, markNotificationsRead, type AppNotification, type NotificationKind } from "@/lib/api";

const POLL_MS = 15_000;

const kindIcon: Record<NotificationKind, typeof Bell> = {
  capture: Radio,
  capture_done: FileText,
  meeting: Video,
  draft: Sparkles,
  error: AlertTriangle,
};

function timeAgo(iso: string, now: number) {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (minutes < 1) return "acum";
  if (minutes < 60) return `acum ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `acum ${hours} h`;
  return new Date(iso).toLocaleDateString("ro-RO", { day: "numeric", month: "short" });
}

export function NotificationBell() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [offline, setOffline] = useState(false);
  const [now, setNow] = useState(0);
  const root = useRef<HTMLDivElement>(null);

  const apply = (data: { notifications: AppNotification[]; unread: number }) => {
    setItems(data.notifications);
    setUnread(data.unread);
    setOffline(false);
  };

  const load = useCallback(async () => {
    try {
      apply(await listNotifications());
    } catch {
      setOffline(true);
    }
  }, []);

  useEffect(() => {
    // Poll the backend; the initial fetch resolves asynchronously, after this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const timer = window.setInterval(load, POLL_MS);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = () => {
    setNow(Date.now());
    setOpen((v) => !v);
    if (!open) void load();
  };

  const readOne = async (n: AppNotification) => {
    setOpen(false);
    if (n.read_at) return;
    try {
      apply(await markNotificationsRead(n.id));
    } catch {
      /* the next poll retries */
    }
  };

  const readAll = async () => {
    try {
      apply(await markNotificationsRead());
    } catch {
      setOffline(true);
    }
  };

  return <div ref={root} className="relative">
    <button
      aria-label={unread ? `Notificări (${unread} necitite)` : "Notificări"}
      aria-expanded={open}
      onClick={toggle}
      className="relative grid h-9 w-9 place-items-center rounded-xl border border-[#FF5A00] bg-[#FF5A00] text-[#29170e] hover:bg-[#e94c00]"
    >
      <Bell size={15} />
      {unread > 0 && <span className="absolute -right-1.5 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#21130d] px-1 text-[9px] font-bold text-white ring-2 ring-[#E8D9CA]">{unread > 9 ? "9+" : unread}</span>}
    </button>

    {open && <div className="absolute right-0 top-11 z-50 w-[min(360px,calc(100vw-32px))] overflow-hidden rounded-2xl border border-[#FF5A00] bg-[#F3E7DB] text-left shadow-[0_12px_32px_rgba(40,20,10,.18)]">
      <div className="flex items-center justify-between border-b border-[#DDCABB] px-4 py-3 text-[10px]">
        <div className="text-[12px] font-semibold text-[#2b1b12]">Notificări{unread ? ` · ${unread} necitite` : ""}</div>
        <button onClick={readAll} disabled={!unread} className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#db4b00] hover:text-[#b83d00] disabled:opacity-40">
          <CheckCheck size={12} />Marchează tot ca citit
        </button>
      </div>
      <div className="max-h-[420px] overflow-y-auto">
        {offline && <div className="px-4 py-3 text-[10px] text-[#a43a12]">Backend-ul nu răspunde. Pornește serverul din folderul backend.</div>}
        {!offline && items.length === 0 && <div className="px-4 py-10 text-center text-[11px] text-[#86756a]">Nicio notificare încă.<br />Apar aici capturile noi, ședințele importate și procedurile generate.</div>}
        {items.map((n) => {
          const Icon = kindIcon[n.kind] ?? Bell;
          const content = <div className={`flex gap-3 px-4 py-3 transition hover:bg-[#EEE0D2] ${n.read_at ? "" : "bg-[#fff6f0]"}`}>
            <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${n.kind === "error" ? "bg-[#fde5dc] text-[#a43a12]" : "bg-[#fff0e7] text-[#d6500c]"}`}><Icon size={14} /></div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-2">
                <div className={`min-w-0 flex-1 text-[11px] leading-4 text-[#2b1b12] ${n.read_at ? "font-medium" : "font-semibold"}`}>{n.title}</div>
                {!n.read_at && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#ff5a00]" aria-label="necitită" />}
              </div>
              {n.body && <div className="mt-0.5 text-[10px] leading-4 text-[#6f5a4b]">{n.body}</div>}
              <div className="mt-1 text-[9px] text-[#9a8576]">{timeAgo(n.created_at, now)}</div>
            </div>
          </div>;
          return <div key={n.id} className="border-b border-[#E6D5C6] last:border-b-0">
            {n.href
              ? <Link href={n.href} onClick={() => readOne(n)} className="block">{content}</Link>
              : <button onClick={() => readOne(n)} className="block w-full text-left">{content}</button>}
          </div>;
        })}
      </div>
    </div>}
  </div>;
}
