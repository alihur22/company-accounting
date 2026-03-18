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
  const report = searchParams.get("report"); // trial-balance | pl | balance-sheet
  const asOf = searchParams.get("asOf");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: { baseCurrency: true },
  });
  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  const baseCurrency = company.baseCurrency;

  if (report === "trial-balance") {
    const asOfDate = asOf ? new Date(asOf) : new Date();
    asOfDate.setHours(23, 59, 59, 999);

    const entries = await prisma.ledgerEntry.findMany({
      where: {
        journalEntry: {
          companyId,
          date: { lte: asOfDate },
        },
      },
      include: { account: true },
    });

    const byAccount = new Map<
      string,
      { code: string; name: string; type: string; debit: number; credit: number }
    >();

    for (const e of entries) {
      const key = e.accountId;
      if (!byAccount.has(key)) {
        byAccount.set(key, {
          code: e.account.code,
          name: e.account.name,
          type: e.account.type ?? "ASSET",
          debit: 0,
          credit: 0,
        });
      }
      const row = byAccount.get(key)!;
      if (e.debit > 0) row.debit += e.amountInBase;
      else row.credit += e.amountInBase;
    }

    const rows = Array.from(byAccount.entries())
      .map(([_, v]) => v)
      .filter((r) => r.debit !== 0 || r.credit !== 0)
      .sort((a, b) => a.type.localeCompare(b.type) || a.code.localeCompare(b.code));

    const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
    const totalCredit = rows.reduce((s, r) => s + r.credit, 0);

    return NextResponse.json({
      report: "trial-balance",
      asOf: asOfDate.toISOString(),
      baseCurrency: baseCurrency.code,
      rows,
      totalDebit,
      totalCredit,
    });
  }

  if (report === "pl" || report === "income-statement") {
    const fromDate = from ? new Date(from) : new Date(new Date().getFullYear(), 0, 1);
    const toDate = to ? new Date(to) : new Date();
    fromDate.setHours(0, 0, 0, 0);
    toDate.setHours(23, 59, 59, 999);

    const entries = await prisma.ledgerEntry.findMany({
      where: {
        journalEntry: {
          companyId,
          date: { gte: fromDate, lte: toDate },
        },
      },
      include: { account: true },
    });

    const revenueByAccount = new Map<string, { code: string; name: string; amount: number }>();
    const expenseByAccount = new Map<string, { code: string; name: string; amount: number }>();

    for (const e of entries) {
      const type = e.account.type ?? "ASSET";
      if (type !== "REVENUE" && type !== "EXPENSE") continue;
      const amt =
        type === "REVENUE"
          ? (e.credit > 0 ? e.amountInBase : -e.amountInBase)
          : (e.debit > 0 ? e.amountInBase : -e.amountInBase);
      if (type === "REVENUE") {
        if (!revenueByAccount.has(e.accountId)) {
          revenueByAccount.set(e.accountId, {
            code: e.account.code,
            name: e.account.name,
            amount: 0,
          });
        }
        revenueByAccount.get(e.accountId)!.amount += amt;
      } else {
        if (!expenseByAccount.has(e.accountId)) {
          expenseByAccount.set(e.accountId, {
            code: e.account.code,
            name: e.account.name,
            amount: 0,
          });
        }
        expenseByAccount.get(e.accountId)!.amount += amt;
      }
    }

    const revenue = Array.from(revenueByAccount.values()).sort((a, b) =>
      a.code.localeCompare(b.code)
    );
    const expenses = Array.from(expenseByAccount.values()).sort((a, b) =>
      a.code.localeCompare(b.code)
    );
    const totalRevenue = revenue.reduce((s, r) => s + r.amount, 0);
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const netIncome = totalRevenue - totalExpenses;

    return NextResponse.json({
      report: "pl",
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      baseCurrency: baseCurrency.code,
      revenue,
      expenses,
      totalRevenue,
      totalExpenses,
      netIncome,
    });
  }

  if (report === "balance-sheet") {
    const asOfDate = asOf ? new Date(asOf) : new Date();
    asOfDate.setHours(23, 59, 59, 999);

    const entries = await prisma.ledgerEntry.findMany({
      where: {
        journalEntry: {
          companyId,
          date: { lte: asOfDate },
        },
      },
      include: { account: true },
    });

    const byType = {
      ASSET: new Map<string, { code: string; name: string; amount: number }>(),
      LIABILITY: new Map<string, { code: string; name: string; amount: number }>(),
      EQUITY: new Map<string, { code: string; name: string; amount: number }>(),
    };

    for (const e of entries) {
      const type = e.account.type ?? "ASSET";
      if (type !== "ASSET" && type !== "LIABILITY" && type !== "EQUITY") continue;
      const amt = e.debit > 0 ? e.amountInBase : -e.amountInBase;
      const m = byType[type as keyof typeof byType];
      if (!m) continue;
      if (!m.has(e.accountId)) {
        m.set(e.accountId, {
          code: e.account.code,
          name: e.account.name,
          amount: 0,
        });
      }
      m.get(e.accountId)!.amount += amt;
    }

    const assets = Array.from(byType.ASSET.values()).sort((a, b) =>
      a.code.localeCompare(b.code)
    );
    const liabilities = Array.from(byType.LIABILITY.values()).sort((a, b) =>
      a.code.localeCompare(b.code)
    );
    const equity = Array.from(byType.EQUITY.values()).sort((a, b) =>
      a.code.localeCompare(b.code)
    );

    const totalAssets = assets.reduce((s, a) => s + a.amount, 0);
    const totalLiabilities = liabilities.reduce((s, l) => s + l.amount, 0);
    const totalEquity = equity.reduce((s, e) => s + e.amount, 0);

    return NextResponse.json({
      report: "balance-sheet",
      asOf: asOfDate.toISOString(),
      baseCurrency: baseCurrency.code,
      assets,
      liabilities,
      equity,
      totalAssets,
      totalLiabilities,
      totalEquity,
    });
  }

  return NextResponse.json({ error: "Invalid report type" }, { status: 400 });
}
