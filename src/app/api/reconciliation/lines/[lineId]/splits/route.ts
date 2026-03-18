import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ lineId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const companyId = (session.user as { companyId?: string }).companyId;
  if (!companyId) {
    return NextResponse.json({ error: "No company" }, { status: 404 });
  }

  const { lineId } = await params;
  const body = await req.json();
  const { amount, ledgerEntryId } = body as { amount: number; ledgerEntryId: string };

  if (typeof amount !== "number" || !ledgerEntryId) {
    return NextResponse.json(
      { error: "amount and ledgerEntryId required" },
      { status: 400 }
    );
  }

  const line = await prisma.bankStatementLine.findFirst({
    where: {
      id: lineId,
      bankStatement: { companyId },
    },
    include: { splits: true },
  });

  if (!line) {
    return NextResponse.json({ error: "Line not found" }, { status: 404 });
  }

  const ledgerEntry = await prisma.ledgerEntry.findFirst({
    where: {
      id: ledgerEntryId,
      journalEntry: { companyId },
    },
  });

  if (!ledgerEntry) {
    return NextResponse.json({ error: "Ledger entry not found" }, { status: 404 });
  }

  const currentTotal = line.splits.reduce((s, sp) => s + sp.amount, 0);
  const newTotal = currentTotal + amount;
  if (Math.abs(newTotal) > Math.abs(line.amount) + 0.01) {
    return NextResponse.json(
      { error: "Split total cannot exceed line amount" },
      { status: 400 }
    );
  }

  await prisma.$transaction([
    prisma.bankStatementLineSplit.create({
      data: {
        bankStatementLineId: lineId,
        amount,
        ledgerEntryId,
      },
    }),
    prisma.bankStatementLine.update({
      where: { id: lineId },
      data: { ledgerEntryId: null },
    }),
  ]);

  return NextResponse.json({ success: true });
}
