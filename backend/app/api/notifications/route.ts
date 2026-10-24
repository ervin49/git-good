import { connection, type NextRequest, NextResponse } from "next/server";
import { clearNotifications, listNotifications, markRead } from "@/app/lib/notifications";

// GET: latest notifications + unread count (the bell in the frontend header polls this).
export async function GET() {
  await connection();
  return NextResponse.json(listNotifications());
}

// POST { id? }: mark one notification (or, without id, all of them) as read.
export async function POST(request: NextRequest) {
  const body = ((await request.json().catch(() => null)) ?? {}) as { id?: unknown };
  markRead(typeof body.id === "string" ? body.id : undefined);
  return NextResponse.json(listNotifications());
}

// DELETE: remove all notifications.
export async function DELETE() {
  clearNotifications();
  return NextResponse.json(listNotifications());
}
