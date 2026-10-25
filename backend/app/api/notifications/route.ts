import { connection, type NextRequest, NextResponse } from "next/server";
import { clearNotifications, listNotifications, markRead } from "@/app/lib/notifications";

// GET: latest notifications + unread count (the bell in the frontend header polls this).
export async function GET() {
  await connection();
  return NextResponse.json(await listNotifications());
}

// POST { id? }: mark one notification (or, without id, all of them) as read.
export async function POST(request: NextRequest) {
  const body = ((await request.json().catch(() => null)) ?? {}) as { id?: unknown };
  await markRead(typeof body.id === "string" ? body.id : undefined);
  return NextResponse.json(await listNotifications());
}

// DELETE: remove all notifications.
export async function DELETE() {
  await clearNotifications();
  return NextResponse.json(await listNotifications());
}
