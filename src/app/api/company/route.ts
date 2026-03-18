import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
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
  return NextResponse.json({
    id: company.id,
    name: company.name,
    financialYearStart: company.financialYearStart,
    financialYearEnd: company.financialYearEnd,
    baseCurrencyId: company.baseCurrencyId,
    baseCurrency: company.baseCurrency,
  });
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const companyId = (session.user as { companyId?: string }).companyId;
  if (!companyId) {
    return NextResponse.json({ error: "No company" }, { status: 404 });
  }
  const body = await req.json();
  const { name, financialYearStart, financialYearEnd, baseCurrencyId } = body;

  const data: Record<string, unknown> = {};
  if (name != null) data.name = name;
  if (financialYearStart != null) data.financialYearStart = financialYearStart;
  if (financialYearEnd != null) data.financialYearEnd = financialYearEnd;
  if (baseCurrencyId != null) data.baseCurrencyId = baseCurrencyId;

  const company = await prisma.company.update({
    where: { id: companyId },
    data,
    include: { baseCurrency: true },
  });
  return NextResponse.json(company);
}
