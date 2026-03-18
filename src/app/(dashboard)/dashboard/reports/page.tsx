"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarChart3, FileSpreadsheet, Scale } from "lucide-react";
import { format } from "date-fns";

type ReportType = "trial-balance" | "pl" | "balance-sheet";

function escapeCSV(val: string | number): string {
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function exportReportToCSV(data: unknown): Blob {
  const lines: string[] = [];
  if (data && typeof data === "object" && "report" in data) {
    const r = data as { report: string; baseCurrency?: string };
    lines.push(`${r.report} Report`);
    if (r.baseCurrency) lines.push(`Currency: ${r.baseCurrency}`);
    lines.push("");

    if (r.report === "trial-balance") {
      const d = data as TrialBalanceData;
      lines.push("Code,Account,Type,Debit,Credit");
      for (const row of d.rows) {
        lines.push(
          [row.code, row.name, row.type, row.debit.toFixed(2), row.credit.toFixed(2)]
            .map(escapeCSV)
            .join(",")
        );
      }
      lines.push(`Total,,,${d.totalDebit.toFixed(2)},${d.totalCredit.toFixed(2)}`);
    } else if (r.report === "pl") {
      const d = data as PLData;
      lines.push("Revenue");
      lines.push("Code,Name,Amount");
      for (const row of d.revenue) {
        lines.push([row.code, row.name, row.amount.toFixed(2)].map(escapeCSV).join(","));
      }
      lines.push(`Total Revenue,,${d.totalRevenue.toFixed(2)}`);
      lines.push("");
      lines.push("Expenses");
      lines.push("Code,Name,Amount");
      for (const row of d.expenses) {
        lines.push([row.code, row.name, row.amount.toFixed(2)].map(escapeCSV).join(","));
      }
      lines.push(`Total Expenses,,${d.totalExpenses.toFixed(2)}`);
      lines.push(`Net Income,,${d.netIncome.toFixed(2)}`);
    } else if (r.report === "balance-sheet") {
      const d = data as BalanceSheetData;
      lines.push("Assets");
      lines.push("Code,Name,Amount");
      for (const row of d.assets) {
        lines.push([row.code, row.name, row.amount.toFixed(2)].map(escapeCSV).join(","));
      }
      lines.push(`Total Assets,,${d.totalAssets.toFixed(2)}`);
      lines.push("");
      lines.push("Liabilities");
      lines.push("Code,Name,Amount");
      for (const row of d.liabilities) {
        lines.push([row.code, row.name, row.amount.toFixed(2)].map(escapeCSV).join(","));
      }
      lines.push(`Total Liabilities,,${d.totalLiabilities.toFixed(2)}`);
      lines.push("");
      lines.push("Equity");
      lines.push("Code,Name,Amount");
      for (const row of d.equity) {
        lines.push([row.code, row.name, row.amount.toFixed(2)].map(escapeCSV).join(","));
      }
      lines.push(`Total Equity,,${d.totalEquity.toFixed(2)}`);
    }
  }
  return new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
}

export default function ReportsPage() {
  const [report, setReport] = useState<ReportType>("trial-balance");
  const [asOf, setAsOf] = useState(format(new Date(), "yyyy-MM-dd"));
  const [from, setFrom] = useState(format(new Date(new Date().getFullYear(), 0, 1), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  const runReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ report });
      if (report === "trial-balance" || report === "balance-sheet") {
        params.set("asOf", asOf);
      } else {
        params.set("from", from);
        params.set("to", to);
      }
      const res = await fetch(`/api/reports?${params}`);
      if (res.ok) setData(await res.json());
      else setData(null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-muted-foreground">
          Trial balance, income statement, and balance sheet
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Run report</CardTitle>
          <CardDescription>
            Select a report type and date range, then run to view results.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex gap-2">
              {[
                { id: "trial-balance" as const, label: "Trial Balance", icon: Scale },
                { id: "pl" as const, label: "P&L", icon: BarChart3 },
                { id: "balance-sheet" as const, label: "Balance Sheet", icon: FileSpreadsheet },
              ].map((r) => {
                const Icon = r.icon;
                return (
                  <Button
                    key={r.id}
                    variant={report === r.id ? "default" : "outline"}
                    onClick={() => setReport(r.id)}
                  >
                    <Icon className="mr-2 size-4" />
                    {r.label}
                  </Button>
                );
              })}
            </div>
            {(report === "trial-balance" || report === "balance-sheet") && (
              <div className="flex items-center gap-2">
                <label className="text-sm">As of</label>
                <Input
                  type="date"
                  value={asOf}
                  onChange={(e) => setAsOf(e.target.value)}
                />
              </div>
            )}
            {report === "pl" && (
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
                <span className="text-muted-foreground">to</span>
                <Input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>
            )}
            <Button onClick={runReport} disabled={loading}>
              {loading ? "Loading…" : "Run report"}
            </Button>
            {data ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    const blob = exportReportToCSV(data);
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `report-${Date.now()}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Export CSV
                </Button>
                <Button variant="outline" onClick={() => window.print()}>
                  Print / Save PDF
                </Button>
              </>
            ) : null}
          </div>

          {data && typeof data === "object" && "report" in data ? (
            <div className="mt-6 overflow-x-auto">
              {(data as { report: string }).report === "trial-balance" && (
                <TrialBalanceView data={data as TrialBalanceData} />
              )}
              {(data as { report: string }).report === "pl" && (
                <PLView data={data as PLData} />
              )}
              {(data as { report: string }).report === "balance-sheet" && (
                <BalanceSheetView data={data as BalanceSheetData} />
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

type TrialBalanceData = {
  report: string;
  asOf: string;
  baseCurrency: string;
  rows: { code: string; name: string; type: string; debit: number; credit: number }[];
  totalDebit: number;
  totalCredit: number;
};

function TrialBalanceView({ data }: { data: TrialBalanceData }) {
  return (
    <div>
      <h2 className="mb-2 font-medium">
        Trial Balance as of {format(new Date(data.asOf), "MMM d, yyyy")} ({data.baseCurrency})
      </h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Account</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Debit</TableHead>
            <TableHead className="text-right">Credit</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.rows.map((r) => (
            <TableRow key={r.code}>
              <TableCell className="font-mono">{r.code}</TableCell>
              <TableCell>{r.name}</TableCell>
              <TableCell>{r.type}</TableCell>
              <TableCell className="text-right font-mono">
                {r.debit > 0 ? r.debit.toFixed(2) : "—"}
              </TableCell>
              <TableCell className="text-right font-mono">
                {r.credit > 0 ? r.credit.toFixed(2) : "—"}
              </TableCell>
            </TableRow>
          ))}
          <TableRow className="font-medium">
            <TableCell colSpan={3}>Total</TableCell>
            <TableCell className="text-right font-mono">
              {data.totalDebit.toFixed(2)}
            </TableCell>
            <TableCell className="text-right font-mono">
              {data.totalCredit.toFixed(2)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

type PLData = {
  report: string;
  from: string;
  to: string;
  baseCurrency: string;
  revenue: { code: string; name: string; amount: number }[];
  expenses: { code: string; name: string; amount: number }[];
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
};

function PLView({ data }: { data: PLData }) {
  return (
    <div>
      <h2 className="mb-2 font-medium">
        Income Statement ({format(new Date(data.from), "MMM d, yyyy")} –{" "}
        {format(new Date(data.to), "MMM d, yyyy")}) ({data.baseCurrency})
      </h2>
      <div className="space-y-4">
        <div>
          <h3 className="mb-1 text-sm font-medium text-muted-foreground">Revenue</h3>
          <Table>
            <TableBody>
              {data.revenue.map((r) => (
                <TableRow key={r.code}>
                  <TableCell className="font-mono">{r.code}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell className="text-right font-mono">
                    {r.amount.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-right font-medium">
            Total Revenue: {data.totalRevenue.toFixed(2)}
          </p>
        </div>
        <div>
          <h3 className="mb-1 text-sm font-medium text-muted-foreground">Expenses</h3>
          <Table>
            <TableBody>
              {data.expenses.map((e) => (
                <TableRow key={e.code}>
                  <TableCell className="font-mono">{e.code}</TableCell>
                  <TableCell>{e.name}</TableCell>
                  <TableCell className="text-right font-mono">
                    {e.amount.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-right font-medium">
            Total Expenses: {data.totalExpenses.toFixed(2)}
          </p>
        </div>
        <p className="border-t pt-2 text-right text-lg font-semibold">
          Net Income: {data.netIncome.toFixed(2)}
        </p>
      </div>
    </div>
  );
}

type BalanceSheetData = {
  report: string;
  asOf: string;
  baseCurrency: string;
  assets: { code: string; name: string; amount: number }[];
  liabilities: { code: string; name: string; amount: number }[];
  equity: { code: string; name: string; amount: number }[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
};

function BalanceSheetView({ data }: { data: BalanceSheetData }) {
  return (
    <div>
      <h2 className="mb-2 font-medium">
        Balance Sheet as of {format(new Date(data.asOf), "MMM d, yyyy")} ({data.baseCurrency})
      </h2>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="mb-2 font-medium">Assets</h3>
          <Table>
            <TableBody>
              {data.assets.map((a) => (
                <TableRow key={a.code}>
                  <TableCell className="font-mono">{a.code}</TableCell>
                  <TableCell>{a.name}</TableCell>
                  <TableCell className="text-right font-mono">
                    {a.amount.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="font-medium">Total Assets: {data.totalAssets.toFixed(2)}</p>
        </div>
        <div>
          <h3 className="mb-2 font-medium">Liabilities</h3>
          <Table>
            <TableBody>
              {data.liabilities.map((l) => (
                <TableRow key={l.code}>
                  <TableCell className="font-mono">{l.code}</TableCell>
                  <TableCell>{l.name}</TableCell>
                  <TableCell className="text-right font-mono">
                    {l.amount.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="font-medium">
            Total Liabilities: {data.totalLiabilities.toFixed(2)}
          </p>
          <h3 className="mb-2 mt-4 font-medium">Equity</h3>
          <Table>
            <TableBody>
              {data.equity.map((e) => (
                <TableRow key={e.code}>
                  <TableCell className="font-mono">{e.code}</TableCell>
                  <TableCell>{e.name}</TableCell>
                  <TableCell className="text-right font-mono">
                    {e.amount.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="font-medium">Total Equity: {data.totalEquity.toFixed(2)}</p>
        </div>
      </div>
    </div>
  );
}
