import { connection, type NextRequest, NextResponse } from "next/server";
import { FirefliesError, getState, isConfigured, listMeetings, syncFireflies } from "@/app/lib/fireflies";

// GET: whether Fireflies is configured, last sync, imported meetings (optionally ?ticket=SUP-142).
export async function GET(request: NextRequest) {
  await connection();
  const ticket = request.nextUrl.searchParams.get("ticket") ?? undefined;
  return NextResponse.json({ configured: isConfigured(), ...getState(), meetings: listMeetings(ticket) });
}

interface SyncBody {
  days?: unknown;
  keyword?: unknown;
  onlyWithTicket?: unknown;
}

// POST: import transcripts from the last N days (default 14).
export async function POST(request: NextRequest) {
  const body = ((await request.json().catch(() => null)) ?? {}) as SyncBody;
  const days = typeof body.days === "number" && body.days > 0 ? Math.min(body.days, 365) : 14;
  const keyword = typeof body.keyword === "string" && body.keyword.trim() ? body.keyword.trim() : undefined;
  try {
    const result = await syncFireflies({
      fromDate: new Date(Date.now() - days * 86_400_000).toISOString(),
      keyword,
      onlyWithTicket: body.onlyWithTicket !== false,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof FirefliesError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Importul din Fireflies a eșuat." }, { status: 500 });
  }
}
