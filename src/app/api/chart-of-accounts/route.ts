import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ACCOUNT_TYPES = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"] as const;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const companyId = (session.user as { companyId?: string }).companyId;
  if (!companyId) {
    return NextResponse.json({ error: "No company" }, { status: 404 });
  }

  const chart = await prisma.chartOfAccount.findMany({
    where: { companyId },
    include: { parent: true },
    orderBy: [{ type: "asc" }, { code: "asc" }],
  });
  return NextResponse.json(chart);
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
  const { code, name, type, parentId } = body;

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

  const existing = await prisma.chartOfAccount.findUnique({
    where: { companyId_code: { companyId, code } },
  });
  if (existing) {
    return NextResponse.json(
      { error: "A chart item with this code already exists" },
      { status: 400 }
    );
  }

  const chart = await prisma.chartOfAccount.create({
    data: {
      companyId,
      code: String(code).trim(),
      name: String(name).trim(),
      type,
      parentId: parentId || null,
    },
    include: { parent: true },
  });
  return NextResponse.json(chart);
}
