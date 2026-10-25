"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { getApprovedProcedure, type ApprovedProcedure } from "@/lib/api";
import { ArrowLeft, BadgeCheck, CircleAlert, ShieldCheck, Tag } from "lucide-react";

const SOURCE_LABEL: Record<ApprovedProcedure["source_type"], string> = { capture: "Captură din browser", meeting: "Ședință Fireflies", teams: "Conversație Teams" };

function fmt(iso: string) {
  return new Date(iso).toLocaleString("ro-RO", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// The route is dynamic: useParams()/usePathname() are runtime URL data, so the whole page renders
// inside Suspense (required with Cache Components).
export default function ApprovedProcedurePage() {
  return <Suspense fallback={null}>
    <AppShell>
      <ProcedureDetail />
    </AppShell>
  </Suspense>;
}

function ProcedureDetail() {
  const id = String(useParams<{ id: string }>().id ?? "");
  const [procedure, setProcedure] = useState<ApprovedProcedure | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getApprovedProcedure(id).then(
      (p) => { if (!cancelled) setProcedure(p); },
      (e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : "Procedura nu a putut fi încărcată."); },
    );
    return () => { cancelled = true; };
  }, [id]);

  return <div className="mx-auto max-w-[900px] space-y-6">
      <Link href="/procedures" className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#c84e13] hover:underline"><ArrowLeft size={13} />Biblioteca de proceduri</Link>
      {error && <div className="flex items-start gap-2 rounded-xl border border-[#e7a98a] bg-[#fff1ea] px-4 py-3 text-[11px] text-[#a43a12]"><CircleAlert size={14} className="mt-0.5 shrink-0" />{error}</div>}
      {!procedure && !error && <div className="text-[12px] text-[#7d6a5c]">Se încarcă…</div>}
      {procedure && <>
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px]">
            <span className="inline-flex items-center gap-1 rounded-full bg-[#eef8f1] px-2 py-1 font-semibold text-[#2f6b45]"><BadgeCheck size={12} />Aprobată</span>
            {procedure.ticket_id && <span className="inline-flex items-center gap-1 rounded-full bg-[#fff0e7] px-2 py-1 font-mono font-semibold text-[#c84e13]"><Tag size={11} />{procedure.ticket_id}</span>}
            <span className="font-mono text-[#8a7a6e]">{procedure.id}</span>
          </div>
          <h1 className="text-[27px] font-semibold tracking-[-0.045em] text-[#2a170e] sm:text-[32px]">{procedure.title}</h1>
          {procedure.summary && <p className="mt-2 max-w-[760px] text-[13px] leading-6 text-[#6f5a4b]">{procedure.summary}</p>}
          <p className="mt-3 text-[11px] text-[#7d6a5c]">Aprobată de <span className="font-semibold text-[#3c2a1e]">{procedure.approved_by}</span> · {fmt(procedure.approved_at)} · sursă: {SOURCE_LABEL[procedure.source_type]}</p>
        </div>

        <section className="overflow-hidden rounded-2xl border border-[#FF5A00] bg-[#E8D9CA]">
          <div className="border-b border-[#DDCABB] px-5 py-4 sm:px-6"><h2 className="text-[14px] font-semibold text-[#2b1b12]">Pași</h2><p className="mt-1 text-[10px] text-[#8a7a6e]">Fiecare pas a fost confirmat de o persoană.</p></div>
          <ol className="divide-y divide-[#E0CEBF]">
            {procedure.steps.map((step) => <li key={step.order} className="flex gap-3 px-5 py-4 sm:px-6">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#fff3eb] text-[11px] font-bold text-[#e85a1b]">{step.order}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-medium leading-5 text-[#2b1b12]">{step.instruction}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[9px] text-[#8a7a6e]">
                  <span className="rounded-full bg-[#fff0e7] px-2 py-0.5 font-semibold text-[#d6500c]">Confirmat</span>
                  <span>{step.reason}</span>
                  {step.evidence_seq.length > 0 && <span>· surse: #{step.evidence_seq.join(", #")}</span>}
                </div>
              </div>
            </li>)}
          </ol>
        </section>

        {procedure.outcome && <div className="rounded-2xl border border-[#FF5A00] bg-[#E8D9CA] px-5 py-4 text-[12px] text-[#3c2a1e]"><span className="font-semibold">Rezultat: </span>{procedure.outcome}</div>}
        <div className="flex items-center gap-2 text-[10px] text-[#8a7a6e]"><ShieldCheck size={13} />Datele sensibile din sursele procedurii au fost mascate înainte de analiză.</div>
      </>}
    </div>;
}
