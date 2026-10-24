"use client";

import Link from "next/link";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ArrowLeft, ArrowUpRight, Check, CheckCheck, CircleAlert, CircleCheck, Edit3, FileText, MessageSquareText, MoreHorizontal, ShieldCheck, Sparkles, X, XCircle } from "lucide-react";

interface ReviewStep {
  text: string;
  state: string;
  tone: string;
  source: string;
}
interface TeamsMessage {
  author: string;
  time: string;
  text: string;
}
const initialSteps: ReviewStep[] = [
  { text: "Deschide configurația pentru punctul de lucru relevant.", state: "Deducție AI", tone: "violet", source: "Context dedus din conversație" },
  { text: "Verifică dacă seria de facturare este activă.", state: "Observat", tone: "blue", source: "Teams · mesajul de la 10:16" },
  { text: "Dacă seria este inactivă, activeaz-o conform regulilor financiare.", state: "Neconfirmat", tone: "amber", source: "Necesită verificarea responsabilului financiar" },
  { text: "Reîncearcă emiterea și confirmă că factura a fost generată.", state: "Confirmat", tone: "green", source: "Teams · confirmare de la 10:20" },
  { text: "Dacă eroarea persistă, escaladează cazul către echipa financiară.", state: "Observat", tone: "blue", source: "Notițe meeting · 21 octombrie" },
];
const initialMessages: TeamsMessage[] = [
  { author: "Ana", time: "10:14", text: "Nu pot emite factura. Sistemul afișează eroarea de serie." },
  { author: "Mihai", time: "10:16", text: "Verifică dacă seria de facturare este activă pentru punctul de lucru." },
  { author: "Ana", time: "10:20", text: "Asta era problema. Am activat seria și acum factura se emite." },
];
const initialTranscript = initialMessages.map((message) => message.time + " " + message.author + ": " + message.text).join("\n");
function parseTeamsTranscript(transcript: string): TeamsMessage[] {
  return transcript.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line, index) => {
    const match = line.match(/^(?:(\d{1,2}:\d{2})\s+)?([^:]{1,60}):\s*(.+)$/);
    return match
      ? { time: match[1] ?? String(index + 1), author: match[2].trim(), text: match[3].trim() }
      : { time: String(index + 1), author: "Participant", text: line };
  });
}

