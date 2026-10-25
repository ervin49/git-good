// Procedures approved by a person in the review screen. Only these are "Confirmat": the AI drafts
// stay "Deducție AI"/"Observat" until someone approves them here.
import { randomUUID } from "node:crypto";
import { confirmClaim } from "../../../ai/processor.mjs";
import { db } from "@/app/lib/db";
import { redactDeep } from "@/app/lib/redact";

export type SourceType = "capture" | "meeting" | "teams";

export interface ApprovedStep {
  order: number;
  instruction: string;
  status: string;
  reason: string;
  evidence_seq: number[];
  confirmed_by: string;
  confirmed_at: string;
}

export interface ApprovedProcedure {
  id: string;
  title: string;
  summary: string;
  ticket_id: string | null;
  source_type: SourceType;
  source_id: string;
  steps: ApprovedStep[];
  outcome: string | null;
  grounding_score: number | null;
  approved_by: string;
  approved_at: string;
}

db.exec(`
  CREATE TABLE IF NOT EXISTS procedures (
    id              TEXT PRIMARY KEY,
    title           TEXT NOT NULL,
    summary         TEXT NOT NULL DEFAULT '',
    ticket_id       TEXT,
    source_type     TEXT NOT NULL,
    source_id       TEXT NOT NULL,
    steps           TEXT NOT NULL,
    outcome         TEXT,
    grounding_score REAL,
    approved_by     TEXT NOT NULL,
    approved_at     TEXT NOT NULL
  );
`);

function str(value: unknown, max: number): string {
  return String(redactDeep(String(value ?? "").slice(0, max)) ?? "").trim();
}

interface DraftStepInput {
  order?: unknown;
  instruction?: unknown;
  evidence_seq?: unknown;
}

export interface ApproveInput {
  sourceType: SourceType;
  sourceId: string;
  approvedBy: string;
  title: unknown;
  summary: unknown;
  ticketId: unknown;
  steps: DraftStepInput[];
  keepOrders: number[] | null; // steps the reviewer kept; null = all
  outcome: unknown;
  groundingScore: unknown;
}

export function approveProcedure(input: ApproveInput): ApprovedProcedure {
  const reviewer = str(input.approvedBy, 80);
  if (!reviewer) throw new Error("Scrie numele persoanei care aprobă.");
  const kept = input.steps
    .map((step, index) => ({ step, order: Number.isInteger(step.order) ? Number(step.order) : index + 1 }))
    .filter(({ order }) => !input.keepOrders || input.keepOrders.includes(order));
  if (kept.length === 0) throw new Error("Păstrează cel puțin un pas ca să aprobi procedura.");

  // A person confirms each kept step; this is the only place a step becomes "Confirmat".
  const steps: ApprovedStep[] = kept.map(({ step }, index) => {
    const confirmed = confirmClaim({
      order: index + 1,
      instruction: str(step.instruction, 600),
      evidence_seq: Array.isArray(step.evidence_seq) ? step.evidence_seq.filter((n): n is number => Number.isInteger(n)).slice(0, 20) : [],
    }, reviewer) as Omit<ApprovedStep, "reason">;
    return { ...confirmed, reason: `Confirmat de ${reviewer}.` };
  });

  const procedure: ApprovedProcedure = {
    id: `PR-${randomUUID().slice(0, 8).toUpperCase()}`,
    title: str(input.title, 200) || "Procedură aprobată",
    summary: str(input.summary, 1000),
    ticket_id: typeof input.ticketId === "string" && input.ticketId.trim() ? str(input.ticketId, 60) : null,
    source_type: input.sourceType,
    source_id: str(input.sourceId, 160),
    steps,
    outcome: input.outcome ? str(input.outcome, 600) : null,
    grounding_score: typeof input.groundingScore === "number" && Number.isFinite(input.groundingScore) ? input.groundingScore : null,
    approved_by: reviewer,
    approved_at: new Date().toISOString(),
  };
  db.prepare(`
    INSERT INTO procedures (id, title, summary, ticket_id, source_type, source_id, steps, outcome, grounding_score, approved_by, approved_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(procedure.id, procedure.title, procedure.summary, procedure.ticket_id, procedure.source_type, procedure.source_id,
    JSON.stringify(procedure.steps), procedure.outcome, procedure.grounding_score, procedure.approved_by, procedure.approved_at);
  return procedure;
}

interface ProcedureRow extends Omit<ApprovedProcedure, "steps"> {
  steps: string;
}

const fromRow = (row: ProcedureRow): ApprovedProcedure => ({ ...row, steps: JSON.parse(row.steps) as ApprovedStep[] });

export function listProcedures(): ApprovedProcedure[] {
  return (db.prepare("SELECT * FROM procedures ORDER BY approved_at DESC").all() as unknown as ProcedureRow[]).map(fromRow);
}

export function getProcedure(id: string): ApprovedProcedure | null {
  const row = db.prepare("SELECT * FROM procedures WHERE id = ?").get(id) as unknown as ProcedureRow | undefined;
  return row ? fromRow(row) : null;
}

export function deleteProcedure(id: string): boolean {
  return db.prepare("DELETE FROM procedures WHERE id = ?").run(id).changes > 0;
}
