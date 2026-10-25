import { connection, type NextRequest, NextResponse } from "next/server";
import { notify } from "@/app/lib/notifications";
import { approveProcedure, listProcedures, type SourceType } from "@/app/lib/procedures";

// GET: procedures approved by a person (the library and search read these).
export async function GET() {
  await connection();
  return NextResponse.json({ procedures: await listProcedures() });
}

interface ApproveBody {
  sourceType?: unknown;
  sourceId?: unknown;
  approvedBy?: unknown;
  keepOrders?: unknown;
  draft?: {
    title?: unknown;
    session_summary?: unknown;
    steps?: unknown;
    outcome?: { text?: unknown } | null;
    ticket_link?: { ticket_id?: unknown };
  };
  groundingScore?: unknown;
}

const SOURCES: SourceType[] = ["capture", "meeting", "teams"];

// POST: a reviewer approves an AI draft; the kept steps become "Confirmat" with their name.
export async function POST(request: NextRequest) {
  const body = ((await request.json().catch(() => null)) ?? {}) as ApproveBody;
  const draft = body.draft;
  if (!draft || !Array.isArray(draft.steps)) return NextResponse.json({ error: "Lipsește ciorna de aprobat." }, { status: 400 });
  const sourceType = SOURCES.includes(body.sourceType as SourceType) ? (body.sourceType as SourceType) : "capture";
  try {
    const procedure = await approveProcedure({
      sourceType,
      sourceId: typeof body.sourceId === "string" ? body.sourceId : "",
      approvedBy: typeof body.approvedBy === "string" ? body.approvedBy : "",
      title: draft.title,
      summary: draft.session_summary,
      ticketId: draft.ticket_link?.ticket_id,
      steps: draft.steps.slice(0, 100),
      keepOrders: Array.isArray(body.keepOrders) ? body.keepOrders.filter((n): n is number => Number.isInteger(n)) : null,
      outcome: draft.outcome?.text,
      groundingScore: body.groundingScore,
    });
    await notify({
      id: `approved:${procedure.id}`,
      kind: "draft",
      title: `Procedură aprobată: ${procedure.title.slice(0, 100)}`,
      body: `${procedure.steps.length} pași confirmați de ${procedure.approved_by}${procedure.ticket_id ? ` · ${procedure.ticket_id}` : ""}.`,
      href: `/procedures/${procedure.id}`,
    });
    return NextResponse.json({ procedure }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Aprobarea a eșuat." }, { status: 400 });
  }
}
