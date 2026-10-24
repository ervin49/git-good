import { NextResponse } from "next/server";
import { aiConfigured, evaluateDraft, generateProcedureDraft } from "../../../../../ai/processor.mjs";
import { listEvents } from "@/app/lib/event-store";
import { notify } from "@/app/lib/notifications";

interface DraftRequest {
  sessionId?: unknown;
  sessionTicketId?: unknown;
  application?: unknown;
  ticket?: unknown;
  capture?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: Request) {
  let body: DraftRequest;
  let rawBody: unknown;
  try {
    rawBody = await request.json();
    body = rawBody as DraftRequest;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const directCapture = isRecord(body.capture)
    ? body.capture
    : (isRecord(rawBody) && rawBody.schema_version === "1.0" ? rawBody : null);
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  if (!directCapture && (!sessionId || sessionId.length > 160)) {
    return NextResponse.json({ error: "expected a valid sessionId or a capture-session.v1 document" }, { status: 400 });
  }
  if (!aiConfigured()) {
    return NextResponse.json({ error: "AI is not configured on the server" }, { status: 503 });
  }

  let input: unknown;
  let knownEvents: unknown[];
  let truncated = false;
  if (directCapture) {
    const steps = Array.isArray(directCapture.steps) ? directCapture.steps : null;
    if (!steps || steps.length === 0 || steps.length > 1000) {
      return NextResponse.json({ error: "capture must contain between 1 and 1000 steps" }, { status: 400 });
    }
    input = directCapture;
    knownEvents = steps;
  } else {
    const stored = listEvents(sessionId);
    if (stored.length === 0) {
      return NextResponse.json({ error: "session not found or has no events" }, { status: 404 });
    }
    const bounded = stored.slice(-1000);
    const timestamps = bounded.map((entry) => {
      const event = isRecord(entry.event) ? entry.event : {};
      const timestamp = typeof event.timestamp === "number" ? event.timestamp : Date.parse(entry.receivedAt);
      return Number.isFinite(timestamp) ? timestamp : 0;
    });
    const start = timestamps.find((timestamp) => timestamp > 0) ?? Date.now();
    const events = bounded.map((entry, index) => {
      const event = isRecord(entry.event) ? entry.event : { kind: "unknown" };
      const timestamp = timestamps[index] || start;
      return {
        seq: index + 1,
        timestamp,
        offsetMs: Math.max(0, timestamp - start),
        initiatedBySeq: typeof event.initiatedBySeq === "number" && Number.isInteger(event.initiatedBySeq) ? event.initiatedBySeq : null,
        event,
      };
    });
    const ticket = isRecord(body.ticket)
      ? {
          ticket_id: typeof body.ticket.ticket_id === "string" ? body.ticket.ticket_id : null,
          title: typeof body.ticket.title === "string" ? body.ticket.title : "",
          description: typeof body.ticket.description === "string" ? body.ticket.description : "",
        }
      : null;
    input = {
      session: {
        session_id: sessionId,
        ticket_id: typeof body.sessionTicketId === "string" ? body.sessionTicketId : null,
        application: typeof body.application === "string" ? body.application : "",
      },
      ticket,
      events,
    };
    knownEvents = events;
    truncated = stored.length > bounded.length;
  }

  try {
    const draft = await generateProcedureDraft(input);
    const quality = evaluateDraft(draft, knownEvents);
    const draftSession = sessionId || (directCapture && isRecord(directCapture.session) && typeof directCapture.session.id === "string" ? directCapture.session.id : "");
    if (draftSession) {
      notify({
        id: `draft:capture:${draftSession}`,
        kind: "draft",
        title: `Ciornă de procedură generată: ${draft.title.slice(0, 100)}`,
        body: `${draft.steps.length} pași · de revizuit înainte de publicare.`,
        href: sessionId ? `/review?sessionId=${encodeURIComponent(sessionId)}` : "/review",
      }, true);
    }
    return NextResponse.json({ draft, quality, truncated });
  } catch {
    return NextResponse.json({ error: "AI draft generation failed" }, { status: 502 });
  }
}



