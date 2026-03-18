import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ lineId: string; splitId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const companyId = (session.user as { companyId?: string }).companyId;
  if (!companyId) {
    return NextResponse.json({ error: "No company" }, { status: 404 });
  }

  const { lineId, splitId } = await params;

  const split = await prisma.bankStatementLineSplit.findFirst({
    where: {
      id: splitId,
      bankStatementLineId: lineId,
      bankStatementLine: { bankStatement: { companyId } },
    },
  });

  if (!split) {
    return NextResponse.json({ error: "Split not found" }, { status: 404 });
  }

  await prisma.bankStatementLineSplit.delete({
    where: { id: splitId },
  });

  return NextResponse.json({ success: true });
}
