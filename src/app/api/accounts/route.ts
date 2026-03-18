import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ACCOUNT_TYPES = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"] as const;
const SUB_TYPES = ["BANK", "INVESTMENT", "RECEIVABLE", "PAYABLE"] as const;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const companyId = (session.user as { companyId?: string }).companyId;
  if (!companyId) {
    return NextResponse.json({ error: "No company" }, { status: 404 });
  }

  const accounts = await prisma.account.findMany({
    where: { companyId },
    include: { parent: true, currency: true },
    orderBy: [{ type: "asc" }, { code: "asc" }],
  });

  const entries = await prisma.ledgerEntry.findMany({
    where: { journalEntry: { companyId } },
    select: { accountId: true, debit: true, credit: true, amountInBase: true },
  });

  const balanceByAccount = new Map<string, number>();
  for (const e of entries) {
    const delta = e.debit > 0 ? e.amountInBase : -e.amountInBase;
    balanceByAccount.set(e.accountId, (balanceByAccount.get(e.accountId) ?? 0) + delta);
  }

  const result = accounts.map((a) => {
    const raw = balanceByAccount.get(a.id) ?? 0;
    const balance =
      a.type === "LIABILITY" || a.type === "EQUITY" || a.type === "REVENUE"
        ? -raw
        : raw;
    return { ...a, balance };
  });

  return NextResponse.json(result);
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
  const { code, name, type, subType, parentId, currencyId } = body;

  if (!code || !name || !type) {
    return NextResponse.json(
      { error: "Code, name, and type are required" },
      { status: 400 }
    );
  }

  if (!ACCOUNT_TYPES.includes(type)) {
    return NextResponse.json(
      { error: `Type must be one of: ${ACCOUNT_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  const validSubType = subType && SUB_TYPES.includes(subType) ? subType : null;

  const existing = await prisma.account.findUnique({
    where: { companyId_code: { companyId, code } },
  });
  if (existing) {
    return NextResponse.json(
      { error: "An account with this code already exists" },
      { status: 400 }
    );
  }

  const account = await prisma.account.create({
    data: {
      companyId,
      code: String(code).trim(),
      name: String(name).trim(),
      type,
      subType: validSubType,
      parentId: parentId || null,
      currencyId: currencyId || null,
    },
    include: { parent: true, currency: true },
  });
  return NextResponse.json(account);
}
