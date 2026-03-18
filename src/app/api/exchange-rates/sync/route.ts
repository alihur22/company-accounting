import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const EXCHANGE_RATE_API = "https://api.exchangerate-api.com/v4/latest/USD";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const apiKey = process.env.EXCHANGE_RATE_API_KEY;
  const url = apiKey
    ? `https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`
    : EXCHANGE_RATE_API;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error("Failed to fetch rates");
    }
    const data = await res.json();
    const rates = data.rates || data.conversion_rates;
    if (!rates) throw new Error("Invalid API response");

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const currencies = await prisma.currency.findMany();
    const usdRate = rates.USD ?? 1;

    for (const curr of currencies) {
      const rate = rates[curr.code];
      if (rate == null) continue;
      const rateToBase = rate / usdRate;
      await prisma.exchangeRate.upsert({
        where: {
          currencyId_date: {
            currencyId: curr.id,
            date: today,
          },
        },
        create: {
          currencyId: curr.id,
          date: today,
          rateToBase,
          source: "exchangerate-api",
        },
        update: { rateToBase, source: "exchangerate-api" },
      });
    }
    return NextResponse.json({ synced: true });
  } catch (e) {
    console.error("Exchange rate sync error:", e);
    return NextResponse.json(
      { error: "Failed to sync exchange rates" },
      { status: 500 }
    );
  }
}
