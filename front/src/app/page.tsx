import Link from "next/link";
import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { SessionBanner } from "@/components/session-banner";
import { cases, procedures } from "@/lib/mock-data";
import {
  ArrowRight, ArrowUpRight, BookOpenCheck, CheckCircle2, Clock3,
  FileCheck2, FileText, Plus, ShieldCheck, Sparkles, UsersRound,
} from "lucide-react";

const metrics = [
  { label: "Proceduri aprobate", value: "24", change: "+3 săptămâna aceasta", icon: BookOpenCheck, tone: "green" },
  { label: "Ciorne de revizuit", value: "4", change: "Necesită validarea echipei", icon: FileCheck2, tone: "amber" },
  { label: "Timp recuperat", value: "18,5 h", change: "Estimat în ultimele 30 zile", icon: Clock3, tone: "blue" },
  { label: "Surse autorizate", value: "3", change: "Captura este momentan oprită", icon: ShieldCheck, tone: "violet" },
];

function MetricCard({ item }: { item: (typeof metrics)[number] }) {
  const Icon = item.icon;
  const iconStyle = item.tone === "green" ? "bg-[#fff0e7] text-[#e9560c]" : item.tone === "amber" ? "bg-[#fff2d9] text-[#b5812e]" : item.tone === "blue" ? "bg-[#e6eff9] text-[#5583b5]" : "bg-[#eeeafb] text-[#7c6cac]";
  return <div className="rounded-2xl border border-[#FF5A00] bg-[#E8D9CA] p-5 shadow-[0_4px_14px_rgba(61,35,19,.04)]">
    <div className="flex items-start justify-between"><div className="text-[11px] font-medium text-[#778881]">{item.label}</div><span className={`grid h-9 w-9 place-items-center rounded-xl ${iconStyle}`}><Icon size={17} strokeWidth={1.8} /></span></div>
    <div className="mt-4 text-[27px] font-semibold tracking-[-0.04em] text-[#2b1b12]">{item.value}</div>
    <div className="mt-1 text-[10px] text-[#92a099]">{item.change}</div>
  </div>;
}

