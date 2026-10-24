"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CircleAlert, Radio, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { generateDraft, listSessions, type ClaimStatus, type DraftClaim, type DraftResponse, type SessionSummary } from "@/lib/api";

const statusStyles: Record<ClaimStatus, string> = {
  "Deducție AI": "bg-[#f0edfa] text-[#7263a5]",
  Observat: "bg-[#eaf2f8] text-[#567c9d]",
  Neconfirmat: "bg-[#fff4df] text-[#a67a35]",
  Confirmat: "bg-[#fff0e7] text-[#d85514]",
};

const matchLabel = { matched: "asociat", candidate: "candidat", unmatched: "neasociat" } as const;

function StatusPill({ status }: { status: ClaimStatus }) {
  return <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[9px] font-semibold ${statusStyles[status] ?? statusStyles.Neconfirmat}`}><span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />{status}</span>;
}

function evidenceLabel(seqs: number[]) {
  return seqs.length ? `Evenimente #${seqs.join(", #")}` : "Fără eveniment citat";
}

function ClaimList({ title, items }: { title: string; items: DraftClaim[] }) {
  if (items.length === 0) return null;
  return <div className="mt-4"><div className="text-[9px] font-bold uppercase tracking-[.08em] text-[#708279]">{title}</div><ul className="mt-2 space-y-2">{items.map((item, index) => <li key={index} className="flex flex-wrap items-start justify-between gap-2 rounded-xl bg-[#F0E3D6] px-3 py-2.5"><div className="min-w-0 flex-1"><p className="text-[10px] leading-5 text-[#443026]">{item.text}</p><div className="mt-1 text-[9px] text-[#95a19b]">{evidenceLabel(item.evidence_seq)}</div></div><StatusPill status={item.status} /></li>)}</ul></div>;
}

