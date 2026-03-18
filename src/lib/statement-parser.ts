/**
 * Parses bank statement CSV in format:
 * Date,Description,Reference Number,Currency,Amount,Cr/Dr,Currency,Balance
 * Debit entries -> negative amount, Credit entries -> positive amount
 */
export function parseStatementCSV(text: string): {
  openingBalance: number;
  closingBalance: number;
  entries: {
    date: string;
    description: string;
    reference: string;
    currency: string;
    amount: number; // negative for Dr, positive for Cr
    crDr: "Dr" | "Cr";
    balance: number;
  }[];
} {
  const lines = parseCSV(text);
  let openingBalance = 0;
  let closingBalance = 0;
  const entries: {
    date: string;
    description: string;
    reference: string;
    currency: string;
    amount: number;
    crDr: "Dr" | "Cr";
    balance: number;
  }[] = [];

  let dataStartIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const row = lines[i];
    const first = (row[0] || "").trim();
    const second = (row[1] || "").trim();

    if (/^Opening Balance$/i.test(first)) {
      openingBalance = parseAmount(second);
      continue;
    }
    if (/^Closing Balance$/i.test(first)) {
      closingBalance = parseAmount(second);
      continue;
    }
    if (/^Date$/i.test(first) && /Description/i.test(second)) {
      dataStartIndex = i + 1;
      continue;
    }
  }

  for (let i = dataStartIndex; i < lines.length; i++) {
    const row = lines[i];
    if (row.length < 6) continue;

    const date = (row[0] || "").trim();
    const amountIdx = row.length - 4;
    const crDrIdx = row.length - 3;
    const currencyIdx = row.length - 2;
    const balanceIdx = row.length - 1;

    const description = row.slice(1, amountIdx - 2).join(" ").trim() || (row[1] || "").trim();
    const reference = (row[amountIdx - 2] || "").trim();
    const currency = (row[currencyIdx] || row[amountIdx - 1] || "PKR").trim().toUpperCase();
    const amountRaw = parseFloat((row[amountIdx] || "0").toString().replace(/,/g, "")) || 0;
    const crDr = /^Cr$/i.test((row[crDrIdx] || "").trim()) ? "Cr" : "Dr";
    const balance = parseFloat((row[balanceIdx] || "0").toString().replace(/,/g, "")) || 0;

    if (!date) continue;
    const d = new Date(date);
    if (isNaN(d.getTime())) continue;

    const amount = crDr === "Dr" ? -amountRaw : amountRaw;

    entries.push({
      date: formatDateForInput(d),
      description,
      reference,
      currency,
      amount,
      crDr,
      balance,
    });
  }

  return { openingBalance, closingBalance, entries };
}

function parseAmount(s: string): number {
  return parseFloat(s.replace(/[^0-9.-]/g, "")) || 0;
}

function formatDateForInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

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
