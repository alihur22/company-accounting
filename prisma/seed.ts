import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CURRENCIES = [
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "AED", name: "UAE Dirham", symbol: "د.إ" },
  { code: "PKR", name: "Pakistani Rupee", symbol: "₨" },
  { code: "COP", name: "Colombian Peso", symbol: "$" },
];

async function main() {
  for (const c of CURRENCIES) {
    await prisma.currency.upsert({
      where: { code: c.code },
      create: { ...c, isBase: c.code === "USD" },
      update: {},
    });
  }
  console.log("Seeded currencies");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
