import { type NextRequest, NextResponse } from "next/server";
import { aiConfigured, evaluateDraft, generateProcedureDraft } from "../../../../../ai/processor.mjs";
import { getMeeting, meetingToCapture, saveDraft } from "@/app/lib/fireflies";
import { notify } from "@/app/lib/notifications";
import { findTicketIds, parseTeamsTranscript, saveTeamsConversation } from "@/app/lib/teams";

interface AnalyzeBody {
  text?: unknown;
  ticketId?: unknown;
  title?: unknown;
}

// POST { text, ticketId?, title? }: a Teams conversation (pasted) → stored, redacted messages →
// AI procedure draft whose steps cite the messages they come from.
export async function POST(request: NextRequest) {
  const body = ((await request.json().catch(() => null)) ?? {}) as AnalyzeBody;
  const text = typeof body.text === "string" ? body.text : "";
  const messages = parseTeamsTranscript(text);
  if (messages.length === 0) return NextResponse.json({ error: "Lipește cel puțin un mesaj din conversație." }, { status: 400 });
  if (!aiConfigured()) return NextResponse.json({ error: "AI is not configured on the server" }, { status: 503 });

  const requested = typeof body.ticketId === "string" && /^[A-Z][A-Z0-9]{1,9}-\d{1,7}$/.test(body.ticketId.trim()) ? body.ticketId.trim() : null;
  // A ticket named in the conversation wins; the page's ticket is only a fallback.
  const ticketIds = [...new Set([...findTicketIds(text), ...(requested ? [requested] : [])])];
  const ticketId = ticketIds[0] ?? null;
  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : `Conversație Teams${ticketId ? ` – ${ticketId}` : ""}`;

  const id = saveTeamsConversation(title, messages, ticketIds);
  const meeting = getMeeting(id);
  if (!meeting) return NextResponse.json({ error: "Conversația nu a putut fi salvată." }, { status: 500 });
  const capture = meetingToCapture(meeting, ticketId, `Conversație Teams – ${meeting.title}`);
  try {
    const draft = await generateProcedureDraft(capture);
    const quality = evaluateDraft(draft, capture.steps);
    const stored = saveDraft(id, ticketId, draft, quality);
    notify({
      id: `draft:meeting:${id}`,
      kind: "draft",
      title: `Procedură generată din conversația Teams${ticketId ? ` (${ticketId})` : ""}`,
      body: `${draft.steps.length} pași din ${messages.length} mesaje · de revizuit înainte de publicare.`,
      href: "/review",
    }, true);
    return NextResponse.json({ ...stored, conversation_id: id, ticket_id: ticketId, messages });
  } catch (error) {
    const reason = (error instanceof Error ? error.message : String(error)).replace(/sk-[A-Za-z0-9_-]+/g, "sk-***").slice(0, 300);
    return NextResponse.json({ error: `Analiza conversației a eșuat: ${reason}` }, { status: 502 });
  }
}
