import { connection, type NextRequest, NextResponse } from "next/server";
import { addDomain, listDomains, normalizeDomain, removeDomain } from "@/app/lib/db";

// Same as /api/events: the extension may read this list from a chrome-extension:// origin.
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  await connection(); // always read the database, never a prerendered snapshot
  return NextResponse.json({ domains: await listDomains() }, { headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { domain?: unknown } | null;
  const domain = normalizeDomain(body?.domain);
  if (!domain) {
    return NextResponse.json({ error: "Domeniu invalid. Ex.: app.firma.ro" }, { status: 400, headers: CORS_HEADERS });
  }
  if (!(await addDomain(domain))) {
    return NextResponse.json({ error: "Domeniul este deja în listă." }, { status: 409, headers: CORS_HEADERS });
  }
  return NextResponse.json({ domains: await listDomains() }, { status: 201, headers: CORS_HEADERS });
}

export async function DELETE(request: NextRequest) {
  const domain = normalizeDomain(request.nextUrl.searchParams.get("domain"));
  if (domain) await removeDomain(domain);
  return NextResponse.json({ domains: await listDomains() }, { headers: CORS_HEADERS });
}
