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

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: { baseCurrency: true },
  });
  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);

  const entries = await prisma.ledgerEntry.findMany({
    where: {
      journalEntry: {
        companyId,
        date: { gte: yearStart, lte: yearEnd },
      },
    },
    include: { account: true, journalEntry: true },
  });

  let totalRevenue = 0;
  let totalExpenses = 0;
  const cashBalance = new Map<string, number>();

  for (const e of entries) {
    const type = e.account.type ?? "ASSET";
    const amt =
      type === "REVENUE"
        ? (e.credit > 0 ? e.amountInBase : -e.amountInBase)
        : type === "EXPENSE"
          ? (e.debit > 0 ? e.amountInBase : -e.amountInBase)
          : 0;

    if (type === "REVENUE") totalRevenue += amt;
    else if (type === "EXPENSE") totalExpenses += amt;

    if (type === "ASSET" && e.account.code.startsWith("1")) {
      const key = e.accountId;
      const delta = e.debit > 0 ? e.amountInBase : -e.amountInBase;
      cashBalance.set(key, (cashBalance.get(key) ?? 0) + delta);
    }
  }

  const allEntries = await prisma.ledgerEntry.findMany({
    where: { journalEntry: { companyId } },
    include: { account: true },
  });

  const assetBalance = new Map<string, number>();
  const liabilityBalance = new Map<string, number>();
  const equityBalance = new Map<string, number>();

  for (const e of allEntries) {
    const type = e.account.type ?? "ASSET";
    const delta = e.debit > 0 ? e.amountInBase : -e.amountInBase;
    const m =
      type === "ASSET"
        ? assetBalance
        : type === "LIABILITY"
          ? liabilityBalance
          : type === "EQUITY"
            ? equityBalance
            : null;
    if (m) {
      m.set(e.accountId, (m.get(e.accountId) ?? 0) + delta);
    }
  }

  const totalAssets = Array.from(assetBalance.values()).reduce((a, b) => a + b, 0);
  const totalLiabilities = Array.from(liabilityBalance.values()).reduce((a, b) => a + b, 0);
  const totalEquity = Array.from(equityBalance.values()).reduce((a, b) => a + b, 0);
  const cashTotal = Array.from(cashBalance.values()).reduce((a, b) => a + b, 0);

  const journalCount = await prisma.journalEntry.count({
    where: { companyId, date: { gte: yearStart, lte: yearEnd } },
  });

  const monthlyRevenue = new Map<number, number>();
  const monthlyExpenses = new Map<number, number>();
  for (let m = 0; m < 12; m++) {
    monthlyRevenue.set(m, 0);
    monthlyExpenses.set(m, 0);
  }
  for (const e of entries) {
    const type = e.account.type ?? "ASSET";
    const month = new Date(e.journalEntry.date).getMonth();
    const amt =
      type === "REVENUE"
        ? (e.credit > 0 ? e.amountInBase : -e.amountInBase)
        : type === "EXPENSE"
          ? (e.debit > 0 ? e.amountInBase : -e.amountInBase)
          : 0;
    if (type === "REVENUE") {
      monthlyRevenue.set(month, (monthlyRevenue.get(month) ?? 0) + amt);
    } else if (type === "EXPENSE") {
      monthlyExpenses.set(month, (monthlyExpenses.get(month) ?? 0) + amt);
    }
  }

  const monthlyTrend = Array.from({ length: 12 }, (_, m) => ({
    month: m,
    monthName: new Date(now.getFullYear(), m, 1).toLocaleString("default", { month: "short" }),
    revenue: monthlyRevenue.get(m) ?? 0,
    expenses: monthlyExpenses.get(m) ?? 0,
  }));

  const expenseByAccount = new Map<string, { code: string; name: string; amount: number }>();
  for (const e of entries) {
    if ((e.account.type ?? "ASSET") !== "EXPENSE") continue;
    const amt = e.debit > 0 ? e.amountInBase : -e.amountInBase;
    if (!expenseByAccount.has(e.accountId)) {
      expenseByAccount.set(e.accountId, {
        code: e.account.code,
        name: e.account.name,
        amount: 0,
      });
    }
    expenseByAccount.get(e.accountId)!.amount += amt;
  }
  const expensesByCategory = Array.from(expenseByAccount.values())
    .filter((x) => x.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  // Per-account balances for dashboard widget
  const accountBalances = new Map<string, number>();
  for (const e of allEntries) {
    const delta = e.debit > 0 ? e.amountInBase : -e.amountInBase;
    accountBalances.set(e.accountId, (accountBalances.get(e.accountId) ?? 0) + delta);
  }

  const accounts = await prisma.account.findMany({
    where: { companyId },
    include: { currency: true },
    orderBy: [{ type: "asc" }, { code: "asc" }],
  });

  const accountsWithBalances = accounts.map((a) => {
    const type = a.type ?? "ASSET";
    const subType = a.subType;
    const raw = accountBalances.get(a.id) ?? 0;
    // For liability/equity/revenue: normal balance is credit, so positive = credit balance
    const balance =
      type === "LIABILITY" || type === "EQUITY" || type === "REVENUE"
        ? -raw
        : raw;
    return {
      id: a.id,
      code: a.code,
      name: a.name,
      type,
      subType,
      currencyCode: a.currency?.code ?? company.baseCurrency.code,
      balance,
    };
  });

  return NextResponse.json({
    baseCurrency: company.baseCurrency.code,
    ytd: {
      revenue: totalRevenue,
      expenses: totalExpenses,
      netIncome: totalRevenue - totalExpenses,
      journalEntries: journalCount,
    },
    balances: {
      totalAssets,
      totalLiabilities,
      totalEquity,
      cash: cashTotal,
    },
    monthlyTrend,
    expensesByCategory,
    accountsWithBalances,
  });
}
