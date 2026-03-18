import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  let current: string[] = [];
  let inQuotes = false;
  let field = "";

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === "," || c === "\t") {
        current.push(field.trim());
        field = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        current.push(field.trim());
        field = "";
        if (current.some((f) => f)) lines.push(current);
        current = [];
      } else field += c;
    }
  }
  current.push(field.trim());
  if (current.some((f) => f)) lines.push(current);
  return lines;
}

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
  const accountId = searchParams.get("accountId");

  if (!accountId) {
    const statements = await prisma.bankStatement.findMany({
      where: { companyId },
      include: { account: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(statements);
  }

  const account = await prisma.account.findFirst({
    where: { id: accountId, companyId },
  });
  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const statements = await prisma.bankStatement.findMany({
    where: { accountId },
    include: {
      lines: {
        include: {
          ledgerEntry: { include: { journalEntry: true } },
          splits: { include: { ledgerEntry: { include: { journalEntry: true } } } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(statements);
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

  const contentType = req.headers.get("content-type") || "";
  let body: {
    accountId?: string;
    fromDate?: string;
    toDate?: string;
    file?: string;
    entries?: { date: string; description: string; reference?: string; amount: number }[];
  };

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "File required" }, { status: 400 });
    }
    const csvText = await file.text();
    body = {
      accountId: formData.get("accountId") as string,
      fromDate: formData.get("fromDate") as string,
      toDate: formData.get("toDate") as string,
      file: csvText,
    };
  } else {
    body = await req.json();
    if (body.file) {
      body.file = body.file as string;
    }
  }

  const { accountId, fromDate, toDate, file, entries: providedEntries } = body;

  if (!accountId || !fromDate || !toDate) {
    return NextResponse.json(
      { error: "accountId, fromDate, and toDate required" },
      { status: 400 }
    );
  }

  const account = await prisma.account.findFirst({
    where: { id: accountId, companyId },
  });
  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  let lines: { date: string; description: string; amount: number }[] = [];

  if (providedEntries && Array.isArray(providedEntries) && providedEntries.length > 0) {
    lines = providedEntries.map((e) => ({
      date: e.date,
      description: e.description,
      amount: e.amount,
    }));
  } else if (file) {
    const rows = parseCSV(typeof file === "string" ? file : "");
    const isHeader = rows[0] && /date|amount|description/i.test(rows[0][0] || "");
    const dataRows = isHeader ? rows.slice(1) : rows;

    for (const row of dataRows) {
      const date = row[0] || "";
      const desc = row[1] || "";
      const amt = parseFloat(row[2] || "0");
      if (!date) continue;
      const d = new Date(date);
      if (isNaN(d.getTime())) continue;
      lines.push({ date, description: desc, amount: amt });
    }
  }

  if (lines.length === 0) {
    return NextResponse.json(
      { error: "No entries to import. Provide file or entries array." },
      { status: 400 }
    );
  }

  const from = new Date(fromDate);
  const to = new Date(toDate);
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);

  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    return NextResponse.json(
      { error: "Invalid date format for fromDate or toDate" },
      { status: 400 }
    );
  }

  try {
    const statement = await prisma.$transaction(async (tx) => {
      const st = await tx.bankStatement.create({
        data: { companyId, accountId, fromDate: from, toDate: to },
      });
      for (const line of lines) {
        const lineDate = new Date(line.date);
        if (isNaN(lineDate.getTime())) continue;
        await tx.bankStatementLine.create({
          data: {
            bankStatementId: st.id,
            date: lineDate,
            description: line.description || null,
            amount: line.amount,
          },
        });
      }
      return tx.bankStatement.findUniqueOrThrow({
        where: { id: st.id },
        include: {
          account: true,
          lines: { include: { ledgerEntry: { include: { journalEntry: true } } } },
        },
      });
    });

    return NextResponse.json(statement);
  } catch (e) {
    console.error("Reconciliation import error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create statement" },
      { status: 500 }
    );
  }
}
