/**
 * Parses bank statement PDF (Bank AL Habib / similar format).
 * Format: Date, multi-line Description, Amount (PKR...Dr/Cr), Balance
 * Dr = debit (negative), Cr = credit (positive)
 */
import { extractText, getDocumentProxy } from "unpdf";

export type ParsedStatement = {
  openingBalance: number;
  closingBalance: number;
  entries: {
    date: string;
    description: string;
    reference: string;
    currency: string;
    amount: number;
    crDr: "Dr" | "Cr";
    balance: number;
  }[];
};

export async function parseStatementPDF(buffer: ArrayBuffer | Buffer): Promise<ParsedStatement> {
  const data = buffer instanceof Buffer ? new Uint8Array(buffer) : new Uint8Array(buffer);
  const pdf = await getDocumentProxy(data);
  const { text } = await extractText(pdf, { mergePages: true });
  return parseStatementText(text);
}

function parseStatementText(text: string): ParsedStatement {
  let openingBalance = 0;
  let closingBalance = 0;

  // Extract opening/closing balance from header
  const openingMatch = text.match(/Opening Balance\s*:\s*([A-Z]{3})?([\d,]+\.?\d*)/i);
  const closingMatch = text.match(/Closing Balance\s*:\s*([A-Z]{3})?([\d,]+\.?\d*)/i);
  if (openingMatch) openingBalance = parseNum(openingMatch[2]);
  if (closingMatch) closingBalance = parseNum(closingMatch[2]);

  const entries: ParsedStatement["entries"] = [];

  // unpdf returns space-separated text (no newlines); pdf-parse returns line-by-line
  // Amount pattern: PKR1,234.56Dr or PKR1,234.56Cr, optional balance
  const amountPattern = /PKR([\d,]+\.\d{2})(Dr|Cr)(?:\s+PKR([\d,]+\.?\d*))?/gi;
  const datePattern = /(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})/g;

  let match: RegExpExecArray | null;
  const amountMatches: { index: number; amount: string; crDr: string; balance: string }[] = [];
  while ((match = amountPattern.exec(text)) !== null) {
    amountMatches.push({
      index: match.index,
      amount: match[1],
      crDr: match[2],
      balance: match[3] || "0",
    });
  }

  for (const am of amountMatches) {
    // Find the preceding date - search backwards from amount position
    const beforeAmount = text.slice(0, am.index);
    const dateMatches = [...beforeAmount.matchAll(datePattern)];
    if (dateMatches.length === 0) continue;

    // Use the last date that is NOT part of "VALUE DATE:" (transaction date, not in-description date)
    let dateMatch: RegExpExecArray | null = null;
    for (let i = dateMatches.length - 1; i >= 0; i--) {
      const m = dateMatches[i];
      const preceding = beforeAmount.slice(Math.max(0, m.index! - 15), m.index);
      if (!/VALUE\s+DATE:?\s*$/i.test(preceding)) {
        dateMatch = m;
        break;
      }
    }
    if (!dateMatch) continue;

    const dateStr = dateMatch[1];
    const dateStart = dateMatch.index!;

    // Skip if this looks like header "Date Description"
    if (/Date\s+Description/i.test(beforeAmount.slice(Math.max(0, dateStart - 20), dateStart + 30))) {
      continue;
    }

    const date = parseDate(dateStr);
    if (!date) continue;

    // Description is between date and amount; remove trailing ref (e.g. "0 " or "10726651 ") before amount
    let description = beforeAmount
      .slice(dateStart + dateStr.length)
      .replace(/\s+\d{1,20}\s*$/, "") // trailing ref number before amount
      .replace(/\s+VALUE\s+DATE:.*$/i, "") // VALUE DATE:11 Mar 2026
      .replace(/\s+/g, " ")
      .trim();

    const amountRaw = parseNum(am.amount);
    const crDr = /Cr/i.test(am.crDr) ? "Cr" : "Dr";
    const balance = parseNum(am.balance);
    const amount = crDr === "Dr" ? -amountRaw : amountRaw;

    entries.push({
      date: formatDateForInput(date),
      description: description || "—",
      reference: "",
      currency: "PKR",
      amount,
      crDr: crDr as "Dr" | "Cr",
      balance,
    });
  }

  return { openingBalance, closingBalance, entries };
}

function parseNum(s: string): number {
  return parseFloat(String(s).replace(/,/g, "")) || 0;
}

function parseDate(s: string): Date | null {
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function formatDateForInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}