export default function Home() {
  return <AppShell>
    <div className="space-y-7">
      <Suspense fallback={null}><SessionBanner /></Suspense>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><div className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#ff5a00]">SPAȚIU DEMONSTRATIV · MEMORIA ECHIPEI</div><h1 className="text-[27px] font-semibold tracking-[-0.045em] text-[#2a170e] sm:text-[32px]">Memoria echipei, la zi.</h1><p className="mt-2 max-w-[600px] text-[13px] leading-6 text-[#788881]">Rezolvările bune merită păstrate. Revizuiește ce a învățat Helpy și transformă experiența în proceduri utile.</p></div>
        <Link href="/review" className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-xl bg-[#ff5a00] px-4 text-[11px] font-semibold text-[#29170e] shadow-[0_5px_12px_rgba(255,90,0,.2)] transition hover:bg-[#e94c00] sm:self-auto">Revizuiește 4 cazuri <ArrowRight size={14} /></Link>
      </div>

      <section className="relative overflow-hidden rounded-2xl bg-[#ff5a00] p-6 text-[#28140a] sm:p-8">
        <div className="pointer-events-none absolute -right-12 -top-24 h-72 w-72 rounded-full border border-white/[0.08]" /><div className="pointer-events-none absolute -right-2 -top-14 h-52 w-52 rounded-full border border-white/[0.08]" />
        <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div className="max-w-[570px]"><div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#3b1a08]/20 bg-white/25 px-3 py-1.5 text-[10px] font-semibold text-[#481d08]"><Sparkles size={13} /> Memoria operațională a echipei</div><h2 className="text-[22px] font-semibold leading-tight tracking-[-0.03em] sm:text-[26px]">Patru rezolvări sunt gata<br className="hidden sm:block" /> să devină cunoștințe reutilizabile.</h2><p className="mt-3 max-w-[500px] text-[12px] leading-6 text-[#4a200b]">Verifică pașii și sursele. Nimic nu devine procedură oficială până nu este confirmat.</p></div>
          <div className="flex shrink-0 items-center gap-4 rounded-2xl border border-[#371807]/15 bg-white/85 p-4 md:min-w-[220px]"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#fff0e7] text-[#a33c00]"><FileCheck2 size={21} /></div><div><div className="text-[26px] font-semibold tracking-tight">4</div><div className="text-[10px] text-[#60300f]">ciorne de validat</div></div><Link href="/review" aria-label="Deschide revizuirea" className="ml-auto grid h-8 w-8 place-items-center rounded-full bg-[#2a160d]/[0.08] text-[#44200e] hover:bg-[#2a160d]/[0.14]"><ArrowUpRight size={16} /></Link></div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map((item) => <MetricCard key={item.label} item={item} />)}</section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(290px,.85fr)]">
        <section className="overflow-hidden rounded-2xl border border-[#FF5A00] bg-[#E8D9CA] shadow-[0_4px_14px_rgba(61,35,19,.04)]">
          <div className="flex items-center justify-between border-b border-[#DDCABB] px-5 py-4 sm:px-6"><div><h2 className="text-[14px] font-semibold text-[#2b1b12]">Cazuri care așteaptă</h2><p className="mt-1 text-[10px] text-[#8a9992]">Rezolvări recente identificate în sursele aprobate</p></div><Link href="/review" className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#f45b12] hover:text-[#c94100]">Vezi toate <ArrowRight size={13} /></Link></div>
          <div className="divide-y divide-[#E0CEBF]">
            {cases.slice(0, 3).map((item, index) => <Link href="/review" key={item.id} className="group flex items-center gap-3 px-5 py-4 transition hover:bg-[#F0E3D6] sm:gap-4 sm:px-6">
              <div className={`hidden h-10 w-10 shrink-0 place-items-center rounded-xl sm:grid ${index === 0 ? "bg-[#fff2db] text-[#a9792e]" : index === 1 ? "bg-[#e5f1f7] text-[#5781a1]" : "bg-[#eeeafa] text-[#7565a4]"}`}><FileText size={17} /></div>
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="truncate text-[12px] font-semibold text-[#342318] group-hover:text-[#ed5100]">{item.title}</span><span className="rounded-md bg-[#EFE0D2] px-1.5 py-0.5 font-mono text-[9px] text-[#87958f]">{item.id}</span></div><div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] text-[#8b9992]"><span>{item.area}</span><span className="h-1 w-1 rounded-full bg-[#c3cec8]"/><span>{item.source}</span><span className="h-1 w-1 rounded-full bg-[#c3cec8]"/><span>{item.updated}</span></div></div>
              <div className="hidden shrink-0 items-center gap-1.5 text-[10px] text-[#75867e] md:flex"><span className={`h-1.5 w-1.5 rounded-full ${item.evidenceLevel === "puternică" ? "bg-[#55a77e]" : "bg-[#d2a354]"}`} />{item.evidence}</div>
              <ArrowUpRight size={15} className="shrink-0 text-[#a9b5af] transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[#f45b12]" />
            </Link>)}
          </div>
          <Link href="/review" className="flex items-center justify-center gap-2 border-t border-[#DDCABB] py-3.5 text-[10px] font-semibold text-[#71827a] hover:bg-[#F0E3D6] hover:text-[#f05b13]"><Plus size={14} /> Deschide coada de revizuire</Link>
        </section>

        <section className="rounded-2xl border border-[#FF5A00] bg-[#E8D9CA] p-5 shadow-[0_4px_14px_rgba(61,35,19,.04)] sm:p-6">
          <div className="flex items-start justify-between"><div><h2 className="text-[14px] font-semibold text-[#2b1b12]">Proceduri actualizate</h2><p className="mt-1 text-[10px] text-[#8a9992]">Cunoștințe verificate recent</p></div><div className="grid h-8 w-8 place-items-center rounded-lg bg-[#fff0e7] text-[#e75816]"><CheckCircle2 size={16} /></div></div>
          <div className="mt-5 space-y-4">{procedures.slice(0, 3).map((procedure) => <Link href="/procedures" key={procedure.id} className="group flex gap-3"><div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#fff6f0] text-[#e3581c]"><BookOpenCheck size={15} /></div><div className="min-w-0 flex-1"><div className="line-clamp-2 text-[11px] font-semibold leading-[1.45] text-[#443026] group-hover:text-[#e64b00]">{procedure.title}</div><div className="mt-1.5 flex items-center gap-2 text-[9px] text-[#8c9b94]"><span>{procedure.category}</span><span className="h-1 w-1 rounded-full bg-[#c2cec7]"/><span>{procedure.updated}</span></div></div><ArrowUpRight size={13} className="mt-1 shrink-0 text-[#b1bdb6] group-hover:text-[#ff6a19]" /></Link>)}</div>
          <Link href="/procedures" className="mt-5 flex items-center justify-center gap-1.5 rounded-xl border border-[#FF5A00] py-2.5 text-[10px] font-semibold text-[#60746b] hover:border-[#c8ddd1] hover:bg-[#fff9f6]">Toate procedurile <ArrowRight size={13} /></Link>
        </section>
      </div>

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#FF5A00] bg-[#E8D9CA] p-5 shadow-[0_4px_14px_rgba(61,35,19,.04)] sm:p-6"><div className="flex items-center justify-between"><div><h2 className="text-[13px] font-semibold text-[#2b1b12]">Activitate în ultimele 7 zile</h2><p className="mt-1 text-[10px] text-[#8a9992]">Cazuri transformate în proceduri</p></div><span className="rounded-lg bg-[#fff8f4] px-2 py-1 text-[9px] text-[#798a82]">7 zile</span></div><div className="mt-5 flex h-[102px] items-end gap-2 border-b border-[#E4D3C4] px-1">{[{d:"L",h:36},{d:"Ma",h:52},{d:"Mi",h:44},{d:"J",h:70},{d:"V",h:56},{d:"S",h:28},{d:"D",h:19}].map((bar,index)=><div key={bar.d} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><div className={`w-full max-w-[31px] rounded-t-md ${index===3?"bg-[#ff6817]":"bg-[#ffc39f]"}`} style={{height:`${bar.h}%`}}/><span className="pb-1 text-[9px] text-[#9ba9a2]">{bar.d}</span></div>)}</div></div>
        <div className="flex items-center gap-4 rounded-2xl border border-[#FF5A00] bg-[#E8D9CA] p-5 sm:p-6"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#E8D9CA] text-[#e85a1b] shadow-sm"><UsersRound size={19} /></div><div className="flex-1"><div className="text-[12px] font-semibold text-[#3c271b]">Cunoștințele sunt ale echipei.</div><p className="mt-1 text-[10px] leading-5 text-[#71877b]">Fiecare procedură păstrează sursele și trece prin verificare umană înainte de publicare.</p></div><Link href="/settings/privacy" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#E8D9CA] text-[#618273] hover:text-[#dd4b00]" aria-label="Setări de confidențialitate"><ArrowUpRight size={15} /></Link></div>
      </section>
    </div>
  </AppShell>;
}