"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { addDomain as saveDomain, listDomains, removeDomain as deleteDomain } from "@/lib/api";
import { Check, ChevronDown, CircleHelp, Globe2, LockKeyhole, Plus, Save, ShieldCheck, Trash2 } from "lucide-react";

type ToggleProps = { title: string; description: string; checked: boolean; onChange: () => void };
function Toggle({ title, description, checked, onChange }: ToggleProps) {
  return <div className="flex items-center justify-between gap-5 py-4"><div><div className="text-[11px] font-semibold text-[#443026]">{title}</div><p className="mt-1 max-w-[560px] text-[9px] leading-5 text-[#87968e]">{description}</p></div><button role="switch" aria-checked={checked} onClick={onChange} className={`relative h-[22px] w-10 shrink-0 rounded-full transition ${checked?"bg-[#ff5a00]":"bg-[#cbd5cf]"}`}><span className={`absolute top-[3px] h-4 w-4 rounded-full bg-[#E8D9CA] shadow-sm transition ${checked?"left-[21px]":"left-[3px]"}`}/></button></div>;
}

export default function PrivacySettingsPage() {
  const [capture, setCapture] = useState(false);
  const [mask, setMask] = useState(true);
  const [requireTicket, setRequireTicket] = useState(true);
  const [teams, setTeams] = useState(true);
  const [erp, setErp] = useState(true);
  const [saved, setSaved] = useState(false);
  const [domains, setDomains] = useState<string[]>([]);
  const [domainInput, setDomainInput] = useState("");
  const [domainError, setDomainError] = useState<string | null>(null);
  const [domainBusy, setDomainBusy] = useState(false);

  // The allowlist lives in the backend database; validation happens there too.
  useEffect(() => {
    listDomains().then((list) => setDomains(list.map((d) => d.domain)), (error: Error) => setDomainError(error.message));
  }, []);
  const removeDomain = async (domain: string) => {
    try {
      setDomains((await deleteDomain(domain)).map((d) => d.domain));
      setDomainError(null);
    } catch (error) {
      setDomainError(error instanceof Error ? error.message : "Ștergerea a eșuat.");
    }
  };
  const addDomain = async () => {
    if (!domainInput.trim() || domainBusy) return;
    setDomainBusy(true);
    try {
      setDomains((await saveDomain(domainInput)).map((d) => d.domain));
      setDomainInput("");
      setDomainError(null);
    } catch (error) {
      setDomainError(error instanceof Error ? error.message : "Salvarea a eșuat.");
    } finally {
      setDomainBusy(false);
    }
  };

  return <AppShell>
    <div className="mx-auto max-w-[1050px] space-y-7">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#ff5a00]">ADMINISTRARE · CONTROLUL COLECTĂRII</div><h1 className="text-[27px] font-semibold tracking-[-0.045em] text-[#2a170e] sm:text-[32px]">Surse și confidențialitate</h1><p className="mt-2 max-w-[640px] text-[13px] leading-6 text-[#788881]">Alege ce poate folosi Helpy. Captura este limitată la surse aprobate și sesiuni explicite.</p></div><button onClick={()=>{setSaved(true);window.setTimeout(()=>setSaved(false),2500)}} className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-xl bg-[#ff5a00] px-4 text-[10px] font-semibold text-[#29170e] shadow-sm transition hover:bg-[#e94c00] sm:self-auto"><Save size={13}/>{saved?"Setări salvate":"Salvează setările"}</button></div>
      <div className="flex items-start gap-3 rounded-2xl border border-[#f6d3bd] bg-[#fff6f0] p-4"><div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#E8D9CA] text-[#e35a18]"><ShieldCheck size={15}/></div><div><div className="text-[10px] font-semibold text-[#3c674b]">Datele sunt filtrate înainte de procesare.</div><p className="mt-1 text-[9px] leading-5 text-[#708976]">În această interfață demo, setările se schimbă local. Integrarea reală va aplica allowlist-ul și mascarea în agent/conector înainte de upload.</p></div></div>

      <section className="overflow-hidden rounded-2xl border border-[#FF5A00] bg-[#E8D9CA] shadow-[0_4px_14px_rgba(61,35,19,.04)]"><div className="border-b border-[#DDCABB] px-5 py-4 sm:px-6"><div className="flex items-center gap-2"><Globe2 size={15} className="text-[#c95418]"/><h2 className="text-[13px] font-semibold text-[#302016]">Surse permise</h2></div><p className="mt-1 pl-6 text-[9px] text-[#8c9a93]">Helpy ignoră orice domeniu sau canal care nu este activat aici.</p></div>
        <div className="divide-y divide-[#E0CEBF] px-5 sm:px-6"><div className="flex items-center justify-between gap-4 py-4"><div className="flex items-center gap-3"><div className="grid h-8 w-8 place-items-center rounded-lg bg-[#fff5ef] text-[#c95418]"><span className="text-[11px] font-bold">T</span></div><div><div className="text-[10px] font-semibold text-[#4a3324]">Microsoft Teams</div><div className="mt-1 text-[9px] text-[#8c9a93]">Echipa Atelier Nord · canal #financiar-ops</div></div></div><button role="switch" aria-label="Permite Microsoft Teams" aria-checked={teams} onClick={()=>setTeams(!teams)} className={`relative h-[22px] w-10 rounded-full transition ${teams?"bg-[#ff5a00]":"bg-[#cbd5cf]"}`}><span className={`absolute top-[3px] h-4 w-4 rounded-full bg-[#E8D9CA] shadow-sm transition ${teams?"left-[21px]":"left-[3px]"}`}/></button></div>
          <div className="flex items-center justify-between gap-4 py-4"><div className="flex items-center gap-3"><div className="grid h-8 w-8 place-items-center rounded-lg bg-[#fff5ef] text-[#c95418]"><Globe2 size={14}/></div><div><div className="text-[10px] font-semibold text-[#4a3324]">Aplicații web aprobate</div><div className="mt-1 text-[9px] text-[#8c9a93]">Captură doar în lista de domenii de mai jos</div></div></div><button role="switch" aria-label="Permite aplicațiile web" aria-checked={erp} onClick={()=>setErp(!erp)} className={`relative h-[22px] w-10 rounded-full transition ${erp?"bg-[#ff5a00]":"bg-[#cbd5cf]"}`}><span className={`absolute top-[3px] h-4 w-4 rounded-full bg-[#E8D9CA] shadow-sm transition ${erp?"left-[21px]":"left-[3px]"}`}/></button></div>
          <div className="py-4"><div className="mb-3 text-[10px] font-semibold text-[#50645a]">Allowlist de domenii</div><form onSubmit={(event)=>{event.preventDefault();void addDomain()}} className="mb-3 flex gap-2"><input value={domainInput} onChange={(event)=>{setDomainInput(event.target.value);setDomainError(null)}} placeholder="ex.: app.firma.ro" aria-label="Domeniu nou" className="h-8 min-w-0 flex-1 rounded-lg border border-[#D5C0AC] bg-[#F0E3D6] px-2.5 font-mono text-[10px] text-[#443026] outline-none placeholder:text-[#a2aea8] focus:border-[#ff9a63]"/><button type="submit" disabled={!domainInput.trim()||domainBusy} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[#D9C3AF] px-2.5 py-1.5 text-[9px] font-semibold text-[#c84e13] hover:bg-[#fff9f6] disabled:opacity-50"><Plus size={12}/>Adaugă domeniu</button></form>{domainError&&<p className="-mt-1 mb-3 text-[9px] text-[#a45e55]">{domainError}</p>}<div className="flex flex-wrap gap-2">{domains.length===0&&<span className="text-[9px] text-[#8c9a93]">Niciun domeniu salvat încă.</span>}{domains.map((domain)=><span key={domain} className="inline-flex items-center gap-2 rounded-lg border border-[#D5C0AC] bg-[#F0E3D6] px-2.5 py-2 font-mono text-[9px] text-[#657970]"><span className="h-1.5 w-1.5 rounded-full bg-[#63a67c]"/>{domain}<button aria-label={`Elimină ${domain}`} onClick={()=>void removeDomain(domain)} className="ml-1 rounded p-0.5 text-[#9aa8a0] hover:bg-[#F1E4D8] hover:text-[#a45e55]"><Trash2 size={11}/></button></span>)}</div></div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#FF5A00] bg-[#E8D9CA] shadow-[0_4px_14px_rgba(61,35,19,.04)]"><div className="border-b border-[#DDCABB] px-5 py-4 sm:px-6"><div className="flex items-center gap-2"><LockKeyhole size={15} className="text-[#71816f]"/><h2 className="text-[13px] font-semibold text-[#302016]">Reguli de captură</h2></div><p className="mt-1 pl-6 text-[9px] text-[#8c9a93]">Minimizăm datele și le colectăm numai când există un scop clar.</p></div><div className="divide-y divide-[#E0CEBF] px-5 sm:px-6"><Toggle title="Sesiune de captură pornită" description="Angajatul pornește și oprește sesiunea. Un indicator vizibil arată când captura este activă." checked={capture} onChange={()=>setCapture(!capture)}/><Toggle title="Mascare locală înainte de upload" description="Ascunde parolele, token-urile și câmpurile sensibile detectate înainte ca datele să părăsească browserul." checked={mask} onChange={()=>setMask(!mask)}/><Toggle title="Asociază sesiunea cu un tichet" description="Cere un ID de caz sau tichet pentru a lega pașii capturați de o problemă concretă." checked={requireTicket} onChange={()=>setRequireTicket(!requireTicket)}/></div></section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2"><div className="rounded-2xl border border-[#FF5A00] bg-[#E8D9CA] p-5"><div className="text-[11px] font-semibold text-[#443026]">Retenție demonstrativă</div><p className="mt-1 text-[9px] leading-5 text-[#89978f]">Perioada de păstrare pentru evenimentele brute înainte de ștergere sau agregare.</p><button className="mt-4 flex h-9 w-full items-center justify-between rounded-xl border border-[#D9C3AF] bg-[#F0E3D6] px-3 text-[10px] text-[#586e62]">30 de zile <ChevronDown size={13}/></button></div><div className="rounded-2xl border border-[#FF5A00] bg-[#E8D9CA] p-5"><div className="text-[11px] font-semibold text-[#443026]">Excluderi explicite</div><p className="mt-1 text-[9px] leading-5 text-[#89978f]">Aplicațiile personale și paginile care conțin autentificare nu sunt capturate.</p><div className="mt-4 flex items-center gap-2 rounded-xl bg-[#fff8f4] px-3 py-2.5 text-[9px] text-[#6e8076]"><Check size={12} className="text-[#e35a18]"/>Parole și token-uri mascate</div></div></section>

      <div className="flex items-center gap-2 text-[9px] text-[#8e9c95]"><CircleHelp size={13}/>Aceste controale sunt vizuale în prototip. Regulile reale se vor salva și aplica prin backend/conector.</div>
    </div>
  </AppShell>;
}