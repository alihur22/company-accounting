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
    return NextResponse.json(
      { error: "accountId is required" },
      { status: 400 }
    );
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
    orderBy: [
      { journalEntry: { date: "asc" } },
      { journalEntry: { createdAt: "asc" } },
    ],
  });

  let runningBalance = 0;
  const rows = ledgerEntries.map((le) => {
    const debit = le.debit;
    const credit = le.credit;
    const net = debit - credit;
    runningBalance += net;
    return {
      id: le.id,
      date: le.journalEntry.date,
      description: le.journalEntry.description,
      reference: le.journalEntry.reference,
      debit,
      credit,
      balance: runningBalance,
      currency: le.currency.code,
    };
  });

  return NextResponse.json({
    account: { id: account.id, code: account.code, name: account.name },
    entries: rows,
  });
}
