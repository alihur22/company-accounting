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

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim().toLowerCase();

  if (q.length < 2) {
    return NextResponse.json({ accounts: [], journalEntries: [] });
  }

  const [accounts, journalEntries] = await Promise.all([
    prisma.account.findMany({
      where: {
        companyId,
        OR: [
          { code: { contains: q } },
          { name: { contains: q } },
        ],
      },
      take: 10,
      select: { id: true, code: true, name: true, type: true },
    }),
    prisma.journalEntry.findMany({
      where: {
        companyId,
        OR: [
          { description: { contains: q } },
          { reference: { contains: q } },
        ],
      },
      take: 10,
      select: {
        id: true,
        date: true,
        description: true,
        reference: true,
        ledgerEntries: { take: 2, include: { account: { select: { code: true, name: true } } } },
      },
      orderBy: { date: "desc" },
    }),
  ]);

  return NextResponse.json({
    accounts: accounts.map((a) => ({
      id: a.id,
      code: a.code,
      name: a.name,
      type: a.type,
      href: `/dashboard/ledger?accountId=${a.id}`,
    })),
    journalEntries: journalEntries.map((je) => ({
      id: je.id,
      date: je.date,
      description: je.description,
      reference: je.reference,
      preview: je.ledgerEntries
        .map((le) => `${le.account.code} ${le.account.name}`)
        .join(", "),
      href: `/dashboard/journal-entries`,
    })),
  });
}
