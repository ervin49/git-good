import { NextResponse } from "next/server";
import { searchProcedures } from "../../../../../ai/processor.mjs";

interface SearchRequest {
  query?: unknown;
  procedures?: unknown;
}

export async function POST(request: Request) {
  let body: SearchRequest;
  try {
    body = (await request.json()) as SearchRequest;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (!query || query.length > 1000) {
    return NextResponse.json({ error: "expected a query (up to 1000 characters)" }, { status: 400 });
  }
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "AI is not configured on the server" }, { status: 503 });
  }
  if (!Array.isArray(body.procedures) || body.procedures.length > 200) {
    return NextResponse.json({ error: "expected up to 200 candidate procedures" }, { status: 400 });
  }

  try {
    const result = await searchProcedures(query, body.procedures as Record<string, unknown>[]);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "AI procedure search failed" }, { status: 502 });
  }
}