function formatTime(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString("ro-RO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function LiveDraftPanel() {
  const requestedSession = useSearchParams().get("sessionId") ?? "";
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selected, setSelected] = useState(requestedSession);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [sessionsError, setSessionsError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [draftError, setDraftError] = useState("");
  const [result, setResult] = useState<DraftResponse | null>(null);
  const draftRequest = useRef(0);

  const loadSessions = useCallback(() => listSessions().then(
    (list) => {
      setSessions(list);
      setSessionsError("");
      setSelected((current) => (list.some((session) => session.sessionId === current) ? current : list[0]?.sessionId ?? ""));
      setLoadingSessions(false);
    },
    (error: unknown) => {
      setSessionsError(error instanceof Error ? error.message : "Nu am putut încărca sesiunile.");
      setLoadingSessions(false);
    },
  ), []);

  useEffect(() => { void loadSessions(); }, [loadSessions]);

  const refresh = () => {
    setLoadingSessions(true);
    setSessionsError("");
    void loadSessions();
  };

  const selectSession = (sessionId: string) => {
    draftRequest.current += 1;
    setSelected(sessionId);
    setResult(null);
    setDraftError("");
    setGenerating(false);
  };

  const runDraft = async () => {
    if (!selected) return;
    const id = ++draftRequest.current;
    setGenerating(true);
    setDraftError("");
    setResult(null);
    try {
      const response = await generateDraft(selected);
      if (id === draftRequest.current) setResult(response);
    } catch (error) {
      if (id === draftRequest.current) setDraftError(error instanceof Error ? error.message : "Generarea ciornei a eșuat.");
    } finally {
      if (id === draftRequest.current) setGenerating(false);
    }
  };

  const draft = result?.draft;

  return <section className="overflow-hidden rounded-2xl border border-[#FF5A00] bg-[#E8D9CA] shadow-[0_4px_14px_rgba(61,35,19,.04)]">
    <div className="flex flex-col justify-between gap-3 border-b border-[#DDCABB] px-5 py-4 sm:flex-row sm:items-center sm:px-6">
      <div><div className="flex items-center gap-2"><Radio size={15} className="text-[#c95418]" /><h2 className="text-[13px] font-semibold text-[#302016]">Sesiuni capturate</h2><span className="rounded-full bg-[#fff0e7] px-2 py-1 text-[9px] font-semibold text-[#d85514]">live din backend</span></div><p className="mt-1 text-[10px] text-[#8c9a93]">Alege o sesiune trimisă de extensie și generează o ciornă de procedură cu AI.</p></div>
      <button onClick={() => void refresh()} disabled={loadingSessions} className="inline-flex h-9 items-center gap-2 self-start rounded-xl border border-[#D9C3AF] bg-[#E8D9CA] px-3 text-[10px] font-semibold text-[#60736a] hover:bg-[#EEE0D2] disabled:opacity-60 sm:self-auto"><RefreshCw size={13} className={loadingSessions ? "animate-spin" : ""} /> Reîmprospătează</button>
    </div>
    <div className="p-5 sm:p-6">
      {sessionsError && <div className="flex items-start gap-2 rounded-xl border border-[#f0dfbd] bg-[#fff9eb] px-3 py-2.5 text-[10px] text-[#775a2a]"><CircleAlert size={14} className="mt-0.5 shrink-0" />{sessionsError}</div>}
      {!sessionsError && !loadingSessions && sessions.length === 0 && <p className="text-[10px] leading-5 text-[#77877f]">Nicio sesiune primită încă. Pornește o captură din extensie; evenimentele ajung la <span className="font-mono">/api/events</span>.</p>}
      {sessions.length > 0 && <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <select aria-label="Sesiune capturată" value={selected} onChange={(event) => selectSession(event.target.value)} className="h-10 min-w-0 flex-1 rounded-xl border border-[#D9C3AF] bg-[#F0E3D6] px-3 font-mono text-[10px] text-[#455a4f] outline-none focus:border-[#ff9a63]">
          {sessions.map((session) => <option key={session.sessionId} value={session.sessionId}>{session.sessionId} · {session.eventCount} evenimente · {formatTime(session.lastAt)}</option>)}
        </select>
        <button onClick={() => void runDraft()} disabled={!selected || generating} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#ff5a00] px-4 text-[10px] font-semibold text-[#29170e] transition hover:bg-[#e94c00] disabled:opacity-60"><Sparkles size={13} />{generating ? "Se generează…" : "Generează ciornă AI"}</button>
      </div>}
      {requestedSession && !loadingSessions && !sessionsError && !sessions.some((session) => session.sessionId === requestedSession) && <p className="mt-2 text-[9px] text-[#a07836]">Sesiunea <span className="font-mono">{requestedSession}</span> nu are evenimente în backend.</p>}
      {draftError && <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#f0dfbd] bg-[#fff9eb] px-3 py-2.5 text-[10px] text-[#775a2a]"><CircleAlert size={14} className="mt-0.5 shrink-0" />{draftError}</div>}

      {draft && result && <div className="mt-5 border-t border-[#DDCABB] pt-5">
        <div className="flex flex-wrap items-center gap-2"><span className="rounded-md bg-[#fff3dc] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-[#a07836]">Ciornă AI</span>{result.quality.grounding_score !== null && <span className="inline-flex items-center gap-1 rounded-full bg-[#fff4ec] px-2 py-1 text-[9px] font-semibold text-[#c95418]"><ShieldCheck size={11} /> {result.quality.grounding_score}% afirmații cu surse</span>}<span className="rounded-full bg-[#F0E3D6] px-2 py-1 text-[9px] text-[#72837a]">Tichet: {draft.ticket_link.ticket_id ?? "—"} · {matchLabel[draft.ticket_link.match_status] ?? draft.ticket_link.match_status}</span>{result.truncated && <span className="rounded-full bg-[#fff4df] px-2 py-1 text-[9px] text-[#a67a35]">Doar ultimele 1000 de evenimente</span>}</div>
        <h3 className="mt-3 text-[18px] font-semibold tracking-[-0.03em] text-[#2a170e]">{draft.title}</h3>
        <p className="mt-2 text-[11px] leading-5 text-[#5f5046]">{draft.session_summary}</p>
        {!draft.sufficient_evidence && <div className="mt-3 flex items-start gap-2 rounded-xl border border-[#f0dfbd] bg-[#fff9eb] px-3 py-2.5 text-[10px] text-[#775a2a]"><CircleAlert size={14} className="mt-0.5 shrink-0" />Dovezile nu sunt suficiente pentru o procedură completă.</div>}

        <ClaimList title="Aplicabilitate" items={draft.applicability} />
        <ClaimList title="Precondiții" items={draft.prerequisites} />
        {draft.steps.length > 0 && <div className="mt-4"><div className="text-[9px] font-bold uppercase tracking-[.08em] text-[#708279]">Pași</div><div className="mt-2 space-y-1">{draft.steps.map((step, index) => <div key={index} className="flex gap-3 rounded-xl px-2 py-3 transition hover:bg-[#F0E3D6]"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#f1f4f2] text-[10px] font-semibold text-[#72837a]">{step.order || index + 1}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[11px] font-medium leading-5 text-[#443026]">{step.instruction}</p><StatusPill status={step.status} /></div><div className="mt-1.5 text-[9px] text-[#95a19b]">{evidenceLabel(step.evidence_seq)}{step.reason ? ` · ${step.reason}` : ""}</div></div></div>)}</div></div>}
        <ClaimList title="Condiții" items={draft.conditions} />
        <ClaimList title="Excepții" items={draft.exceptions} />
        {draft.outcome && <ClaimList title="Rezultat" items={[draft.outcome]} />}
        {draft.uncertainties.length > 0 && <div className="mt-4"><div className="text-[9px] font-bold uppercase tracking-[.08em] text-[#708279]">Întrebări deschise</div><ul className="mt-2 space-y-2">{draft.uncertainties.map((item, index) => <li key={index} className="rounded-xl border border-[#f0e5cf] bg-[#fffaf0] px-3 py-2.5"><p className="text-[10px] font-semibold text-[#795f35]">{item.question}</p><p className="mt-1 text-[9px] leading-4 text-[#927b52]">{item.reason}</p></li>)}</ul></div>}
        {draft.missing_information.length > 0 && <div className="mt-4"><div className="text-[9px] font-bold uppercase tracking-[.08em] text-[#708279]">Informații lipsă</div><ul className="mt-2 list-disc space-y-1 pl-5 text-[10px] leading-5 text-[#77877f]">{draft.missing_information.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
        <p className="mt-5 text-[9px] leading-4 text-[#9aa69f]">AI-ul nu poate marca nimic drept „Confirmat”; fiecare pas trebuie validat de o persoană.</p>
      </div>}
    </div>
  </section>;
}