function StatePill({ state, tone }: { state: string; tone: string }) {
  const styles: Record<string, string> = { violet: "bg-[#f0edfa] text-[#7263a5]", blue: "bg-[#eaf2f8] text-[#567c9d]", amber: "bg-[#fff4df] text-[#a67a35]", green: "bg-[#fff0e7] text-[#d85514]" };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-semibold ${styles[tone]}`}><span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />{state}</span>;
}

export default function ReviewPage() {
  const [confirmed, setConfirmed] = useState(false);
  const [reviewAnswer, setReviewAnswer] = useState<"yes" | "no" | "unsure" | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [teamsImportOpen, setTeamsImportOpen] = useState(false);
  const [transcript, setTranscript] = useState(initialTranscript);
  const [teamsMessages, setTeamsMessages] = useState(initialMessages);
  const [steps, setSteps] = useState(initialSteps);
  const [outcomeText, setOutcomeText] = useState(initialMessages[2].text);
  const [caseTitle, setCaseTitle] = useState("Factura nu se emite — eroare de serie");
  const [caseId, setCaseId] = useState("FAC-1042");
  const [editing, setEditing] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [toast, setToast] = useState("");
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2800); };
  const analyzeTeamsTranscript = () => {
    const parsed = parseTeamsTranscript(transcript);
    if (parsed.length === 0) {
      notify("Lipește cel puțin un mesaj înainte de analiză.");
      return;
    }
    const actions = parsed.filter((message) => /(verifică|verifica|activează|activeaza|reîncearcă|reincearca|apasă|apasa|deschide|selectează|selecteaza|introdu|escaladează|escaladeaza)/i.test(message.text));
    const result = parsed.find((message) =>
      !/(nu am reușit|nu am reusit|nu am activat|nu am emis|nu .*?(emite|merge|funcționează|functioneaza|rezolvat)|încă nu|inca nu|persistă|persista)/i.test(message.text) &&
      /(am reușit|am reusit|am activat|am emis|am rezolvat|factura se emite|acum (se emite|merge|funcționează|functioneaza)|s-a rezolvat|este rezolvat)/i.test(message.text)
    );
    const sourceFor = (message: TeamsMessage) => "Teams · " + message.author + (message.time ? " · " + message.time : "");
    const generatedSteps: ReviewStep[] = actions.map((message) => ({
      text: message.text,
      state: "Observat",
      tone: "blue",
      source: sourceFor(message)
    }));
    if (generatedSteps.length === 0) {
      generatedSteps.push({
        text: "Conversația nu conține un pas de acțiune explicit; verifică mesajele înainte de publicare.",
        state: "Neconfirmat",
        tone: "amber",
        source: "Analiză demo · fără instrucțiuni explicite"
      });
    }
    if (result) {
      generatedSteps.push({
        text: "Rezultat raportat: " + result.text,
        state: "Confirmat",
        tone: "green",
        source: sourceFor(result)
      });
      setOutcomeText(result.text);
    } else {
      setOutcomeText("Nu am găsit o confirmare explicită a rezultatului în mesajele importate.");
      generatedSteps.push({
        text: "Cere solicitantului să confirme dacă problema s-a rezolvat.",
        state: "Neconfirmat",
        tone: "amber",
        source: "Nu există un mesaj explicit de confirmare"
      });
    }
    setTeamsMessages(parsed);
    setSteps(generatedSteps);
    setCaseTitle("Procedură din conversația Teams");
    setCaseId("DEMO-TEAMS");
    setReviewAnswer(null);
    setConfirmed(false);
    setTeamsImportOpen(false);
    notify("Analiză demo: " + parsed.length + " mesaje parcurse. Nu s-a conectat la Teams.");
  };
  const submitConfirmation = (answer: "yes" | "no" | "unsure") => {
    setReviewAnswer(answer);
    setConfirmed(answer === "yes");
    setConfirmDialogOpen(false);
    notify(answer === "yes"
      ? "Rezultatul a fost confirmat de tine în această sesiune demo."
      : answer === "no"
        ? "Rezultatul a rămas neconfirmat."
        : "Ai ales să lași rezultatul neconfirmat.");
  };

  return <AppShell>
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-[10px] text-[#8a9992]"><Link href="/" className="hover:text-[#e95200]">Prezentare generală</Link><span>/</span><span>Revizuire</span><span>/</span><span className="font-mono text-[#60736a]">{caseId}</span></div>
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end"><div><div className="mb-2 flex flex-wrap items-center gap-2"><span className="rounded-md bg-[#fff3dc] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-[#a07836]">Ciornă AI</span><span className="font-mono text-[10px] text-[#94a199]">{caseId}</span>{reviewAnswer==="yes"&&<span className="rounded-md bg-[#fff0e7] px-2 py-1 text-[9px] font-semibold text-[#d85514]">Confirmată de tine · demo</span>}{reviewAnswer&&reviewAnswer!=="yes"&&<span className="rounded-md bg-[#fff4df] px-2 py-1 text-[9px] font-semibold text-[#a07836]">Rezultat neconfirmat · demo</span>}</div><h1 className="max-w-[800px] text-[25px] font-semibold leading-tight tracking-[-0.04em] text-[#2a170e] sm:text-[30px]">{caseTitle}</h1><div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10px] text-[#7d8c84]"><span>Echipă demonstrativă</span><span className="h-1 w-1 rounded-full bg-[#c4cec8]"/><span>Conversație Teams copiată manual</span><span className="h-1 w-1 rounded-full bg-[#c4cec8]"/><span>Actualizat acum 18 minute</span></div></div><Link href="/" className="inline-flex h-9 items-center gap-2 self-start rounded-xl border border-[#D9C3AF] bg-[#E8D9CA] px-3 text-[10px] font-semibold text-[#60736a] shadow-sm hover:bg-[#EEE0D2] lg:self-auto"><ArrowLeft size={14}/> Înapoi la cazuri</Link></div>

      {!dismissed&&<div className="flex gap-3 rounded-2xl border border-[#f0dfbd] bg-[#fff9eb] px-4 py-3.5"><div className="mt-0.5 text-[#b38741]"><CircleAlert size={16}/></div><div className="flex-1"><div className="text-[11px] font-semibold text-[#775a2a]">Verifică pasul marcat „Neconfirmat” înainte de publicare.</div><p className="mt-1 text-[10px] leading-5 text-[#967d54]">Helpy a găsit o confirmare a rezultatului, dar activarea seriei trebuie validată conform procesului financiar.</p></div><button aria-label="Închide atenționarea" onClick={()=>setDismissed(true)} className="self-start rounded-md p-1 text-[#b89d6b] hover:bg-[#f8edda]"><X size={14}/></button></div>}

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,.88fr)_minmax(0,1.35fr)]">
        <section className="overflow-hidden rounded-2xl border border-[#FF5A00] bg-[#E8D9CA] shadow-[0_4px_14px_rgba(61,35,19,.04)]">
          <div className="flex items-start justify-between border-b border-[#DDCABB] px-5 py-4"><div><h2 className="text-[13px] font-semibold text-[#302016]">Surse și cronologie</h2><p className="mt-1 text-[10px] text-[#8c9a93]">Contextul din care a fost extrasă procedura</p></div><button aria-label="Mai multe opțiuni" className="rounded-lg p-1.5 text-[#98a59e] hover:bg-[#D9C2AA]"><MoreHorizontal size={17}/></button></div>
          <div className="p-5">
            <div className="mb-5 flex items-center gap-2 rounded-xl bg-[#E8D9CA] px-3 py-2.5"><div className="grid h-7 w-7 place-items-center rounded-lg bg-[#E8D9CA] text-[#c95418]"><FileText size={14}/></div><div className="min-w-0 flex-1"><div className="text-[10px] font-semibold text-[#50645a]">Conversație importată</div><div className="mt-0.5 truncate text-[9px] text-[#8d9b94]">Teams · text lipit manual</div></div><span className="text-[9px] text-[#9ba8a1]">10:14</span></div>
            <div className="relative ml-3 space-y-5 border-l border-dashed border-[#d8e3dc] pl-5">
              {teamsMessages.map((message,index)=><div key={index} className="relative"><span className="absolute -left-[26px] top-1 grid h-4 w-4 place-items-center rounded-full border-2 border-white bg-[#d8eafa] ring-1 ring-[#d8eafa]"><span className="h-1.5 w-1.5 rounded-full bg-[#668ead]"/></span><div className="flex items-center justify-between"><span className="inline-flex items-center gap-1.5 text-[9px] font-semibold text-[#67839a]"><MessageSquareText size={12}/> TEAMS · IMPORT MANUAL</span><span className="text-[9px] text-[#9aa69f]">{message.time}</span></div><p className="mt-2 rounded-xl rounded-tl-sm bg-[#f5f8fa] p-3 text-[10px] leading-5 text-[#53666f]">„{message.text}”</p><div className="mt-1.5 text-[9px] text-[#9aa69f]">{message.author} · mesaj importat manual</div></div>)}
            </div>
            <button type="button" onClick={()=>setTeamsImportOpen(true)} className="mt-5 inline-flex items-center gap-1.5 text-[9px] font-semibold text-[#db4b00] hover:text-[#cc4200]">Importă / editează conversația <ArrowUpRight size={12}/></button>
          </div>
          <div className="border-t border-[#DDCABB] bg-[#F0E3D6] px-5 py-3"><div className="flex items-center gap-2 text-[9px] text-[#8a9991]"><ShieldCheck size={13} className="text-[#6a9879]"/>Demo local: conversație introdusă manual, fără conectare la Microsoft Teams.</div></div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-[#FF5A00] bg-[#E8D9CA] shadow-[0_4px_14px_rgba(61,35,19,.04)]">
          <div className="flex flex-col justify-between gap-3 border-b border-[#DDCABB] px-5 py-4 sm:flex-row sm:items-center sm:px-6"><div><div className="flex items-center gap-2"><h2 className="text-[13px] font-semibold text-[#302016]">Procedură candidat</h2><span className="inline-flex items-center gap-1 rounded-full bg-[#f0edfa] px-2 py-1 text-[9px] font-semibold text-[#7463a5]"><Sparkles size={10}/> simulare AI · demo</span></div><p className="mt-1 text-[10px] text-[#8c9a93]">Pașii păstrează proveniența și nivelul de confirmare</p></div><span className="inline-flex items-center gap-1.5 self-start rounded-full bg-[#fff4ec] px-2.5 py-1.5 text-[9px] font-semibold text-[#c95418] sm:self-auto"><ShieldCheck size={11}/> {teamsMessages.length} mesaje demo</span></div>
          <div className="p-5 sm:p-6">
            {editing&&<div className="mb-4 rounded-xl border border-[#f2ddd0] bg-[#F0E3D6] p-3"><label className="mb-2 block text-[9px] font-semibold uppercase tracking-[.08em] text-[#708279]">Notă de revizuire</label><textarea defaultValue="Verifică seria aferentă punctului de lucru înainte de a modifica setarea." className="min-h-[68px] w-full resize-y rounded-lg border border-[#D9C3AF] bg-[#E8D9CA] p-2.5 text-[10px] leading-5 text-[#455a4f] outline-none focus:border-[#8fbea3]"/><div className="mt-2 flex justify-end gap-2"><button onClick={()=>setEditing(false)} className="rounded-lg px-3 py-1.5 text-[9px] font-semibold text-[#7a8a82] hover:bg-[#fff3eb]">Renunță</button><button onClick={()=>{setEditing(false);notify("Modificarea a fost salvată în demo.")}} className="rounded-lg bg-[#fff0e7] px-3 py-1.5 text-[9px] font-semibold text-[#d85415]">Salvează nota</button></div></div>}
            <div className="space-y-1">
              {steps.map((step,index)=><div key={step.text} className="group flex gap-3 rounded-xl px-2 py-3 transition hover:bg-[#F0E3D6]"><div className="flex w-7 shrink-0 flex-col items-center"><span className={`grid h-6 w-6 place-items-center rounded-full text-[10px] font-semibold ${step.tone==="green"?"bg-[#fff0e7] text-[#e35a18]":"bg-[#f1f4f2] text-[#72837a]"}`}>{step.tone==="green"?<Check size={12}/>:index+1}</span>{index<steps.length-1&&<span className="mt-1 h-full min-h-[20px] w-px bg-[#D7C2AF]"/>}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[11px] font-medium leading-5 text-[#443026]">{step.text}</p><StatePill state={step.state} tone={step.tone}/></div><div className="mt-1.5 flex items-center gap-1.5 text-[9px] text-[#95a19b]"><span>{step.source}</span>{step.tone==="amber"&&<CircleAlert size={11} className="text-[#bc914d]"/>}</div></div></div>)}
            </div>
            <div className="mt-4 rounded-xl border border-[#f0e5cf] bg-[#fffaf0] p-3.5"><div className="flex items-start gap-2"><CircleAlert size={14} className="mt-0.5 shrink-0 text-[#b1894b]"/><div><div className="text-[10px] font-semibold text-[#795f35]">Excepție importantă</div><p className="mt-1 text-[10px] leading-5 text-[#927b52]">Verifică pașii marcați „Neconfirmat” cu responsabilul procesului înainte de publicare.</p><div className="mt-1 text-[9px] text-[#a08d67]">Revizuire umană necesară înainte de publicare.</div></div></div></div>
            <div className="mt-5 flex flex-col gap-2 border-t border-[#DDCABB] pt-4 sm:flex-row sm:items-center"><button onClick={()=>setConfirmDialogOpen(true)} disabled={confirmed} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[#ff5a00] px-4 text-[10px] font-semibold text-[#29170e] transition hover:bg-[#e94c00] disabled:bg-[#72a68e]"><CheckCheck size={14}/>{confirmed?"Confirmată de tine":reviewAnswer?"Revizuiește rezultatul":"Confirmă procedura"}</button><button onClick={()=>setEditing(!editing)} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#dfe9e3] bg-[#E8D9CA] px-4 text-[10px] font-semibold text-[#5b7166] hover:bg-[#EBDCCD]"><Edit3 size={13}/>Editează</button><button onClick={()=>notify("Procedura a fost respinsă în demo.")} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#f0e1df] bg-[#E8D9CA] px-4 text-[10px] font-semibold text-[#a2615c] hover:bg-[#fff8f7]"><XCircle size={13}/>Respinge</button></div>
            <p className="mt-3 text-center text-[9px] leading-4 text-[#9aa69f]">Confirmarea din demo nu publică date și nu salvează nimic în backend.</p>
          </div>
        </section>
      </div>
      {teamsImportOpen&&<div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#1a0d08]/55 p-4" onMouseDown={(event)=>{if(event.target===event.currentTarget)setTeamsImportOpen(false)}}><section role="dialog" aria-modal="true" aria-labelledby="teams-import-title" className="w-full max-w-2xl rounded-2xl border border-[#DDCABB] bg-[#E8D9CA] p-5 shadow-2xl sm:p-6"><div className="flex items-start justify-between gap-4"><div><div className="text-[9px] font-bold uppercase tracking-[.12em] text-[#d95413]">Demo · import manual</div><h2 id="teams-import-title" className="mt-2 text-[18px] font-semibold tracking-tight text-[#2a170e]">Lipește conversația din Teams</h2><p className="mt-1 text-[10px] leading-5 text-[#77877f]">Pune câte un mesaj pe linie. Format opțional: oră Autor: mesaj.</p></div><button type="button" aria-label="Închide" onClick={()=>setTeamsImportOpen(false)} className="rounded-lg p-1.5 text-[#71827a] hover:bg-[#D9C2AA]"><X size={16}/></button></div><textarea value={transcript} onChange={(event)=>setTranscript(event.target.value)} rows={8} className="mt-4 w-full resize-y rounded-xl border border-[#D6C1AD] bg-[#F0E3D6] p-3 font-mono text-[10px] leading-5 text-[#443026] outline-none focus:border-[#e95811]"/><div className="mt-4 flex flex-col-reverse justify-between gap-2 sm:flex-row"><button type="button" onClick={()=>setTranscript(initialTranscript)} className="rounded-xl border border-[#D6C1AD] px-4 py-2.5 text-[10px] font-semibold text-[#5b7166] hover:bg-[#F0E3D6]">Încarcă exemplul</button><button type="button" onClick={analyzeTeamsTranscript} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#ff5a00] px-4 py-2.5 text-[10px] font-semibold text-[#29170e] hover:bg-[#e94c00]"><Sparkles size={13}/>Analizează conversația</button></div><p className="mt-4 rounded-lg bg-[#fff9eb] px-3 py-2 text-[9px] leading-4 text-[#927b52]">Analiza este o simulare locală pentru prezentare. Mesajele nu sunt trimise către Microsoft sau către backend.</p></section></div>}
      {confirmDialogOpen&&<div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#1a0d08]/55 p-4" onMouseDown={(event)=>{if(event.target===event.currentTarget)setConfirmDialogOpen(false)}}><section role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="w-full max-w-md rounded-2xl border border-[#DDCABB] bg-[#E8D9CA] p-5 shadow-2xl sm:p-6"><div className="flex items-start justify-between gap-4"><div><div className="text-[9px] font-bold uppercase tracking-[.12em] text-[#d95413]">Verificare de către utilizator</div><h2 id="confirm-title" className="mt-2 text-[18px] font-semibold tracking-tight text-[#2a170e]">Ai reușit să obții acest rezultat?</h2></div><button type="button" aria-label="Închide" onClick={()=>setConfirmDialogOpen(false)} className="rounded-lg p-1.5 text-[#71827a] hover:bg-[#D9C2AA]"><X size={16}/></button></div><p className="mt-4 rounded-xl border border-[#DDCABB] bg-[#F0E3D6] p-3.5 text-[11px] leading-5 text-[#443026]">{outcomeText}</p><p className="mt-3 text-[10px] leading-5 text-[#77877f]">Simularea a extras un posibil rezultat din mesaje. Răspunsul tău stabilește dacă îl marcăm drept confirmat.</p><div className="mt-5 grid gap-2 sm:grid-cols-3"><button type="button" onClick={()=>submitConfirmation("yes")} className="rounded-xl bg-[#ff5a00] px-3 py-3 text-[10px] font-semibold text-[#29170e] hover:bg-[#e94c00]">Da, am reușit</button><button type="button" onClick={()=>submitConfirmation("no")} className="rounded-xl border border-[#D6C1AD] bg-[#E8D9CA] px-3 py-3 text-[10px] font-semibold text-[#5b7166] hover:bg-[#F0E3D6]">Nu</button><button type="button" onClick={()=>submitConfirmation("unsure")} className="rounded-xl border border-[#D6C1AD] bg-[#E8D9CA] px-3 py-3 text-[10px] font-semibold text-[#5b7166] hover:bg-[#F0E3D6]">Nu sunt sigur</button></div><p className="mt-4 text-[9px] text-[#9aa69f]">Doar „Da, am reușit” marchează afirmația „Confirmat de tine”.</p></section></div>}
      {toast&&<div role="status" className="fixed bottom-5 right-5 z-[60] flex items-center gap-2 rounded-xl bg-[#2a160d] px-4 py-3 text-[11px] font-medium text-white shadow-xl"><CircleCheck size={15} className="text-[#ffb98f]"/>{toast}</div>}
    </div>
  </AppShell>;
}