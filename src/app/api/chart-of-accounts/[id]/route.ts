import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ACCOUNT_TYPES = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"] as const;

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
  const chart = await prisma.chartOfAccount.findFirst({
    where: { id, companyId },
    include: { parent: true },
  });
  if (!chart) {
    return NextResponse.json({ error: "Chart item not found" }, { status: 404 });
  }
  return NextResponse.json(chart);
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
  const chart = await prisma.chartOfAccount.findFirst({
    where: { id, companyId },
  });
  if (!chart) {
    return NextResponse.json({ error: "Chart item not found" }, { status: 404 });
  }
  const body = await req.json();
  const { code, name, type, parentId } = body;

  const data: Record<string, unknown> = {};
  if (code != null) data.code = String(code).trim();
  if (name != null) data.name = String(name).trim();
  if (type != null) {
    if (!ACCOUNT_TYPES.includes(type)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }
    data.type = type;
  }
  if (parentId !== undefined) data.parentId = parentId || null;

  if (code && code !== chart.code) {
    const existing = await prisma.chartOfAccount.findUnique({
      where: { companyId_code: { companyId, code: String(code).trim() } },
    });
    if (existing) {
      return NextResponse.json(
        { error: "A chart item with this code already exists" },
        { status: 400 }
      );
    }
  }

  const updated = await prisma.chartOfAccount.update({
    where: { id },
    data,
    include: { parent: true },
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
  const chart = await prisma.chartOfAccount.findFirst({
    where: { id, companyId },
  });
  if (!chart) {
    return NextResponse.json({ error: "Chart item not found" }, { status: 404 });
  }
  await prisma.chartOfAccount.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
