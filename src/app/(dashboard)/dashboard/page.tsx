"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TrendingUp, TrendingDown, Wallet, FileText, Landmark, ArrowRightLeft } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

type AccountWithBalance = {
  id: string;
  code: string;
  name: string;
  type: string;
  subType: string | null;
  currencyCode: string;
  balance: number;
};

type DashboardData = {
  baseCurrency: string;
  ytd: {
    revenue: number;
    expenses: number;
    netIncome: number;
    journalEntries: number;
  };
  balances: {
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
    cash: number;
  };
  monthlyTrend: { month: number; monthName: string; revenue: number; expenses: number }[];
  expensesByCategory: { code: string; name: string; amount: number }[];
  accountsWithBalances: AccountWithBalance[];
};

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

type ExpensesChartType = "pie" | "bar";

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expensesChartType, setExpensesChartType] = useState<ExpensesChartType>("bar");

  useEffect(() => {
    fetch("/api/dashboard")
      .then((res) => (res.ok ? res.json() : null))
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-semibold">Dashboard</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-32 animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const fmt = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const curr = data?.baseCurrency ?? "USD";

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Dashboard</h1>

      <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              YTD Revenue
            </CardTitle>
            <TrendingUp className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data ? fmt(data.ytd.revenue) : "—"} {curr}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              YTD Expenses
            </CardTitle>
            <TrendingDown className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data ? fmt(data.ytd.expenses) : "—"} {curr}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              YTD Net Income
            </CardTitle>
            <TrendingUp className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                data && data.ytd.netIncome < 0 ? "text-destructive" : ""
              }`}
            >
              {data ? fmt(data.ytd.netIncome) : "—"} {curr}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Journal Entries (YTD)
            </CardTitle>
            <FileText className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data?.ytd.journalEntries ?? 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="size-5" />
              Balance Sheet Summary
            </CardTitle>
            <CardDescription>As of today (all time)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Assets</span>
              <span className="font-mono font-medium">
                {data ? fmt(data.balances.totalAssets) : "—"} {curr}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Liabilities</span>
              <span className="font-mono font-medium">
                {data ? fmt(data.balances.totalLiabilities) : "—"} {curr}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Equity</span>
              <span className="font-mono font-medium">
                {data ? fmt(data.balances.totalEquity) : "—"} {curr}
              </span>
            </div>
            <div className="border-t pt-2">
              <div className="flex justify-between">
                <span className="font-medium">Cash (1xxx accounts)</span>
                <span className="font-mono font-medium">
                  {data ? fmt(data.balances.cash) : "—"} {curr}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="md:col-span-2 lg:col-span-3">
          <CardHeader>
            <CardTitle>Revenue vs Expenses (YTD)</CardTitle>
            <CardDescription>
              Monthly breakdown for {new Date().getFullYear()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data?.monthlyTrend && data.monthlyTrend.some((m) => m.revenue !== 0 || m.expenses !== 0) ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="monthName" className="text-xs" />
                    <YAxis className="text-xs" tickFormatter={(v) => v.toLocaleString()} />
                    <Tooltip
                      formatter={(v) => [typeof v === "number" ? v.toFixed(2) : v, ""]}
                      labelFormatter={(l) => l}
                    />
                    <Legend />
                    <Bar dataKey="revenue" fill="var(--chart-1)" name="Revenue" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" fill="var(--chart-2)" name="Expenses" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center rounded border border-dashed border-muted-foreground/25 text-sm text-muted-foreground">
                No data yet. Add journal entries to see the chart.
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="md:col-span-2 lg:col-span-3">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Expenses by category (YTD)</CardTitle>
                <CardDescription>
                  Breakdown by expense account
                </CardDescription>
              </div>
              <div className="flex gap-1 rounded-lg border border-border p-1">
                <button
                  type="button"
                  onClick={() => setExpensesChartType("bar")}
                  className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                    expensesChartType === "bar"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  Bar
                </button>
                <button
                  type="button"
                  onClick={() => setExpensesChartType("pie")}
                  className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                    expensesChartType === "pie"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  Pie
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {data?.expensesByCategory && data.expensesByCategory.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  {expensesChartType === "pie" ? (
                    <PieChart>
                      <Pie
                        data={data.expensesByCategory}
                        dataKey="amount"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ name, percent }) =>
                          `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                        }
                      >
                        {data.expensesByCategory.map((_, i) => (
                          <Cell
                            key={i}
                            fill={CHART_COLORS[i % CHART_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v) => [typeof v === "number" ? v.toFixed(2) : v, ""]}
                        contentStyle={{ borderRadius: "var(--radius)" }}
                      />
                    </PieChart>
                  ) : (
                    <BarChart
                      data={data.expensesByCategory}
                      layout="vertical"
                      margin={{ left: 0, right: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                      <XAxis type="number" tickFormatter={(v) => v.toLocaleString()} className="text-xs" />
                      <YAxis type="category" dataKey="name" width={80} className="text-xs" tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(v) => [typeof v === "number" ? v.toFixed(2) : v, ""]}
                        contentStyle={{ borderRadius: "var(--radius)" }}
                      />
                      <Bar dataKey="amount" fill="var(--chart-2)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center rounded border border-dashed border-muted-foreground/25 text-sm text-muted-foreground">
                No expense data yet. Add journal entries with expense accounts.
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="md:col-span-2 lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Landmark className="size-5" />
              All accounts
            </CardTitle>
            <CardDescription>
              Current standing for each account
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data?.accountsWithBalances && data.accountsWithBalances.length > 0 ? (
              <div className="max-h-80 overflow-y-auto">
                <div className="space-y-1">
                  {data.accountsWithBalances.map((a) => (
                    <a
                      key={a.id}
                      href={`/dashboard/ledger?accountId=${a.id}`}
                      className="flex items-center justify-between rounded-lg border border-transparent px-3 py-2 transition-colors hover:border-border hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-xs text-muted-foreground shrink-0">{a.code}</span>
                        <span className="truncate font-medium">{a.name}</span>
                        {a.subType && (
                          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {a.subType}
                          </span>
                        )}
                      </div>
                      <span
                        className={`shrink-0 font-mono text-sm ${
                          a.type === "EXPENSE" && a.balance > 0
                            ? "text-destructive"
                            : a.type === "REVENUE" && a.balance > 0
                              ? "text-green-600 dark:text-green-400"
                              : ""
                        }`}
                      >
                        {fmt(a.balance)} {a.currencyCode}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ArrowRightLeft className="mb-3 size-10 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">No accounts yet</p>
                <a
                  href="/dashboard/chart-of-accounts"
                  className="mt-2 text-sm font-medium text-primary hover:underline"
                >
                  Chart of Accounts
                </a>
                <span className="mx-1 text-muted-foreground">·</span>
                <a
                  href="/dashboard/accounts"
                  className="mt-2 text-sm font-medium text-primary hover:underline"
                >
                  Accounts
                </a>
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="md:col-span-1 lg:col-span-3">
          <CardHeader>
            <CardTitle>Quick links</CardTitle>
            <CardDescription>
              Navigate to key areas of your accounting
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2">
              <a
                href="/dashboard/journal-entries"
                className="group rounded-lg border border-border p-4 transition-all hover:border-primary/30 hover:bg-muted/50 hover:shadow-sm"
              >
                <p className="font-medium">Journal Entries</p>
                <p className="text-sm text-muted-foreground">
                  Create or import transactions
                </p>
              </a>
              <a
                href="/dashboard/ledger"
                className="group rounded-lg border border-border p-4 transition-all hover:border-primary/30 hover:bg-muted/50 hover:shadow-sm"
              >
                <p className="font-medium">Ledger</p>
                <p className="text-sm text-muted-foreground">
                  View account transactions
                </p>
              </a>
              <a
                href="/dashboard/reports"
                className="group rounded-lg border border-border p-4 transition-all hover:border-primary/30 hover:bg-muted/50 hover:shadow-sm"
              >
                <p className="font-medium">Reports</p>
                <p className="text-sm text-muted-foreground">
                  Trial balance, P&L, Balance sheet
                </p>
              </a>
              <a
                href="/dashboard/chart-of-accounts"
                className="group rounded-lg border border-border p-4 transition-all hover:border-primary/30 hover:bg-muted/50 hover:shadow-sm"
              >
                <p className="font-medium">Chart of Accounts</p>
                <p className="text-sm text-muted-foreground">
                  Define account structure
                </p>
              </a>
              <a
                href="/dashboard/accounts"
                className="group rounded-lg border border-border p-4 transition-all hover:border-primary/30 hover:bg-muted/50 hover:shadow-sm"
              >
                <p className="font-medium">Accounts</p>
                <p className="text-sm text-muted-foreground">
                  Bank, investment, and posting accounts
                </p>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
