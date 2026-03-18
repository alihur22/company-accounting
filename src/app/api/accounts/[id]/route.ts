import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
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
  const account = await prisma.account.findFirst({
    where: { id, companyId },
    include: { parent: true, currency: true },
  });
  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }
  return NextResponse.json(account);
}

export async function PUT(
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
  const { id } = await params;
  const account = await prisma.account.findFirst({
    where: { id, companyId },
  });
  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }
  if (account.isSystem) {
    return NextResponse.json(
      { error: "System accounts cannot be modified" },
      { status: 400 }
    );
  }
  const body = await req.json();
  const { code, name, type, subType, parentId, currencyId } = body;

  const ACCOUNT_TYPES = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"] as const;
  const SUB_TYPES = ["BANK", "INVESTMENT", "RECEIVABLE", "PAYABLE"] as const;

  const data: Record<string, unknown> = {};
  if (code != null) data.code = String(code).trim();
  if (name != null) data.name = String(name).trim();
  if (type != null) {
    if (!ACCOUNT_TYPES.includes(type)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }
    data.type = type;
  }
  if (subType !== undefined) data.subType = subType && SUB_TYPES.includes(subType) ? subType : null;
  if (parentId !== undefined) data.parentId = parentId || null;
  if (currencyId !== undefined) data.currencyId = currencyId || null;

  if (code && code !== account.code) {
    const existing = await prisma.account.findUnique({
      where: { companyId_code: { companyId, code: String(code).trim() } },
    });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this code already exists" },
        { status: 400 }
      );
    }
  }

  const updated = await prisma.account.update({
    where: { id },
    data,
    include: { parent: true, currency: true },
  });
  return NextResponse.json(updated);
}

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
  const account = await prisma.account.findFirst({
    where: { id, companyId },
  });
  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }
  if (account.isSystem) {
    return NextResponse.json(
      { error: "System accounts cannot be deleted" },
      { status: 400 }
    );
  }
  await prisma.account.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
