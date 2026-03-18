import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRateToBase } from "@/lib/exchange-rates";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const companyId = (session.user as { companyId?: string }).companyId;
  if (!companyId) {
    return NextResponse.json({ error: "No company" }, { status: 404 });
  }

  const journalEntries = await prisma.journalEntry.findMany({
    where: { companyId },
    include: {
      ledgerEntries: {
        include: { account: true, currency: true },
      },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(journalEntries);
}

type LineInput = {
  accountId: string;
  debit: number;
  credit: number;
  currencyId: string;
};

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
  const { date, description, reference, lines } = body as {
    date: string;
    description?: string;
    reference?: string;
    lines: LineInput[];
  };

  if (!date || !lines || !Array.isArray(lines) || lines.length < 2) {
    return NextResponse.json(
      { error: "Date and at least 2 lines are required" },
      { status: 400 }
    );
  }

  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    return NextResponse.json(
      { error: "Debits must equal credits" },
      { status: 400 }
    );
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: { baseCurrency: true },
  });
  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  const entryDate = new Date(date);
  entryDate.setHours(0, 0, 0, 0);

  const accountIds = lines.map((l) => l.accountId);
  const accounts = await prisma.account.findMany({
    where: { id: { in: accountIds }, companyId },
  });
  if (accounts.length !== accountIds.length) {
    return NextResponse.json(
      { error: "All accounts must belong to your company" },
      { status: 400 }
    );
  }

  const currencyIds = [...new Set(lines.map((l) => l.currencyId))];
  const currencies = await prisma.currency.findMany({
    where: { id: { in: currencyIds } },
  });
  if (currencies.length !== currencyIds.length) {
    return NextResponse.json(
      { error: "Invalid currency" },
      { status: 400 }
    );
  }

  const journalEntry = await prisma.$transaction(async (tx) => {
    const je = await tx.journalEntry.create({
      data: {
        companyId,
        date: entryDate,
        description: description || null,
        reference: reference || null,
      },
    });

    for (const line of lines) {
      const debit = Number(line.debit) || 0;
      const credit = Number(line.credit) || 0;
      if (debit <= 0 && credit <= 0) continue;

      const amount = debit > 0 ? debit : credit;
      const rateToBase = await getRateToBase(
        line.currencyId,
        entryDate,
        company.baseCurrencyId
      );
      const amountInBase = amount * rateToBase;

      await tx.ledgerEntry.create({
        data: {
          journalEntryId: je.id,
          accountId: line.accountId,
          debit: debit > 0 ? debit : 0,
          credit: credit > 0 ? credit : 0,
          currencyId: line.currencyId,
          amountInBase,
        },
      });
    }

    return tx.journalEntry.findUniqueOrThrow({
      where: { id: je.id },
      include: {
        ledgerEntries: {
          include: { account: true, currency: true },
        },
      },
    });
  });

  return NextResponse.json(journalEntry);
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const companyId = (session.user as { companyId?: string }).companyId;
  if (!companyId) {
    return NextResponse.json({ error: "No company" }, { status: 404 });
  }

  const body = await req.json();
  const { ids } = body as { ids?: string[] };

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json(
      { error: "ids array required" },
      { status: 400 }
    );
  }

  const entries = await prisma.journalEntry.findMany({
    where: { id: { in: ids }, companyId },
  });

  await prisma.journalEntry.deleteMany({
    where: { id: { in: entries.map((e) => e.id) } },
  });

  return NextResponse.json({ deleted: entries.length });
}
