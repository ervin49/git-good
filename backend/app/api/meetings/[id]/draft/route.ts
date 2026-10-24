import { connection, type NextRequest, NextResponse } from "next/server";
import { evaluateDraft, generateProcedureDraft } from "../../../../../../ai/processor.mjs";
import { getMeeting, listDrafts, meetingToCapture, saveDraft } from "@/app/lib/fireflies";

type Context = { params: Promise<{ id: string }> };

// GET: procedure drafts already generated from this meeting.
export async function GET(_request: NextRequest, { params }: Context) {
  await connection();
  const id = (await params).id;
  if (!getMeeting(id)) return NextResponse.json({ error: "Ședința nu există." }, { status: 404 });
  return NextResponse.json({ drafts: listDrafts(id) });
}

// POST { ticketId? }: turn the meeting transcript into a step-by-step procedure draft.
export async function POST(request: NextRequest, { params }: Context) {
  const meeting = getMeeting((await params).id);
  if (!meeting) return NextResponse.json({ error: "Ședința nu există." }, { status: 404 });
  if (meeting.sentences.length === 0) return NextResponse.json({ error: "Ședința nu are transcriere." }, { status: 400 });
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "AI is not configured on the server" }, { status: 503 });

  const body = ((await request.json().catch(() => null)) ?? {}) as { ticketId?: unknown };
  const requested = typeof body.ticketId === "string" ? body.ticketId : null;
  const ticketId = requested && meeting.ticket_ids.includes(requested) ? requested : (meeting.ticket_ids[0] ?? null);

  const capture = meetingToCapture(meeting, ticketId);
  try {
    const draft = await generateProcedureDraft(capture);
    const quality = evaluateDraft(draft, capture.steps);
    const stored = saveDraft(meeting.id, ticketId, draft, quality);
    return NextResponse.json({ ...stored, truncated: meeting.sentences.length > capture.steps.length });
  } catch (error) {
    // Surface the provider's reason (e.g. "OpenAI API 429: no credits"), never anything that looks like a key.
    const reason = (error instanceof Error ? error.message : String(error)).replace(/sk-[A-Za-z0-9_-]+/g, "sk-***").slice(0, 300);
    return NextResponse.json({ error: `Generarea procedurii din ședință a eșuat: ${reason}` }, { status: 502 });
  }
}
