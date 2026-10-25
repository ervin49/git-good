"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, BadgeCheck, CircleAlert, Loader2 } from "lucide-react";
import { approveProcedure, type ApprovedProcedure, type ProcedureDraft } from "@/lib/api";
import { PROCEDURES_CHANGED } from "@/lib/use-approved-procedures";

const REVIEWER_KEY = "helpy-reviewer";

function savedReviewer() {
  try { return window.localStorage.getItem(REVIEWER_KEY) ?? ""; } catch { return ""; }
}

// Lets a person approve an AI draft: pick the steps to keep, sign with a name; the kept steps
// become "Confirmat" and the procedure goes into the library.
export function ApprovalBox({ draft, sourceType, sourceId, groundingScore }: {
  draft: ProcedureDraft;
  sourceType: ApprovedProcedure["source_type"];
  sourceId: string;
  groundingScore: number | null;
}) {
  const [keep, setKeep] = useState<number[]>(() => draft.steps.map((step, index) => step.order || index + 1));
  const [reviewer, setReviewer] = useState(() => (typeof window === "undefined" ? "" : savedReviewer()) || "Alex Marin");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [approved, setApproved] = useState<ApprovedProcedure | null>(null);

  if (draft.steps.length === 0) return null;

  if (approved) {
    return <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#bfe0c9] bg-[#eef8f1] px-4 py-3">
      <div className="flex items-center gap-2 text-[11px] font-semibold text-[#2f6b45]"><BadgeCheck size={16} />Procedură aprobată de {approved.approved_by} · {approved.steps.length} pași confirmați</div>
      <Link href={`/procedures/${approved.id}`} className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#2f6b45] hover:underline">Vezi în bibliotecă <ArrowRight size={12} /></Link>
    </div>;
  }

  const toggle = (order: number) => setKeep((current) => current.includes(order) ? current.filter((o) => o !== order) : [...current, order]);

  const approve = async () => {
    setSaving(true);
    setError("");
    try {
      try { window.localStorage.setItem(REVIEWER_KEY, reviewer.trim()); } catch { /* storage blocked */ }
      setApproved(await approveProcedure({ draft, sourceType, sourceId, approvedBy: reviewer.trim(), keepOrders: keep, groundingScore }));
      window.dispatchEvent(new Event(PROCEDURES_CHANGED));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Aprobarea a eșuat.");
    }
    setSaving(false);
  };

  return <div className="mt-5 rounded-xl border border-[#FF5A00] bg-[#fff6f0] p-4">
    <div className="flex items-center gap-2 text-[12px] font-semibold text-[#2b1b12]"><BadgeCheck size={15} className="text-[#d6500c]" />Aprobare</div>
    <p className="mt-1 text-[10px] leading-4 text-[#7d6a5c]">Bifează pașii corecți. La aprobare devin „Confirmat”, cu numele tău, iar procedura intră în bibliotecă și în căutare.</p>
    <ul className="mt-3 space-y-1.5">
      {draft.steps.map((step, index) => {
        const order = step.order || index + 1;
        return <li key={order}>
          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-1.5 text-[10px] leading-5 text-[#443026] hover:bg-[#F3E7DB]">
            <input type="checkbox" checked={keep.includes(order)} onChange={() => toggle(order)} className="mt-1 accent-[#ff5a00]" />
            <span><span className="font-semibold">{order}.</span> {step.instruction}</span>
          </label>
        </li>;
      })}
    </ul>
    <div className="mt-3 flex flex-col gap-2 text-[10px] sm:flex-row sm:items-center">
      <label className="flex flex-1 items-center gap-2 rounded-xl border border-[#D6C1AD] bg-[#F0E3D6] px-3 py-2 text-[#5b4637]">
        <span className="shrink-0 font-semibold">Aprobat de</span>
        <input value={reviewer} onChange={(e) => setReviewer(e.target.value)} placeholder="Numele tău" className="min-w-0 flex-1 bg-transparent text-[#2b1b12] outline-none" />
      </label>
      <button onClick={approve} disabled={saving || keep.length === 0 || !reviewer.trim()} className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-[#ff5a00] px-4 font-semibold text-[#29170e] hover:bg-[#e94c00] disabled:opacity-50">
        {saving ? <Loader2 size={13} className="animate-spin" /> : <BadgeCheck size={13} />}{saving ? "Se aprobă…" : `Aprobă procedura (${keep.length} pași)`}
      </button>
    </div>
    {error && <div className="mt-2 flex items-start gap-2 text-[10px] text-[#a43a12]"><CircleAlert size={13} className="mt-0.5 shrink-0" />{error}</div>}
  </div>;
}
