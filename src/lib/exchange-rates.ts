import { prisma } from "./prisma";

/**
 * Get rateToBase for a currency on a given date.
 * Uses the closest rate on or before the date. Falls back to 1 for base currency.
 */
export async function getRateToBase(
  currencyId: string,
  date: Date,
  baseCurrencyId: string
): Promise<number> {
  if (currencyId === baseCurrencyId) return 1;

  const dateOnly = new Date(date);
  dateOnly.setHours(0, 0, 0, 0);

  const rate = await prisma.exchangeRate.findFirst({
    where: {
      currencyId,
      date: { lte: dateOnly },
    },
    orderBy: { date: "desc" },
  });

  return rate?.rateToBase ?? 1;
}
