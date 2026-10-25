import { connection, NextResponse } from "next/server";
import { deleteProcedure, getProcedure } from "@/app/lib/procedures";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  await connection();
  const procedure = await getProcedure((await params).id);
  if (!procedure) return NextResponse.json({ error: "Procedura nu există." }, { status: 404 });
  return NextResponse.json({ procedure });
}

// DELETE: withdraw an approved procedure from the library.
export async function DELETE(_request: Request, { params }: Context) {
  if (!(await deleteProcedure((await params).id))) return NextResponse.json({ error: "Procedura nu există." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
