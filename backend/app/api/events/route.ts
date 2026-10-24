import { type NextRequest, NextResponse } from "next/server";
import { addEvents, clearEvents, listEvents } from "@/app/lib/event-store";
import { redactDeep } from "@/app/lib/redact";

// The extension sends from a chrome-extension:// origin, so CORS must allow it.
// For a local dev backend we allow any origin; lock this down for production.
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

interface IncomingBatch {
  sessionId?: unknown;
  sentAt?: unknown;
  origin?: unknown;
  events?: unknown;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  let body: IncomingBatch;
  try {
    body = (await request.json()) as IncomingBatch;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400, headers: CORS_HEADERS });
  }

  const sessionId = typeof body.sessionId === "string" ? body.sessionId : null;
  const events = Array.isArray(body.events) ? body.events : null;
  if (!sessionId || !events) {
    return NextResponse.json(
      { error: "expected { sessionId: string, events: array }" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const origin = typeof body.origin === "string" ? body.origin : undefined;
  const receivedAt = new Date().toISOString();

  // Redact again server-side before storing — never trust the client.
  const entries = events.map((event) => ({
    receivedAt,
    sessionId,
    origin,
    event: redactDeep(event),
  }));
  addEvents(entries);

  return NextResponse.json({ ok: true, stored: entries.length }, { headers: CORS_HEADERS });
}

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("sessionId") ?? undefined;
  return NextResponse.json({ events: listEvents(sessionId) }, { headers: CORS_HEADERS });
}

export async function DELETE() {
  clearEvents();
  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}
