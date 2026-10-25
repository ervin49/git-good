"use client";

import { useEffect, useState } from "react";
import { listApprovedProcedures, type ApprovedProcedure } from "@/lib/api";

// Shape shared with the demo procedures in mock-data, so the library and search list both.
export type LibraryProcedure = {
  id: string;
  title: string;
  category: string;
  context: string;
  status: string;
  updated: string;
  sources: number;
  confidence: number;
  href: string;
};

const SOURCE_LABEL: Record<ApprovedProcedure["source_type"], string> = { capture: "Captură din browser", meeting: "Ședință Fireflies", teams: "Conversație Teams" };

export function toLibraryItem(p: ApprovedProcedure): LibraryProcedure {
  const source = SOURCE_LABEL[p.source_type] ?? "Captură";
  return {
    id: p.id,
    title: p.title,
    category: p.ticket_id ?? "Fără tichet",
    context: `${source} · aprobată de ${p.approved_by}`,
    status: "Aprobată",
    updated: new Date(p.approved_at).toLocaleDateString("ro-RO", { day: "numeric", month: "short" }),
    sources: new Set(p.steps.flatMap((s) => s.evidence_seq)).size,
    confidence: p.grounding_score ?? 100,
    href: `/procedures/${p.id}`,
  };
}

// Procedures a person approved in Helpy (from the backend); empty while loading or offline.
export function useApprovedProcedures(): LibraryProcedure[] {
  const [items, setItems] = useState<LibraryProcedure[]>([]);
  useEffect(() => {
    let cancelled = false;
    listApprovedProcedures().then(
      (list) => { if (!cancelled) setItems(list.map(toLibraryItem)); },
      () => { /* backend offline: show only the demo procedures */ },
    );
    return () => { cancelled = true; };
  }, []);
  return items;
}
