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
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const rates = await prisma.exchangeRate.findMany({
    where: { date: date ? new Date(date) : new Date() },
    include: { currency: true },
  });
  return NextResponse.json(rates);
}
