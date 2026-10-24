"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Radio } from "lucide-react";

// The capture extension opens the dashboard as /?sessionId=…; point that session at the review flow.
export function SessionBanner() {
  const sessionId = useSearchParams().get("sessionId");
  if (!sessionId) return null;
  return <Link href={`/review?sessionId=${encodeURIComponent(sessionId)}`} className="flex items-center gap-3 rounded-2xl border border-[#FF5A00] bg-[#fff6f0] px-4 py-3.5 transition hover:bg-[#fff0e7]">
    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#fff0e7] text-[#c95418]"><Radio size={15} /></div>
    <div className="min-w-0 flex-1"><div className="text-[11px] font-semibold text-[#443026]">Sesiune capturată din extensie</div><div className="mt-0.5 truncate font-mono text-[9px] text-[#8c9a93]">{sessionId}</div></div>
    <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold text-[#db4b00]">Generează ciorna <ArrowRight size={13} /></span>
  </Link>;
}
