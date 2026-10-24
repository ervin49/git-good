"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { procedures } from "@/lib/mock-data";
import { ArrowRight, ArrowUpRight, BookOpenCheck, FileText, MessageSquareText, Search, ShieldCheck, Sparkles } from "lucide-react";

const suggestions = ["Cum rezolv eroarea de serie la facturi?", "Cum deblochez o comandă în procesare?", "Cum reînnoiesc accesul la mediul de test?"];
const sources = [
  { title: "Confirmarea soluției", type: "Teams · #financiar-ops", time: "10:20 · FAC-1042", icon: MessageSquareText },
  { title: "Procedură verificată de echipa financiară", type: "Procedură · PR-018", time: "Actualizată astăzi", icon: BookOpenCheck },
  { title: "Pașii de activare a seriei", type: "Notițe meeting · Financiar", time: "21 oct. 2026", icon: FileText },
];

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const results = useMemo(() => {
    if (!query.trim()) return procedures.slice(0, 3);
    const words = query.toLowerCase().split(/\s+/).filter((word) => word.length > 2);
    const ranked = procedures.map((procedure) => ({ procedure, score: words.filter((word) => `${procedure.title} ${procedure.category} ${procedure.context}`.toLowerCase().includes(word)).length })).filter((item) => item.score > 0).sort((a,b)=>b.score-a.score).map((item)=>item.procedure);
    return ranked;
  }, [query]);
  const runSearch = (value = query) => { setQuery(value); setSubmitted(true); };

  return <AppShell>
    <div className="mx-auto max-w-[920px] space-y-7">
      <div className="pt-1 text-center"><div className="mx-auto mb-4 grid h-11 w-11 place-items-center rounded-2xl bg-[#e4f2e9] text-[#e95612]"><Search size={20}/></div><div className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#ff5a00]">CAUTĂ ÎN CUNOȘTINȚELE ECHIPEI</div><h1 className="text-[27px] font-semibold tracking-[-0.045em] text-[#2a170e] sm:text-[32px]">Cu ce te putem ajuta?</h1><p className="mt-2 text-[12px] leading-6 text-[#788881]">Întreabă în cuvintele tale. Helpy îți arată pașii și sursele care îi susțin.</p></div>
      <form onSubmit={(event)=>{event.preventDefault();runSearch()}} className="flex items-center gap-3 rounded-2xl border border-[#dce8e1] bg-[#E8D9CA] p-2 pl-4 shadow-[0_8px_28px_rgba(61,35,19,.08)] focus-within:border-[#ff9a63] focus-within:ring-4 focus-within:ring-[#ffe0ce]"><Search size={18} className="shrink-0 text-[#719082]"/><input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Ex.: Cum rezolv eroarea de serie la facturi?" className="h-10 min-w-0 flex-1 bg-transparent text-[12px] text-[#443026] outline-none placeholder:text-[#a2aea8]"/><button type="submit" className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-[#ff5a00] px-4 text-[10px] font-semibold text-[#29170e] transition hover:bg-[#e94c00]">Caută <ArrowRight size={13}/></button></form>
      {!submitted&&<div className="flex flex-wrap items-center justify-center gap-2"><span className="mr-1 text-[9px] text-[#929f98]">Încearcă:</span>{suggestions.map((suggestion)=><button key={suggestion} onClick={()=>runSearch(suggestion)} className="rounded-full border border-[#D6C1AD] bg-[#E8D9CA] px-3 py-2 text-[9px] text-[#6d8076] transition hover:border-[#c6ddce] hover:text-[#e95000]">{suggestion}</button>)}</div>}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(260px,.75fr)]">
        <section className="overflow-hidden rounded-2xl border border-[#FF5A00] bg-[#E8D9CA] shadow-[0_4px_14px_rgba(61,35,19,.04)]"><div className="flex items-center justify-between border-b border-[#DDCABB] px-5 py-4"><div><h2 className="text-[13px] font-semibold text-[#302016]">{submitted?`Rezultate pentru „${query}”`:"Sugestii de proceduri"}</h2><p className="mt-1 text-[9px] text-[#8c9a93]">Potrivite după task, context și surse aprobate</p></div><span className="inline-flex items-center gap-1 text-[9px] text-[#65816f]"><Sparkles size={11}/> Căutare semantică</span></div>
          <div className="divide-y divide-[#E0CEBF]">{results.map((item,index)=><Link href="/procedures" key={item.id} className="group block px-5 py-4 transition hover:bg-[#F0E3D6]"><div className="flex items-start gap-3"><div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#fff3eb] text-[#e85a1b]"><BookOpenCheck size={16}/></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-[11px] font-semibold text-[#2b4338] group-hover:text-[#ff5a00]">{item.title}</h3><span className="rounded-full bg-[#fff0e7] px-2 py-0.5 text-[8px] font-semibold text-[#d94c0b]">Aprobată</span></div><p className="mt-1.5 text-[10px] leading-5 text-[#788a80]">Verifică seria asociată punctului de lucru, apoi reîncearcă emiterea. Dacă problema persistă, urmează pasul de escaladare.</p><div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-[#96a29b]"><span>{item.context}</span><span className="h-1 w-1 rounded-full bg-[#c5d0ca]"/><span>{item.sources} surse</span><span className="h-1 w-1 rounded-full bg-[#c5d0ca]"/><span className="inline-flex items-center gap-1 text-[#c95418]"><ShieldCheck size={10}/>{item.confidence}% confirmată</span></div></div><ArrowUpRight size={14} className="mt-1 shrink-0 text-[#aab6af] group-hover:text-[#f05b13]"/></div></Link>)}
          {results.length===0&&<div className="px-6 py-12 text-center"><div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-[#E8D9CA] text-[#89978f]"><Search size={17}/></div><p className="mt-3 text-[11px] font-semibold text-[#53685d]">Nu am găsit o potrivire sigură.</p><p className="mt-1 text-[10px] text-[#89978f]">Încearcă altă formulare sau cere ajutorul echipei.</p></div>}</div>
          {results.length>0&&<div className="border-t border-[#DDCABB] px-5 py-3 text-[9px] text-[#97a49c]">Rezultatele din acest prototip folosesc date demonstrative.</div>}
        </section>
        <aside className="space-y-5"><section className="rounded-2xl border border-[#FF5A00] bg-[#E8D9CA] p-5 shadow-[0_4px_14px_rgba(61,35,19,.04)]"><div className="flex items-start justify-between"><div><h2 className="text-[12px] font-semibold text-[#302016]">Surse relevante</h2><p className="mt-1 text-[9px] text-[#8c9a93]">Proveniența răspunsurilor</p></div><ShieldCheck size={15} className="text-[#c95418]"/></div><div className="mt-4 space-y-3">{sources.map((source)=><div key={source.title} className="flex gap-2.5"><div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#fff6f0] text-[#c95418]"><source.icon size={13}/></div><div className="min-w-0"><div className="truncate text-[9px] font-semibold text-[#52665c]">{source.title}</div><div className="mt-1 text-[8px] text-[#96a29b]">{source.type} · {source.time}</div></div></div>)}</div><Link href="/review" className="mt-4 inline-flex items-center gap-1 text-[9px] font-semibold text-[#db4b00] hover:text-[#1f6146]">Vezi un exemplu de revizuire <ArrowUpRight size={11}/></Link></section>
          <section className="rounded-2xl border border-[#FF5A00] bg-[#E8D9CA] p-5"><div className="flex items-center gap-2 text-[10px] font-semibold text-[#3a624a]"><ShieldCheck size={14}/> Răspunsuri cu surse</div><p className="mt-2 text-[9px] leading-5 text-[#6b8573]">Helpy răspunde din procedurile aprobate și îți arată sursele folosite. Dacă informația nu este suficientă, îți spune.</p></section>
        </aside>
      </div>
    </div>
  </AppShell>;
}