// Bază de date mock cu interviuri + logica pentru roadmap-ul de dezvoltare.
// Reguli de confidențialitate:
//  - roadmap-ul se generează doar pentru candidații angajați;
//  - datele candidaților respinși (inclusiv interviurile) se șterg; rămâne doar o intrare de audit anonimă.

export type SkillId =
  | "typescript"
  | "react"
  | "async-js"
  | "testing"
  | "sql"
  | "system-design"
  | "algorithms"
  | "git"
  | "docker"
  | "web-security"
  | "accessibility"
  | "communication";

export type CandidateStatus = "angajat" | "în proces" | "respins";

export type Candidate = {
  id: string;
  name: string;
  role: string;
  status: CandidateStatus;
  appliedAt: string;
  decidedAt?: string;
  startDate?: string;
};

export type Weakness = {
  skill: SkillId;
  severity: 1 | 2 | 3; // 1 = minor, 3 = blocant pentru rol
  note: string;
};

export type Interview = {
  id: string;
  candidateId: string;
  date: string;
  stage: "Screening tehnic" | "Live coding" | "System design" | "Cultural fit";
  interviewer: string;
  scores: Partial<Record<SkillId, 1 | 2 | 3 | 4 | 5>>;
  strengths: string[];
  weaknesses: Weakness[];
};

export type ResourceKind = "curs" | "bootcamp" | "articol" | "documentație" | "practică" | "carte";

export type Resource = {
  title: string;
  provider: string;
  kind: ResourceKind;
  url: string;
  hours: number;
  free: boolean;
};

export type PurgeRecord = {
  ref: string; // identificator anonim, fără nume
  purgedAt: string; // YYYY-MM-DD
  interviewsDeleted: number;
  reason: string;
};

export type InterviewDb = {
  candidates: Candidate[];
  interviews: Interview[];
  purgeLog: PurgeRecord[];
};

export const skills: Record<SkillId, { label: string; area: string }> = {
  typescript: { label: "TypeScript", area: "Frontend" },
  react: { label: "React și state management", area: "Frontend" },
  "async-js": { label: "JavaScript asincron", area: "Fundamente" },
  testing: { label: "Testare automată", area: "Calitate" },
  sql: { label: "SQL și modelare de date", area: "Backend" },
  "system-design": { label: "System design", area: "Arhitectură" },
  algorithms: { label: "Algoritmi și structuri de date", area: "Fundamente" },
  git: { label: "Git și code review", area: "Colaborare" },
  docker: { label: "Docker și deployment", area: "DevOps" },
  "web-security": { label: "Securitate web (OWASP)", area: "Securitate" },
  accessibility: { label: "Accesibilitate", area: "Frontend" },
  communication: { label: "Comunicare tehnică", area: "Soft skills" },
};

// Udemy / Coursera: link de căutare (cursurile individuale își schimbă des URL-urile).
const udemy = (q: string) => `https://www.udemy.com/courses/search/?q=${encodeURIComponent(q)}`;
const coursera = (q: string) => `https://www.coursera.org/search?query=${encodeURIComponent(q)}`;

