import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const companyId = (session.user as { companyId?: string }).companyId;
  if (!companyId) {
    return NextResponse.json({ error: "No company" }, { status: 404 });
  }

  const { id } = await params;

  const entry = await prisma.journalEntry.findFirst({
    where: { id, companyId },
  });

  if (!entry) {
    return NextResponse.json({ error: "Journal entry not found" }, { status: 404 });
  }

  await prisma.journalEntry.delete({ where: { id } });

  return NextResponse.json({ deleted: true });
}
