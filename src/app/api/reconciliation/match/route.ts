import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const companyId = (session.user as { companyId?: string }).companyId;
  if (!companyId) {
    return NextResponse.json({ error: "No company" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get("accountId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!accountId) {
    return NextResponse.json({ error: "accountId required" }, { status: 400 });
  }

  const account = await prisma.account.findFirst({
    where: { id: accountId, companyId },
  });
  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (from) {
    const d = new Date(from);
    d.setHours(0, 0, 0, 0);
    dateFilter.gte = d;
  }
  if (to) {
    const d = new Date(to);
    d.setHours(23, 59, 59, 999);
    dateFilter.lte = d;
  }

  const ledgerEntries = await prisma.ledgerEntry.findMany({
    where: {
      accountId,
      journalEntry: {
        companyId,
        ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}),
      },
    },
    include: {
      journalEntry: true,
      currency: true,
    },
    orderBy: [{ journalEntry: { date: "asc" } }],
  });

  const unmatched = ledgerEntries.map((le) => ({
    id: le.id,
    date: le.journalEntry.date,
    description: le.journalEntry.description,
    reference: le.journalEntry.reference,
    debit: le.debit,
    credit: le.credit,
    amount: le.debit - le.credit,
    currency: le.currency.code,
  }));

  return NextResponse.json({ ledgerEntries: unmatched });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const companyId = (session.user as { companyId?: string }).companyId;
  if (!companyId) {
    return NextResponse.json({ error: "No company" }, { status: 404 });
  }

  const body = await req.json();
  const { bankLineId, ledgerEntryId } = body as {
    bankLineId?: string;
    ledgerEntryId?: string;
  };

  if (!bankLineId) {
    return NextResponse.json({ error: "bankLineId required" }, { status: 400 });
  }

  const bankLine = await prisma.bankStatementLine.findFirst({
    where: {
      id: bankLineId,
      bankStatement: { companyId },
    },
  });

  if (!bankLine) {
    return NextResponse.json({ error: "Bank line not found" }, { status: 404 });
  }

  if (ledgerEntryId) {
    const le = await prisma.ledgerEntry.findFirst({
      where: {
        id: ledgerEntryId,
        journalEntry: { companyId },
      },
    });
    if (!le) {
      return NextResponse.json({ error: "Ledger entry not found" }, { status: 404 });
    }
  }

  await prisma.bankStatementLine.update({
    where: { id: bankLineId },
    data: { ledgerEntryId: ledgerEntryId || null },
  });

  return NextResponse.json({ success: true });
}