export const resources: Record<SkillId, Resource[]> = {
  typescript: [
    { title: "TypeScript Handbook", provider: "typescriptlang.org", kind: "documentație", url: "https://www.typescriptlang.org/docs/handbook/intro.html", hours: 8, free: true },
    { title: "Tutoriale gratuite Total TypeScript", provider: "Total TypeScript", kind: "practică", url: "https://www.totaltypescript.com/tutorials", hours: 10, free: true },
    { title: "Cursuri TypeScript", provider: "Udemy", kind: "curs", url: udemy("typescript"), hours: 15, free: false },
    { title: "TypeScript Roadmap", provider: "roadmap.sh", kind: "articol", url: "https://roadmap.sh/typescript", hours: 2, free: true },
  ],
  react: [
    { title: "Learn React (documentația oficială)", provider: "react.dev", kind: "documentație", url: "https://react.dev/learn", hours: 12, free: true },
    { title: "Full Stack Open – părțile React", provider: "Universitatea din Helsinki", kind: "bootcamp", url: "https://fullstackopen.com/en/", hours: 40, free: true },
    { title: "Cursuri React", provider: "Udemy", kind: "curs", url: udemy("react"), hours: 20, free: false },
    { title: "You Might Not Need an Effect", provider: "react.dev", kind: "articol", url: "https://react.dev/learn/you-might-not-need-an-effect", hours: 1, free: true },
  ],
  "async-js": [
    { title: "Promises, async/await", provider: "javascript.info", kind: "documentație", url: "https://javascript.info/async", hours: 5, free: true },
    { title: "Using promises", provider: "MDN", kind: "articol", url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises", hours: 1, free: true },
    { title: "Cursuri JavaScript asincron", provider: "Udemy", kind: "curs", url: udemy("asynchronous javascript"), hours: 8, free: false },
  ],
  testing: [
    { title: "The Practical Test Pyramid", provider: "martinfowler.com", kind: "articol", url: "https://martinfowler.com/articles/practical-test-pyramid.html", hours: 2, free: true },
    { title: "Testing Library – documentație", provider: "testing-library.com", kind: "documentație", url: "https://testing-library.com/docs/", hours: 4, free: true },
    { title: "Playwright – Getting started", provider: "playwright.dev", kind: "documentație", url: "https://playwright.dev/docs/intro", hours: 4, free: true },
    { title: "Cursuri de testare JavaScript", provider: "Udemy", kind: "curs", url: udemy("javascript testing jest"), hours: 12, free: false },
  ],
  sql: [
    { title: "SQLBolt – lecții interactive", provider: "SQLBolt", kind: "practică", url: "https://sqlbolt.com", hours: 6, free: true },
    { title: "PostgreSQL Tutorial", provider: "postgresql.org", kind: "documentație", url: "https://www.postgresql.org/docs/current/tutorial.html", hours: 6, free: true },
    { title: "Use The Index, Luke (indexare și performanță)", provider: "use-the-index-luke.com", kind: "carte", url: "https://use-the-index-luke.com", hours: 8, free: true },
    { title: "Cursuri SQL", provider: "Udemy", kind: "curs", url: udemy("sql postgresql"), hours: 15, free: false },
  ],
  "system-design": [
    { title: "System Design Primer", provider: "GitHub", kind: "articol", url: "https://github.com/donnemartin/system-design-primer", hours: 15, free: true },
    { title: "System Design Roadmap", provider: "roadmap.sh", kind: "articol", url: "https://roadmap.sh/system-design", hours: 3, free: true },
    { title: "Designing Data-Intensive Applications", provider: "O'Reilly", kind: "carte", url: "https://dataintensive.net", hours: 30, free: false },
    { title: "Cursuri System Design", provider: "Udemy", kind: "curs", url: udemy("system design"), hours: 15, free: false },
  ],
  algorithms: [
    { title: "NeetCode Roadmap", provider: "NeetCode", kind: "practică", url: "https://neetcode.io/roadmap", hours: 30, free: true },
    { title: "Top Interview 150", provider: "LeetCode", kind: "practică", url: "https://leetcode.com/studyplan/top-interview-150/", hours: 40, free: true },
    { title: "Cursuri de algoritmi", provider: "Coursera", kind: "curs", url: coursera("algorithms"), hours: 30, free: false },
  ],
  git: [
    { title: "Pro Git (carte gratuită)", provider: "git-scm.com", kind: "carte", url: "https://git-scm.com/book/en/v2", hours: 8, free: true },
    { title: "Learn Git Branching", provider: "learngitbranching.js.org", kind: "practică", url: "https://learngitbranching.js.org", hours: 3, free: true },
    { title: "Google Engineering Practices – Code Review", provider: "Google", kind: "articol", url: "https://google.github.io/eng-practices/review/", hours: 2, free: true },
  ],
  docker: [
    { title: "Docker – Get started", provider: "docs.docker.com", kind: "documentație", url: "https://docs.docker.com/get-started/", hours: 5, free: true },
    { title: "DevOps Roadmap", provider: "roadmap.sh", kind: "articol", url: "https://roadmap.sh/devops", hours: 2, free: true },
    { title: "Cursuri Docker", provider: "Udemy", kind: "curs", url: udemy("docker"), hours: 12, free: false },
  ],
  "web-security": [
    { title: "OWASP Top 10", provider: "OWASP", kind: "articol", url: "https://owasp.org/www-project-top-ten/", hours: 3, free: true },
    { title: "Web Security Academy (laboratoare)", provider: "PortSwigger", kind: "practică", url: "https://portswigger.net/web-security", hours: 20, free: true },
    { title: "Cursuri securitate web", provider: "Udemy", kind: "curs", url: udemy("web application security"), hours: 10, free: false },
  ],
  accessibility: [
    { title: "Learn Accessibility", provider: "web.dev", kind: "documentație", url: "https://web.dev/learn/accessibility", hours: 6, free: true },
    { title: "WCAG 2.2 – Quick Reference", provider: "W3C", kind: "documentație", url: "https://www.w3.org/WAI/WCAG22/quickref/", hours: 2, free: true },
  ],
  communication: [
    { title: "Technical Writing One & Two", provider: "Google for Developers", kind: "curs", url: "https://developers.google.com/tech-writing", hours: 6, free: true },
    { title: "Cursuri de comunicare tehnică", provider: "Coursera", kind: "curs", url: coursera("technical communication"), hours: 10, free: false },
  ],
};

// Programe lungi recomandate când lipsurile acoperă o arie întreagă.
export const bootcamps: { title: string; provider: string; url: string; covers: SkillId[]; free: boolean }[] = [
  { title: "Full Stack Open", provider: "Universitatea din Helsinki", url: "https://fullstackopen.com/en/", covers: ["react", "typescript", "testing", "async-js", "docker"], free: true },
  { title: "The Odin Project – Full Stack JavaScript", provider: "The Odin Project", url: "https://www.theodinproject.com/paths/full-stack-javascript", covers: ["react", "async-js", "git", "sql", "testing"], free: true },
  { title: "freeCodeCamp – certificări", provider: "freeCodeCamp", url: "https://www.freecodecamp.org/learn", covers: ["algorithms", "accessibility", "async-js"], free: true },
];

const seed: InterviewDb = {
  candidates: [
    { id: "C-101", name: "Ioana Dumitrescu", role: "Frontend Developer", status: "angajat", appliedAt: "2026-08-04", decidedAt: "2026-09-02", startDate: "2026-10-01" },
    { id: "C-102", name: "Mihai Stan", role: "Full-stack Developer", status: "angajat", appliedAt: "2026-08-11", decidedAt: "2026-09-15", startDate: "2026-10-15" },
    { id: "C-103", name: "Elena Vasile", role: "Backend Developer", status: "angajat", appliedAt: "2026-09-01", decidedAt: "2026-10-03", startDate: "2026-11-03" },
    { id: "C-104", name: "Radu Popa", role: "Frontend Developer", status: "respins", appliedAt: "2026-08-06", decidedAt: "2026-08-29" },
    { id: "C-105", name: "Andreea Ilie", role: "Backend Developer", status: "respins", appliedAt: "2026-09-03", decidedAt: "2026-09-25" },
    { id: "C-106", name: "Vlad Georgescu", role: "Full-stack Developer", status: "în proces", appliedAt: "2026-10-06" },
    { id: "C-107", name: "Bianca Marin", role: "Frontend Developer", status: "în proces", appliedAt: "2026-10-12" },
  ],
  interviews: [
    // Ioana – frontend, angajată
    { id: "I-201", candidateId: "C-101", date: "2026-08-14", stage: "Screening tehnic", interviewer: "Alex Marin", scores: { react: 4, typescript: 2, "async-js": 3, accessibility: 2 }, strengths: ["Componente React curate", "Atenție la UX"], weaknesses: [
      { skill: "typescript", severity: 3, note: "Folosește des `any`; nu a putut tipiza un hook generic." },
      { skill: "accessibility", severity: 2, note: "Formular fără label-uri și fără navigare din tastatură." },
    ] },
    { id: "I-202", candidateId: "C-101", date: "2026-08-21", stage: "Live coding", interviewer: "Dan Rusu", scores: { react: 4, testing: 2, "async-js": 3 }, strengths: ["A explicat bine compromisurile"], weaknesses: [
      { skill: "testing", severity: 2, note: "Nu a scris niciun test; nu cunoaște Testing Library." },
      { skill: "typescript", severity: 2, note: "Tipuri de union discriminat neclare." },
    ] },
    { id: "I-203", candidateId: "C-101", date: "2026-08-28", stage: "Cultural fit", interviewer: "Maria Toma", scores: { communication: 4, git: 3 }, strengths: ["Comunicare deschisă"], weaknesses: [
      { skill: "git", severity: 1, note: "Nu a folosit rebase și nu face code review structurat." },
    ] },
    // Mihai – full-stack, angajat
    { id: "I-211", candidateId: "C-102", date: "2026-08-20", stage: "Screening tehnic", interviewer: "Alex Marin", scores: { "async-js": 4, sql: 2, typescript: 4 }, strengths: ["Node.js solid"], weaknesses: [
      { skill: "sql", severity: 3, note: "JOIN-uri greșite și nu știe când să adauge un index." },
    ] },
    { id: "I-212", candidateId: "C-102", date: "2026-08-29", stage: "System design", interviewer: "Dan Rusu", scores: { "system-design": 2, docker: 2, sql: 2 }, strengths: ["Pune întrebări bune despre cerințe"], weaknesses: [
      { skill: "system-design", severity: 3, note: "Nu a luat în calcul cache-ul și coada de mesaje la scalare." },
      { skill: "sql", severity: 2, note: "Schema nenormalizată, fără constrângeri." },
      { skill: "docker", severity: 2, note: "Nu a mai scris un Dockerfile; deploy doar manual." },
    ] },
    { id: "I-213", candidateId: "C-102", date: "2026-09-08", stage: "Cultural fit", interviewer: "Maria Toma", scores: { communication: 3, "web-security": 2 }, strengths: ["Ownership"], weaknesses: [
      { skill: "web-security", severity: 2, note: "Nu a recunoscut un risc de SQL injection în exemplul dat." },
      { skill: "communication", severity: 1, note: "Explicații prea lungi pentru o audiență non-tehnică." },
    ] },
    // Elena – backend, angajată
    { id: "I-221", candidateId: "C-103", date: "2026-09-10", stage: "Screening tehnic", interviewer: "Dan Rusu", scores: { sql: 5, algorithms: 2, testing: 3 }, strengths: ["SQL foarte bun", "Gândire structurată"], weaknesses: [
      { skill: "algorithms", severity: 2, note: "Soluție O(n²) unde se putea folosi un hash map." },
    ] },
    { id: "I-222", candidateId: "C-103", date: "2026-09-19", stage: "Live coding", interviewer: "Alex Marin", scores: { algorithms: 2, testing: 2, git: 4 }, strengths: ["Commit-uri mici, bine descrise"], weaknesses: [
      { skill: "algorithms", severity: 2, note: "Dificultăți cu recursivitatea pe arbori." },
      { skill: "testing", severity: 2, note: "Testează doar cazul fericit, fără cazuri limită." },
    ] },
    { id: "I-223", candidateId: "C-103", date: "2026-09-29", stage: "System design", interviewer: "Dan Rusu", scores: { "system-design": 3, "web-security": 2, communication: 4 }, strengths: ["Trade-off-uri bine argumentate"], weaknesses: [
      { skill: "web-security", severity: 3, note: "Token-uri stocate fără expirare; fără rate limiting." },
    ] },
    // Respinși – vor fi șterși de jobul de retenție
    { id: "I-231", candidateId: "C-104", date: "2026-08-18", stage: "Screening tehnic", interviewer: "Alex Marin", scores: { react: 2, typescript: 1 }, strengths: [], weaknesses: [{ skill: "react", severity: 3, note: "—" }] },
    { id: "I-232", candidateId: "C-105", date: "2026-09-12", stage: "Screening tehnic", interviewer: "Dan Rusu", scores: { sql: 2 }, strengths: [], weaknesses: [{ skill: "sql", severity: 3, note: "—" }] },
    { id: "I-233", candidateId: "C-105", date: "2026-09-20", stage: "Live coding", interviewer: "Alex Marin", scores: { algorithms: 1 }, strengths: [], weaknesses: [{ skill: "algorithms", severity: 3, note: "—" }] },
    // În proces
    { id: "I-241", candidateId: "C-106", date: "2026-10-14", stage: "Screening tehnic", interviewer: "Alex Marin", scores: { react: 3, sql: 3, docker: 2 }, strengths: ["Experiență cu Next.js"], weaknesses: [
      { skill: "docker", severity: 2, note: "Nu cunoaște multi-stage builds." },
      { skill: "testing", severity: 2, note: "Fără experiență cu teste end-to-end." },
    ] },
    { id: "I-251", candidateId: "C-107", date: "2026-10-20", stage: "Screening tehnic", interviewer: "Dan Rusu", scores: { react: 3, accessibility: 2, "async-js": 2 }, strengths: ["Portofoliu bun"], weaknesses: [
      { skill: "async-js", severity: 2, note: "Confuzie între Promise.all și await în buclă." },
      { skill: "accessibility", severity: 2, note: "Nu folosește atribute ARIA corect." },
    ] },
  ],
  purgeLog: [],
};

function anonRef(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return "anon-" + h.toString(16).padStart(8, "0").slice(-6);
}

// Jobul de retenție: șterge candidații respinși și toate interviurile lor.
export function purgeRejected(db: InterviewDb, now?: Date): InterviewDb {
  const rejected = db.candidates.filter((c) => c.status === "respins");
  if (!rejected.length) return db;
  const ids = new Set(rejected.map((c) => c.id));
  const log: PurgeRecord[] = rejected.map((c) => ({
    ref: anonRef(c.id),
    // Ștergerea are loc la data deciziei de respingere.
    purgedAt: c.decidedAt ?? (now ?? new Date()).toISOString().slice(0, 10),
    interviewsDeleted: db.interviews.filter((i) => i.candidateId === c.id).length,
    reason: "Candidat respins – date de interviu șterse conform politicii de retenție",
  }));
  return {
    candidates: db.candidates.filter((c) => !ids.has(c.id)),
    interviews: db.interviews.filter((i) => !ids.has(i.candidateId)),
    purgeLog: [...log, ...db.purgeLog],
  };
}

export function setCandidateStatus(db: InterviewDb, id: string, status: CandidateStatus, now = new Date()): InterviewDb {
  const today = now.toISOString().slice(0, 10);
  const next: InterviewDb = {
    ...db,
    candidates: db.candidates.map((c) => (c.id === id ? { ...c, status, decidedAt: today, startDate: status === "angajat" ? today : c.startDate } : c)),
  };
  // Respingerea declanșează imediat ștergerea.
  return status === "respins" ? purgeRejected(next, now) : next;
}

export function loadInterviewDb(): InterviewDb {
  return purgeRejected(structuredClone(seed));
}

export type RoadmapStep = {
  skill: SkillId;
  label: string;
  area: string;
  priority: number; // 0–100
  level: "critic" | "important" | "de consolidat";
  avgScore: number | null;
  evidence: { interviewId: string; stage: Interview["stage"]; date: string; note: string }[];
  resources: Resource[];
  hours: number;
  weekStart: number;
  weekEnd: number;
  milestone: string;
};

export type Roadmap = {
  candidate: Candidate;
  interviews: number;
  steps: RoadmapStep[];
  totalWeeks: number;
  bootcamp: (typeof bootcamps)[number] | null;
};

const milestones: Record<SkillId, string> = {
  typescript: "Tipizează complet un modul existent, fără `any`, și trece de `strict: true`.",
  react: "Refactorizează o pagină cu state derivat, fără efecte inutile.",
  "async-js": "Rescrie un flux cu cereri paralele folosind Promise.all și tratarea erorilor.",
  testing: "Adaugă teste unitare și un test end-to-end pentru un flux critic.",
  sql: "Proiectează o schemă normalizată și optimizează o interogare cu EXPLAIN.",
  "system-design": "Prezintă echipei designul unui serviciu, cu cache, coadă și estimări de trafic.",
  algorithms: "Rezolvă 30 de probleme din lista recomandată, cu analiza complexității.",
  git: "Conduce 5 code review-uri folosind ghidul Google.",
  docker: "Containerizează un serviciu cu multi-stage build și îl rulează în CI.",
  "web-security": "Finalizează laboratoarele PortSwigger pentru injection și autentificare.",
  accessibility: "Auditează o pagină cu WCAG și repară problemele găsite.",
  communication: "Scrie un design doc de 1–2 pagini revizuit de un coleg.",
};

// Generează roadmap-ul. Doar pentru angajați.
export function buildRoadmap(db: InterviewDb, candidateId: string, hoursPerWeek = 6): Roadmap | null {
  const candidate = db.candidates.find((c) => c.id === candidateId);
  if (!candidate || candidate.status !== "angajat") return null;
  const interviews = db.interviews.filter((i) => i.candidateId === candidateId);

  const bySkill = new Map<SkillId, { severity: number; count: number; evidence: RoadmapStep["evidence"] }>();
  for (const iv of interviews) {
    for (const w of iv.weaknesses) {
      const cur = bySkill.get(w.skill) ?? { severity: 0, count: 0, evidence: [] };
      cur.severity = Math.max(cur.severity, w.severity);
      cur.count += 1;
      cur.evidence.push({ interviewId: iv.id, stage: iv.stage, date: iv.date, note: w.note });
      bySkill.set(w.skill, cur);
    }
  }

  const scored = [...bySkill.entries()].map(([skill, w]) => {
    const scores = interviews.map((i) => i.scores[skill]).filter((s): s is NonNullable<typeof s> => s != null);
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    // Severitatea cântărește cel mai mult; repetarea în mai multe interviuri și scorul mic urcă prioritatea.
    const priority = Math.min(100, Math.round(w.severity * 22 + (w.count - 1) * 12 + (avg != null ? (5 - avg) * 6 : 6)));
    return { skill, w, avg, priority };
  });
  scored.sort((a, b) => b.priority - a.priority);

  let week = 1;
  const steps: RoadmapStep[] = scored.map(({ skill, w, avg, priority }) => {
    const level: RoadmapStep["level"] = w.severity >= 3 ? "critic" : w.severity === 2 ? "important" : "de consolidat";
    // Gratuite întâi; pentru lipsuri critice adăugăm și un curs plătit, mai structurat.
    const pool = resources[skill];
    const free = pool.filter((r) => r.free).slice(0, level === "de consolidat" ? 2 : 3);
    const paid = level === "critic" ? pool.filter((r) => !r.free).slice(0, 1) : [];
    const picked = [...free, ...paid];
    const hours = picked.reduce((a, r) => a + r.hours, 0);
    const weeks = Math.max(1, Math.ceil(hours / hoursPerWeek));
    const step: RoadmapStep = {
      skill,
      label: skills[skill].label,
      area: skills[skill].area,
      priority,
      level,
      avgScore: avg,
      evidence: w.evidence,
      resources: picked,
      hours,
      weekStart: week,
      weekEnd: week + weeks - 1,
      milestone: milestones[skill],
    };
    week += weeks;
    return step;
  });

  const gaps = new Set(steps.map((s) => s.skill));
  const bootcamp =
    bootcamps
      .map((b) => ({ b, hits: b.covers.filter((s) => gaps.has(s)).length }))
      .filter((x) => x.hits >= 3)
      .sort((a, b) => b.hits - a.hits)[0]?.b ?? null;

  return { candidate, interviews: interviews.length, steps, totalWeeks: week - 1, bootcamp };
}
