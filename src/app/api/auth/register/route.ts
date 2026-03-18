import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, password, companyName } = body;

    if (!email || !password || !companyName) {
      return NextResponse.json(
        { error: "Email, password, and company name are required" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 400 }
      );
    }

    // Get or create base currency (USD)
    let baseCurrency = await prisma.currency.findFirst({
      where: { code: "USD" },
    });
    if (!baseCurrency) {
      baseCurrency = await prisma.currency.create({
        data: {
          code: "USD",
          name: "US Dollar",
          symbol: "$",
          isBase: true,
        },
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const company = await prisma.company.create({
      data: {
        name: companyName,
        financialYearStart: "01-01",
        financialYearEnd: "12-31",
        baseCurrencyId: baseCurrency.id,
      },
    });

    await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: name || null,
        companyId: company.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Register error:", e);
    return NextResponse.json(
      { error: "Registration failed" },
      { status: 500 }
    );
  }
}
