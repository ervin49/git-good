import { connection, NextResponse } from "next/server";
import { deleteMeeting, getMeeting } from "@/app/lib/fireflies";

type Context = { params: Promise<{ id: string }> };

// GET: one imported meeting with its (redacted) transcript sentences.
export async function GET(_request: Request, { params }: Context) {
  await connection();
  const meeting = await getMeeting((await params).id);
  if (!meeting) return NextResponse.json({ error: "Ședința nu există." }, { status: 404 });
  return NextResponse.json({ meeting });
}

// DELETE: remove the meeting and its transcript from the local database.
export async function DELETE(_request: Request, { params }: Context) {
  const removed = await deleteMeeting((await params).id);
  if (!removed) return NextResponse.json({ error: "Ședința nu există." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
