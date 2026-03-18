"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
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
import { SearchableSelect } from "@/components/SearchableSelect";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

type Account = {
  id: string;
  code: string;
  name: string;
};

type LedgerRow = {
  id: string;
  date: string;
  description: string | null;
  reference: string | null;
  debit: number;
  credit: number;
  balance: number;
  currency: string;
};

export default function LedgerPage() {
  const searchParams = useSearchParams();
  const accountIdFromUrl = searchParams.get("accountId") ?? "";
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState(accountIdFromUrl);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<{
    account: { id: string; code: string; name: string };
    entries: LedgerRow[];
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (accountIdFromUrl) setSelectedAccountId(accountIdFromUrl);
  }, [accountIdFromUrl]);

  const loadAccounts = async () => {
    const res = await fetch("/api/accounts");
    if (res.ok) setAccounts(await res.json());
  };

  const loadLedger = async () => {
    if (!selectedAccountId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ accountId: selectedAccountId });
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await fetch(`/api/ledger?${params}`);
      if (res.ok) setData(await res.json());
      else setData(null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    if (accountIdFromUrl && selectedAccountId === accountIdFromUrl) {
      loadLedger();
    }
  }, [selectedAccountId, accountIdFromUrl]);

  const accountOptions = accounts.map((a) => ({
    value: a.id,
    label: `${a.code} - ${a.name}`,
  }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Ledger</h1>
        <p className="text-muted-foreground">
          View transactions for an account
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Account ledger</CardTitle>
          <CardDescription>
            Select an account and optional date range to view its transaction
            history and running balance.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-[220px] space-y-2">
              <label className="text-sm font-medium">Account</label>
              <SearchableSelect
                options={accountOptions}
                value={selectedAccountId}
                onChange={setSelectedAccountId}
                placeholder="Select account"
                searchPlaceholder="Search accounts…"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">From</label>
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">To</label>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <Button onClick={loadLedger} disabled={!selectedAccountId || loading}>
              {loading ? "Loading…" : "View ledger"}
            </Button>
          </div>

          {loading && (
            <div className="mt-6 space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          )}
          {data && !loading && (
            <div className="mt-6">
              <h2 className="mb-2 font-medium">
                {data.account.code} - {data.account.name}
              </h2>
              {data.entries.length === 0 ? (
                <p className="py-4 text-center text-muted-foreground">
                  No transactions in this period
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.entries.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          {format(new Date(row.date), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {row.description ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {row.reference ?? "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {row.debit > 0 ? row.debit.toFixed(2) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {row.credit > 0 ? row.credit.toFixed(2) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {row.balance.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
