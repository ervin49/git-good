"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { deleteMeeting, generateMeetingDraft, getFirefliesStatus, getMeeting, listMeetingDrafts, syncFireflies, type ClaimStatus, type FirefliesStatus, type Meeting, type MeetingDraft, type MeetingSentence } from "@/lib/api";
import { ChevronDown, ChevronUp, CircleHelp, Clock3, ExternalLink, ListChecks, Loader2, RefreshCw, ShieldCheck, Sparkles, Tag, Trash2, Users, Video, X } from "lucide-react";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("ro-RO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

const statusStyle: Record<ClaimStatus, string> = {
  Observat: "bg-[#e3f1e8] text-[#2f6b45]",
  "Deducție AI": "bg-[#f0edfa] text-[#6a5aa0]",
  Confirmat: "bg-[#fff0e7] text-[#d6500c]",
  Neconfirmat: "bg-[#fff4df] text-[#9a6a17]",
};

function fmtTime(seconds: number | null) {
  if (seconds == null) return "";
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function MeetingsPage() {
  const [status, setStatus] = useState<FirefliesStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [days, setDays] = useState(14);
  const [keyword, setKeyword] = useState("");
  const [onlyWithTicket, setOnlyWithTicket] = useState(true);
  const [ticketFilter, setTicketFilter] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<Record<string, MeetingSentence[]>>({});
  const [drafts, setDrafts] = useState<Record<string, MeetingDraft | null>>({});
  const [generating, setGenerating] = useState<string | null>(null);
  const [draftTicket, setDraftTicket] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      setStatus(await getFirefliesStatus());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    // Initial fetch from the backend; state is set once the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const meetings = useMemo(
    () => (status?.meetings ?? []).filter((m) => !ticketFilter || m.ticket_ids.includes(ticketFilter)),
    [status, ticketFilter],
  );

  const runSync = async () => {
    setSyncing(true);
    setNotice(null);
    try {
      const r = await syncFireflies({ days, keyword: keyword.trim() || undefined, onlyWithTicket });
      setNotice(`Importate ${r.stored} ședințe din ${r.fetched} găsite${r.skippedNoTicket ? ` · ${r.skippedNoTicket} ignorate (fără tichet)` : ""}.`);
      setError(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      await load();
    }
    setSyncing(false);
  };

  const loadDetail = async (m: Meeting) => {
    try {
      if (!transcripts[m.id]) {
        const detail = await getMeeting(m.id);
        setTranscripts((t) => ({ ...t, [m.id]: detail.sentences }));
      }
      if (!(m.id in drafts)) {
        const list = await listMeetingDrafts(m.id);
        setDrafts((d) => ({ ...d, [m.id]: list[0] ?? null }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const toggle = async (m: Meeting) => {
    if (open === m.id) return setOpen(null);
    setOpen(m.id);
    await loadDetail(m);
  };

  // Turns the discussion into a step-by-step procedure draft (AI on the backend, cited to transcript lines).
  const makeProcedure = async (m: Meeting) => {
    setOpen(m.id);
    setGenerating(m.id);
    setError(null);
    try {
      await loadDetail(m);
      const draft = await generateMeetingDraft(m.id, draftTicket[m.id] ?? m.ticket_ids[0]);
      setDrafts((d) => ({ ...d, [m.id]: draft }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setGenerating(null);
  };

  const remove = async (m: Meeting) => {
    if (!window.confirm(`Ștergi ședința „${m.title}” și transcrierea ei din Helpy?`)) return;
    try {
      await deleteMeeting(m.id);
      setNotice("Ședința a fost ștearsă din Helpy (rămâne în Fireflies).");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return <AppShell>
    <div className="space-y-7">
      <div>
        <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#ff5a00]">SURSE · ȘEDINȚE</div>
        <h1 className="text-[27px] font-semibold tracking-[-0.045em] text-[#2a170e] sm:text-[32px]">Ședințe din Fireflies</h1>
        <p className="mt-2 max-w-[640px] text-[13px] leading-6 text-[#788881]">Transcrierile și rezumatele ședințelor în care s-a discutat un tichet. Helpy le leagă automat de tichetele menționate (ex. FAC-1042).</p>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-[#f6d3bd] bg-[#fff6f0] p-4">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#E8D9CA] text-[#e35a18]"><ShieldCheck size={15} /></div>
        <div>
          <div className="text-[10px] font-semibold text-[#3c2a1e]">Implicit se importă doar ședințele legate de un tichet.</div>
          <p className="mt-1 text-[9px] leading-5 text-[#7d6a5c]">Emailurile participanților nu se salvează (doar numărul lor), iar emailurile, token-urile și cheile spuse în ședință sunt mascate înainte de stocare. Cheia Fireflies stă doar pe server.</p>
        </div>
      </div>

      <section className="rounded-2xl border border-[#FF5A00] bg-[#E8D9CA] p-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#fff3eb] text-[#e85a1b]"><Video size={16} /></div>
            <div>
              <div className="text-[12px] font-semibold text-[#302016]">Fireflies.ai</div>
              <div className="mt-0.5 text-[9px] text-[#86756a]">
                {!status ? "Se verifică…" : status.configured
                  ? `Conectat · ultima sincronizare: ${status.last_sync ? fmtDate(status.last_sync) : "niciodată"}`
                  : "Neconfigurat – setează FIREFLIES_API_KEY pe backend"}
              </div>
            </div>
          </div>
          <span className={`self-start rounded-full px-2 py-1 text-[9px] font-semibold sm:self-auto ${status?.configured ? "bg-[#fff0e7] text-[#d6500c]" : "bg-[#EEE0D2] text-[#6f5a4b]"}`}>{status?.configured ? "activ" : "inactiv"}</span>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 text-[10px] sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:items-center">
          <label className="flex items-center gap-2 rounded-xl border border-[#D6C1AD] bg-[#F0E3D6] px-3 py-2 text-[#5b4637]">
            <Clock3 size={13} className="text-[#c95418]" />
            <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="bg-transparent font-semibold outline-none">
              {[1, 7, 14, 30, 90].map((d) => <option key={d} value={d}>ultimele {d} {d === 1 ? "zi" : "zile"}</option>)}
            </select>
          </label>
          <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Cuvânt cheie / ID tichet (opțional)" className="h-9 rounded-xl border border-[#D6C1AD] bg-[#F0E3D6] px-3 text-[#33483f] outline-none placeholder:text-[#a2938a]" />
          <label className="flex items-center gap-2 text-[#5b4637]"><input type="checkbox" checked={onlyWithTicket} onChange={(e) => setOnlyWithTicket(e.target.checked)} className="accent-[#ff5a00]" /> Doar cu tichet</label>
          <button onClick={runSync} disabled={syncing || !status?.configured} className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-[#ff5a00] px-4 font-semibold text-[#29170e] shadow-sm transition hover:bg-[#e94c00] disabled:opacity-50">
            {syncing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}{syncing ? "Se importă…" : "Importă ședințe"}
          </button>
        </div>
        {status?.last_error && <p className="mt-3 text-[9px] text-[#a43a12]">Ultima eroare: {status.last_error}</p>}
      </section>

      {notice && <div className="rounded-xl border border-[#FF5A00] bg-[#E8D9CA] px-4 py-3 text-[11px] text-[#3c2a1e]">{notice}</div>}
      {error && <div className="rounded-xl border border-[#e7a98a] bg-[#fff1ea] px-4 py-3 text-[11px] text-[#a43a12]">{error}</div>}

      <section className="overflow-hidden rounded-2xl border border-[#FF5A00] bg-[#E8D9CA]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DDCABB] px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-[14px] font-semibold text-[#2b1b12]">Ședințe importate</h2>
            <p className="mt-1 text-[10px] text-[#8a7a6e]">{meetings.length} ședințe{ticketFilter ? ` pentru ${ticketFilter}` : ""}</p>
          </div>
          {ticketFilter && <button onClick={() => setTicketFilter(null)} className="inline-flex items-center gap-1 rounded-lg border border-[#D9C3AF] px-2.5 py-1.5 text-[10px] font-semibold text-[#5b4637] hover:bg-[#F0E3D6]"><X size={12} />Toate tichetele</button>}
        </div>
        <div className="divide-y divide-[#E0CEBF]">
          {meetings.map((m) => <article key={m.id} className="px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h3 className="text-[12px] font-semibold text-[#332117]">{m.title}</h3>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-[#86756a]">
                  <span>{fmtDate(m.date)}</span>
                  <span>{Math.round(m.duration_min)} min</span>
                  <span className="inline-flex items-center gap-1"><Users size={11} />{m.participant_count} participanți</span>
                  <span>{m.sentence_count} replici</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[9px]">
                  {m.ticket_ids.map((t) => <button key={t} onClick={() => setTicketFilter(t)} className="inline-flex items-center gap-1 rounded-full bg-[#fff0e7] px-2 py-0.5 font-mono font-semibold text-[#c84e13] hover:bg-[#ffe1d1]"><Tag size={10} />{t}</button>)}
                  {m.ticket_ids.length === 0 && <span className="rounded-full bg-[#EEE0D2] px-2 py-0.5 text-[#86756a]">fără tichet</span>}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2 text-[10px]">
                {m.ticket_ids.length > 1 && <select aria-label="Tichetul procedurii" value={draftTicket[m.id] ?? m.ticket_ids[0]} onChange={(e) => setDraftTicket((t) => ({ ...t, [m.id]: e.target.value }))} className="rounded-lg border border-[#D9C3AF] bg-[#F0E3D6] px-2 font-mono text-[#5b4637]">
                  {m.ticket_ids.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>}
                <button onClick={() => makeProcedure(m)} disabled={generating === m.id} className="inline-flex items-center gap-1 rounded-lg bg-[#ff5a00] px-2.5 py-1.5 font-semibold text-[#29170e] hover:bg-[#e94c00] disabled:opacity-60">
                  {generating === m.id ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}{generating === m.id ? "Se generează…" : drafts[m.id] ? "Regenerează procedura" : "Generează procedură"}
                </button>
                {m.transcript_url && <a href={m.transcript_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-[#D9C3AF] px-2.5 py-1.5 font-semibold text-[#5b4637] hover:bg-[#F0E3D6]"><ExternalLink size={12} />Fireflies</a>}
                <button onClick={() => remove(m)} aria-label={`Șterge ${m.title}`} className="inline-flex items-center rounded-lg border border-[#D9C3AF] px-2 py-1.5 text-[#8a3a1a] hover:bg-[#F0E3D6]"><Trash2 size={12} /></button>
              </div>
            </div>
            {m.overview && <p className="mt-3 text-[11px] leading-5 text-[#4a3324]">{m.overview}</p>}
            {m.action_items.length > 0 && <div className="mt-3 rounded-xl bg-[#F0E3D6] px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.1em] text-[#9a8576]"><ListChecks size={12} />Acțiuni</div>
              <ul className="mt-1.5 space-y-1 text-[10px] leading-5 text-[#4a3324]">{m.action_items.map((a, i) => <li key={i}>• {a}</li>)}</ul>
            </div>}
            {m.keywords.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{m.keywords.map((k) => <span key={k} className="rounded-md border border-[#DDCABB] px-1.5 py-0.5 text-[9px] text-[#86756a]">{k}</span>)}</div>}
            <div className="mt-3 text-[10px]">
              <button onClick={() => toggle(m)} className="inline-flex items-center gap-1 font-semibold text-[#db4b00] hover:text-[#b83d00]">
                {open === m.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}{open === m.id ? "Ascunde transcrierea" : "Vezi transcrierea"}
              </button>
            </div>
            {open === m.id && drafts[m.id] && <DraftView draft={drafts[m.id]!} sentences={transcripts[m.id] ?? []} />}
            {open === m.id && <div className="mt-3 max-h-[360px] space-y-2 overflow-y-auto rounded-xl border border-[#DDCABB] bg-[#F3E7DB] p-3">
              {!transcripts[m.id] && <div className="text-[10px] text-[#86756a]">Se încarcă…</div>}
              {transcripts[m.id]?.map((s) => <div key={s.idx} className="text-[10px] leading-5 text-[#4a3324]">
                <span className="font-mono text-[9px] text-[#a08a7a]">{fmtTime(s.start_s)}</span> <span className="font-semibold">{s.speaker}:</span> {s.text}
              </div>)}
            </div>}
          </article>)}
          {status && meetings.length === 0 && <div className="px-6 py-12 text-center text-[12px] text-[#7d6a5c]">
            {status.configured ? "Nicio ședință importată încă. Apasă „Importă ședințe”." : "Configurează Fireflies pe backend ca să poți importa ședințe."}
          </div>}
        </div>
      </section>
    </div>
  </AppShell>;
}

function DraftView({ draft: stored, sentences }: { draft: MeetingDraft; sentences: MeetingSentence[] }) {
  const d = stored.draft;
  // Draft evidence seq N points to the N-th transcript line sent to the AI.
  const quote = (seq: number) => sentences[seq - 1];
  return <div className="mt-4 rounded-xl border border-[#FF5A00] bg-[#F3E7DB] p-4">
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1 rounded-full bg-[#f0edfa] px-2 py-0.5 text-[9px] font-semibold text-[#6a5aa0]"><Sparkles size={10} />Ciornă AI din ședință</span>
      {stored.ticket_id && <span className="rounded-full bg-[#fff0e7] px-2 py-0.5 font-mono text-[9px] font-semibold text-[#c84e13]">{stored.ticket_id}</span>}
      <span className="text-[9px] text-[#86756a]">{fmtDate(stored.created_at)}</span>
    </div>
    <h4 className="mt-2 text-[13px] font-semibold text-[#2b1b12]">{d.title}</h4>
    {d.session_summary && <p className="mt-1 text-[10px] leading-5 text-[#5b4637]">{d.session_summary}</p>}
    {d.steps.length === 0 && <p className="mt-3 text-[10px] text-[#86756a]">Discuția nu descrie un proces clar. {d.missing_information.join(" ")}</p>}
    <ol className="mt-3 space-y-2">
      {d.steps.map((step) => <li key={step.order} className="rounded-lg border border-[#DDCABB] bg-[#F8EEE4] px-3 py-2.5">
        <div className="flex items-start gap-2.5">
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#fff3eb] text-[10px] font-bold text-[#e85a1b]">{step.order}</span>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold leading-5 text-[#332117]">{step.instruction}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[9px]">
              <span className={`rounded-full px-2 py-0.5 font-semibold ${statusStyle[step.status]}`}>{step.status}</span>
              <span className="text-[#86756a]">{step.reason}</span>
            </div>
            {step.evidence_seq.map((seq) => quote(seq) && <div key={seq} className="mt-1.5 border-l-2 border-[#e2c9b5] pl-2 text-[9px] italic leading-4 text-[#7d6a5c]">
              <span className="font-mono not-italic">{fmtTime(quote(seq).start_s)}</span> {quote(seq).speaker}: „{quote(seq).text}”
            </div>)}
          </div>
        </div>
      </li>)}
    </ol>
    {d.uncertainties.length > 0 && <div className="mt-3 rounded-lg bg-[#fffaf0] px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.1em] text-[#9a7a3a]"><CircleHelp size={12} />De clarificat</div>
      <ul className="mt-1.5 space-y-1 text-[10px] leading-5 text-[#5b4637]">{d.uncertainties.map((u, i) => <li key={i}>• {u.question}</li>)}</ul>
    </div>}
    <p className="mt-3 text-[9px] leading-4 text-[#8a7a6e]">Pașii vin din ce s-a spus în ședință, deci sunt cel mult „Deducție AI” până îi confirmă cineva în Revizuire.</p>
  </div>;
}
