import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRateToBase } from "@/lib/exchange-rates";

/**
 * CSV format: date,account_code,debit,credit,currency_code,description,reference
 * Rows with same date+description+reference are grouped into one journal entry.
 * Header row is optional but recommended.
 */
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
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === "," || c === "\t") {
        current.push(field.trim());
        field = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        current.push(field.trim());
        field = "";
        if (current.some((f) => f)) lines.push(current);
        current = [];
      } else {
        field += c;
      }
    }
  }
  current.push(field.trim());
  if (current.some((f) => f)) lines.push(current);
  return lines;
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
  let csvText: string;

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json(
        { error: "No file uploaded. Use form field 'file'" },
        { status: 400 }
      );
    }
    csvText = await file.text();
  } else {
    csvText = await req.text();
  }

  const rows = parseCSV(csvText);
  if (rows.length === 0) {
    return NextResponse.json(
      { error: "CSV is empty" },
      { status: 400 }
    );
  }

  const isHeader = (row: string[]) => {
    const first = (row[0] || "").toLowerCase();
    return first === "date" || first === "account" || first === "account_code";
  };

  const dataRows = isHeader(rows[0]) ? rows.slice(1) : rows;

  type Row = { date: string; accountCode: string; debit: number; credit: number; currencyCode: string; description: string; reference: string };
  const parsed: Row[] = [];

  for (const row of dataRows) {
    const date = row[0] || "";
    const accountCode = (row[1] || "").trim();
    const debit = parseFloat(row[2] || "0") || 0;
    const credit = parseFloat(row[3] || "0") || 0;
    const currencyCode = (row[4] || "USD").trim().toUpperCase();
    const description = (row[5] || "").trim();
    const reference = (row[6] || "").trim();

    if (!date || !accountCode) continue;
    if (debit <= 0 && credit <= 0) continue;

    parsed.push({ date, accountCode, debit, credit, currencyCode, description, reference });
  }

  if (parsed.length === 0) {
    return NextResponse.json(
      { error: "No valid rows found. Expected: date,account_code,debit,credit,currency_code,description,reference" },
      { status: 400 }
    );
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: { baseCurrency: true },
  });
  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  const accounts = await prisma.account.findMany({
    where: { companyId },
  });
  const accountByCode = new Map(accounts.map((a) => [a.code, a]));

  const currencies = await prisma.currency.findMany();
  const currencyByCode = new Map(currencies.map((c) => [c.code, c]));

  const groups = new Map<string, Row[]>();
  for (const row of parsed) {
    const key = `${row.date}|${row.description}|${row.reference}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  const errors: string[] = [];
  let created = 0;

  for (const [key, rows] of groups) {
    const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
    const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      errors.push(`Entry ${key}: debits (${totalDebit}) != credits (${totalCredit})`);
      continue;
    }

    const accountIds = rows.map((r) => accountByCode.get(r.accountCode)?.id).filter(Boolean);
    const missingAccounts = rows.filter((r) => !accountByCode.has(r.accountCode));
    if (missingAccounts.length > 0) {
      errors.push(`Entry ${key}: unknown accounts: ${[...new Set(missingAccounts.map((r) => r.accountCode))].join(", ")}`);
      continue;
    }

    const [datePart] = key.split("|");
    const entryDate = new Date(datePart);
    if (isNaN(entryDate.getTime())) {
      errors.push(`Entry ${key}: invalid date ${datePart}`);
      continue;
    }
    entryDate.setHours(0, 0, 0, 0);

    try {
      await prisma.$transaction(async (tx) => {
        const je = await tx.journalEntry.create({
          data: {
            companyId,
            date: entryDate,
            description: rows[0]?.description || null,
            reference: rows[0]?.reference || null,
          },
        });

        for (const row of rows) {
          const account = accountByCode.get(row.accountCode)!;
          const currency = currencyByCode.get(row.currencyCode) ?? company.baseCurrency;
          const amount = row.debit > 0 ? row.debit : row.credit;
          const rateToBase = await getRateToBase(
            currency.id,
            entryDate,
            company.baseCurrencyId
          );
          const amountInBase = amount * rateToBase;

          await tx.ledgerEntry.create({
            data: {
              journalEntryId: je.id,
              accountId: account.id,
              debit: row.debit > 0 ? row.debit : 0,
              credit: row.credit > 0 ? row.credit : 0,
              currencyId: currency.id,
              amountInBase,
            },
          });
        }
      });
      created++;
    } catch (e) {
      errors.push(`Entry ${key}: ${e instanceof Error ? e.message : "Failed"}`);
    }
  }

  return NextResponse.json({
    created,
    errors: errors.length > 0 ? errors : undefined,
  });
}
