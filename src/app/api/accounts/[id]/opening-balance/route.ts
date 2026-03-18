import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getOrCreateOpeningBalanceEquity(companyId: string, baseCurrencyId: string) {
  let obe = await prisma.account.findFirst({
    where: {
      companyId,
      isSystem: true,
      name: "Opening Balance Equity",
    },
  });
  if (!obe) {
    const existingCodes = await prisma.account.findMany({
      where: { companyId },
      select: { code: true },
    });
    const usedCodes = new Set(existingCodes.map((a) => a.code));
    const code = usedCodes.has("OBE") ? "3000-OBE" : "OBE";
    obe = await prisma.account.create({
      data: {
        companyId,
        code,
        name: "Opening Balance Equity",
        type: "EQUITY",
        currencyId: baseCurrencyId,
        isSystem: true,
      },
    });
  }
  return obe;
}

export async function POST(
  req: Request,
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

  const { id: accountId } = await params;
  const body = await req.json();
  const { amount, date } = body as { amount?: number; date?: string };

  if (amount == null || amount === 0 || !date) {
    return NextResponse.json(
      { error: "Amount and date are required. Amount must be non-zero." },
      { status: 400 }
    );
  }

  const account = await prisma.account.findFirst({
    where: { id: accountId, companyId },
  });
  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }
  if (account.isSystem) {
    return NextResponse.json(
      { error: "Cannot add opening balance to system accounts" },
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

  const obe = await getOrCreateOpeningBalanceEquity(companyId, company.baseCurrencyId);
  const currencyId = account.currencyId ?? company.baseCurrencyId;

  const entryDate = new Date(date);
  entryDate.setHours(0, 0, 0, 0);

  const absAmount = Math.abs(Number(amount));
  const isPositive = amount > 0;

  // ASSET/EXPENSE: positive = debit account. LIABILITY/EQUITY/REVENUE: positive = credit account
  const accountNormalDebit = ["ASSET", "EXPENSE"].includes(account.type);
  let accountDebit = 0;
  let accountCredit = 0;
  let obeDebit = 0;
  let obeCredit = 0;

  if (accountNormalDebit && isPositive) {
    accountDebit = absAmount;
    obeCredit = absAmount;
  } else if (accountNormalDebit && !isPositive) {
    accountCredit = absAmount;
    obeDebit = absAmount;
  } else if (!accountNormalDebit && isPositive) {
    accountCredit = absAmount;
    obeDebit = absAmount;
  } else {
    accountDebit = absAmount;
    obeCredit = absAmount;
  }

  const journalEntry = await prisma.$transaction(async (tx) => {
    const je = await tx.journalEntry.create({
      data: {
        companyId,
        date: entryDate,
        description: `Opening balance - ${account.name}`,
        reference: "OB",
      },
    });

    await tx.ledgerEntry.create({
      data: {
        journalEntryId: je.id,
        accountId: account.id,
        debit: accountDebit,
        credit: accountCredit,
        currencyId,
        amountInBase: absAmount,
      },
    });
    await tx.ledgerEntry.create({
      data: {
        journalEntryId: je.id,
        accountId: obe.id,
        debit: obeDebit,
        credit: obeCredit,
        currencyId: company.baseCurrencyId,
        amountInBase: absAmount,
      },
    });

    return je;
  });

  return NextResponse.json({
    success: true,
    journalEntryId: journalEntry.id,
    message: "Opening balance added",
  });
}
