"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  buildRoadmap,
  loadInterviewDb,
  setCandidateStatus,
  type InterviewDb,
  type ResourceKind,
  type RoadmapStep,
} from "@/lib/interview-db";
import { CalendarRange, Circle, CircleCheck, Clock3, ExternalLink, GraduationCap, Route, ShieldCheck, Sparkles, Target, Trash2, UserCheck, Users, UserX } from "lucide-react";

const levelStyle: Record<RoadmapStep["level"], string> = {
  critic: "bg-[#ffe1d1] text-[#b23c00]",
  important: "bg-[#fff1d6] text-[#9a6a17]",
  "de consolidat": "bg-[#EEE0D2] text-[#6f5a4b]",
};

const kindLabel: Record<ResourceKind, string> = {
  curs: "Curs",
  bootcamp: "Bootcamp",
  articol: "Articol",
  documentație: "Documentație",
  practică: "Practică",
  carte: "Carte",
};

function fmt(date?: string) {
  if (!date) return "—";
  return new Date(date + "T00:00:00").toLocaleDateString("ro-RO", { day: "numeric", month: "short", year: "numeric" });
}

export default function RoadmapPage() {
  const [db, setDb] = useState<InterviewDb>(() => loadInterviewDb());
  const employees = db.candidates.filter((c) => c.status === "angajat");
  const pending = db.candidates.filter((c) => c.status === "în proces");
  const [selected, setSelected] = useState(employees[0]?.id ?? "");
  const [hoursPerWeek, setHoursPerWeek] = useState(6);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState<string | null>(null);

  const roadmap = useMemo(() => buildRoadmap(db, selected, hoursPerWeek), [db, selected, hoursPerWeek]);
  const completed = roadmap ? roadmap.steps.filter((s) => done[`${selected}:${s.skill}`]).length : 0;

  const decide = (id: string, status: "angajat" | "respins") => {
    const c = db.candidates.find((x) => x.id === id);
    if (!c) return;
    if (status === "respins" && !window.confirm(`Respingi candidatul ${c.name}? Toate datele de interviu vor fi șterse definitiv.`)) return;
    setDb((current) => setCandidateStatus(current, id, status));
    if (status === "angajat") {
      setSelected(id);
      setNotice(`${c.name} a fost angajat(ă). Roadmap-ul a fost generat din interviuri.`);
    } else {
      setNotice("Candidatul a fost respins. Interviurile și datele personale au fost șterse.");
    }
  };

  return <AppShell>
    <div className="space-y-7">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#ff5a00]">OAMENI · DEZVOLTARE</div>
          <h1 className="text-[27px] font-semibold tracking-[-0.045em] text-[#2a170e] sm:text-[32px]">Roadmap de dezvoltare</h1>
          <p className="mt-2 max-w-[640px] text-[13px] leading-6 text-[#788881]">Plan de învățare pentru angajații noi, construit din slăbiciunile notate la interviuri: cursuri, bootcampuri, articole și exerciții.</p>
        </div>
        <label className="flex items-center gap-2 self-start rounded-xl border border-[#D6C1AD] bg-[#F0E3D6] px-3 py-2 text-[10px] text-[#5b4637] sm:self-auto">
          <Clock3 size={13} className="text-[#c95418]" /> Timp de studiu
          <select value={hoursPerWeek} onChange={(e) => setHoursPerWeek(Number(e.target.value))} className="bg-transparent font-semibold outline-none">
            {[4, 6, 8, 10].map((h) => <option key={h} value={h}>{h} ore / săpt.</option>)}
          </select>
        </label>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-[#f6d3bd] bg-[#fff6f0] p-4">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#E8D9CA] text-[#e35a18]"><ShieldCheck size={15} /></div>
        <div>
          <div className="text-[10px] font-semibold text-[#3c2a1e]">Roadmap doar pentru angajați. Datele candidaților respinși se șterg.</div>
          <p className="mt-1 text-[9px] leading-5 text-[#7d6a5c]">La respingere, interviurile, notele și datele personale sunt șterse imediat; rămâne doar o intrare anonimă în jurnal. Date demonstrative, fără backend.</p>
        </div>
      </div>

      {notice && <div className="rounded-xl border border-[#FF5A00] bg-[#E8D9CA] px-4 py-3 text-[11px] text-[#3c2a1e]">{notice}</div>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="space-y-5">
          <section className="overflow-hidden rounded-2xl border border-[#FF5A00] bg-[#E8D9CA]">
            <div className="flex items-center gap-2 border-b border-[#DDCABB] px-4 py-3"><Users size={14} className="text-[#c95418]" /><h2 className="text-[12px] font-semibold text-[#302016]">Angajați ({employees.length})</h2></div>
            <div className="divide-y divide-[#E0CEBF]">
              {employees.map((c) => {
                const count = db.interviews.filter((i) => i.candidateId === c.id).length;
                const active = c.id === selected;
                return <button key={c.id} onClick={() => setSelected(c.id)} className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${active ? "bg-[#ff5a00]/15" : "hover:bg-[#F0E3D6]"}`}>
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#ffdac5] text-[10px] font-bold text-[#8a330a]">{c.name.split(" ").map((p) => p[0]).join("")}</div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11px] font-semibold text-[#332117]">{c.name}</div>
                    <div className="mt-0.5 text-[9px] text-[#86756a]">{c.role} · {count} interviuri · din {fmt(c.startDate)}</div>
                  </div>
                </button>;
              })}
              {employees.length === 0 && <div className="px-4 py-6 text-center text-[10px] text-[#86756a]">Niciun angajat încă.</div>}
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-[#FF5A00] bg-[#E8D9CA]">
            <div className="border-b border-[#DDCABB] px-4 py-3">
              <h2 className="text-[12px] font-semibold text-[#302016]">Candidați în proces ({pending.length})</h2>
              <p className="mt-1 text-[9px] text-[#86756a]">Roadmap-ul apare doar după angajare.</p>
            </div>
            <div className="divide-y divide-[#E0CEBF]">
              {pending.map((c) => <div key={c.id} className="px-4 py-3">
                <div className="text-[11px] font-semibold text-[#332117]">{c.name}</div>
                <div className="mt-0.5 text-[9px] text-[#86756a]">{c.role} · aplicat {fmt(c.appliedAt)}</div>
                <div className="mt-2 flex gap-2 text-[9px]">
                  <button onClick={() => decide(c.id, "angajat")} className="inline-flex items-center gap-1 rounded-lg bg-[#ff5a00] px-2.5 py-1.5 text-[9px] font-semibold text-[#29170e] hover:bg-[#e94c00]"><UserCheck size={12} />Angajează</button>
                  <button onClick={() => decide(c.id, "respins")} className="inline-flex items-center gap-1 rounded-lg border border-[#D9C3AF] px-2.5 py-1.5 text-[9px] font-semibold text-[#8a3a1a] hover:bg-[#F0E3D6]"><UserX size={12} />Respinge</button>
                </div>
              </div>)}
              {pending.length === 0 && <div className="px-4 py-6 text-center text-[10px] text-[#86756a]">Niciun candidat în proces.</div>}
            </div>
          </section>

          <section className="rounded-2xl border border-[#FF5A00] bg-[#E8D9CA] p-4">
            <div className="flex items-center gap-2"><Trash2 size={13} className="text-[#8a3a1a]" /><h2 className="text-[12px] font-semibold text-[#302016]">Jurnal de ștergere</h2></div>
            <ul className="mt-3 space-y-2">
              {db.purgeLog.map((p, i) => <li key={`${p.ref}-${i}`} className="rounded-lg bg-[#F0E3D6] px-3 py-2 text-[9px] leading-4 text-[#6f5a4b]">
                <span className="font-mono font-semibold text-[#4a3324]">{p.ref}</span> · {fmt(p.purgedAt)} · {p.interviewsDeleted} interviuri șterse
              </li>)}
              {db.purgeLog.length === 0 && <li className="text-[9px] text-[#86756a]">Nicio ștergere.</li>}
            </ul>
          </section>
        </aside>

        <section className="min-w-0 space-y-5">
          {!roadmap && <div className="rounded-2xl border border-[#FF5A00] bg-[#E8D9CA] px-6 py-12 text-center text-[12px] text-[#7d6a5c]">Selectează un angajat ca să vezi roadmap-ul.</div>}
          {roadmap && <>
            <div className="rounded-2xl border border-[#FF5A00] bg-[#E8D9CA] p-5">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                  <div className="flex items-center gap-2 text-[10px] text-[#86756a]"><GraduationCap size={14} className="text-[#e85a1b]" />{roadmap.candidate.role}</div>
                  <h2 className="mt-1 text-[20px] font-semibold tracking-tight text-[#2c1d14]">{roadmap.candidate.name}</h2>
                </div>
                <div className="text-left sm:text-right">
                  <div className="text-[10px] text-[#86756a]">Progres</div>
                  <div className="text-[18px] font-semibold text-[#2c1d14]">{completed} / {roadmap.steps.length}</div>
                </div>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#F0E3D6]"><div className="h-full rounded-full bg-[#ff5a00] transition-all" style={{ width: `${roadmap.steps.length ? (completed / roadmap.steps.length) * 100 : 0}%` }} /></div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-[#F0E3D6] p-3"><div className="text-[9px] text-[#86756a]">Interviuri analizate</div><div className="mt-1 text-[18px] font-semibold text-[#2c1d14]">{roadmap.interviews}</div></div>
                <div className="rounded-xl bg-[#F0E3D6] p-3"><div className="text-[9px] text-[#86756a]">Arii de lucru</div><div className="mt-1 text-[18px] font-semibold text-[#2c1d14]">{roadmap.steps.length}</div></div>
                <div className="rounded-xl bg-[#F0E3D6] p-3"><div className="text-[9px] text-[#86756a]">Durată estimată</div><div className="mt-1 text-[18px] font-semibold text-[#2c1d14]">{roadmap.totalWeeks} săpt.</div></div>
              </div>
            </div>

            {roadmap.steps.length === 0 && <div className="rounded-2xl border border-[#FF5A00] bg-[#E8D9CA] px-6 py-10 text-center text-[12px] text-[#7d6a5c]">Nu au fost notate slăbiciuni la interviuri.</div>}

            <ol className="space-y-4">
              {roadmap.steps.map((step, index) => {
                const key = `${selected}:${step.skill}`;
                const isDone = !!done[key];
                return <li key={key} className={`overflow-hidden rounded-2xl border border-[#FF5A00] bg-[#E8D9CA] ${isDone ? "opacity-70" : ""}`}>
                  <div className="flex flex-col gap-3 border-b border-[#DDCABB] px-5 py-4 text-[10px] sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#fff3eb] text-[12px] font-bold text-[#e85a1b]">{index + 1}</div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-[13px] font-semibold text-[#2b1b12]">{step.label}</h3>
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${levelStyle[step.level]}`}>{step.level}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-[#86756a]">
                          <span className="inline-flex items-center gap-1"><CalendarRange size={11} />Săpt. {step.weekStart}{step.weekEnd > step.weekStart ? `–${step.weekEnd}` : ""}</span>
                          <span>{step.hours} ore</span>
                          <span>Prioritate {step.priority}</span>
                          {step.avgScore != null && <span>Scor interviu {step.avgScore.toFixed(1)}/5</span>}
                        </div>
                      </div>
                    </div>
                    <button onClick={() => setDone((d) => ({ ...d, [key]: !d[key] }))} className="inline-flex items-center gap-1.5 self-start rounded-lg border border-[#D9C3AF] px-2.5 py-1.5 text-[10px] font-semibold text-[#5b4637] hover:bg-[#F0E3D6] sm:self-auto">
                      {isDone ? <CircleCheck size={13} className="text-[#ff5a00]" /> : <Circle size={13} />}{isDone ? "Finalizat" : "Marchează finalizat"}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-5 px-5 py-4 md:grid-cols-2">
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#9a8576]">De ce</div>
                      <ul className="mt-2 space-y-2">
                        {step.evidence.map((e) => <li key={e.interviewId + e.note} className="rounded-lg bg-[#F0E3D6] px-3 py-2 text-[10px] leading-5 text-[#4a3324]">
                          <span className="font-semibold">{e.stage}</span> <span className="text-[#86756a]">· {fmt(e.date)}</span><br />{e.note}
                        </li>)}
                      </ul>
                      <div className="mt-3 flex items-start gap-2 rounded-lg border border-dashed border-[#D9C3AF] px-3 py-2 text-[10px] leading-5 text-[#4a3324]"><Target size={13} className="mt-0.5 shrink-0 text-[#c95418]" /><span><span className="font-semibold">Obiectiv:</span> {step.milestone}</span></div>
                    </div>
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#9a8576]">Resurse</div>
                      <ul className="mt-2 space-y-2">
                        {step.resources.map((r) => <li key={r.url}>
                          <a href={r.url} target="_blank" rel="noopener noreferrer" className="group flex items-start justify-between gap-3 rounded-lg border border-[#DDCABB] bg-[#F3E7DB] px-3 py-2 transition hover:border-[#ff5a00]">
                            <div className="min-w-0">
                              <div className="text-[10px] font-semibold text-[#332117] group-hover:text-[#c84e13]">{r.title}</div>
                              <div className="mt-0.5 text-[9px] text-[#86756a]">{kindLabel[r.kind]} · {r.provider} · ~{r.hours} ore · {r.free ? "gratuit" : "plătit"}</div>
                            </div>
                            <ExternalLink size={12} className="mt-0.5 shrink-0 text-[#a99585] group-hover:text-[#e95811]" />
                          </a>
                        </li>)}
                      </ul>
                    </div>
                  </div>
                </li>;
              })}
            </ol>

            {roadmap.bootcamp && <div className="flex items-start gap-3 rounded-2xl border border-[#FF5A00] bg-[#E8D9CA] p-4">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#fff3eb] text-[#c95418]"><Route size={15} /></div>
              <div className="text-[10px] leading-5 text-[#4a3324]">
                <span className="font-semibold">Alternativă: un bootcamp complet.</span> Lipsurile acoperă mare parte din{" "}
                <a href={roadmap.bootcamp.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#c84e13] underline">{roadmap.bootcamp.title}</a> ({roadmap.bootcamp.provider}{roadmap.bootcamp.free ? ", gratuit" : ""}).
              </div>
            </div>}

            <div className="flex items-start gap-3 rounded-2xl border border-[#e8eee9] bg-[#EEE0D2] p-4"><div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#E8D9CA] text-[#c95418]"><Sparkles size={15} /></div><p className="text-[10px] leading-5 text-[#75867d]">Ordinea vine din severitatea notată la interviu, din câte ori a apărut aceeași slăbiciune și din scorul primit. Resursele gratuite sunt puse primele; pentru lipsurile critice se adaugă și un curs plătit, mai structurat.</p></div>
          </>}
        </section>
      </div>
    </div>
  </AppShell>;
}
