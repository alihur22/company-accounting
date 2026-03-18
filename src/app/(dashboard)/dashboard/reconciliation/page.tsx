"use client";

import { useEffect, useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Upload, RefreshCw, FileCheck, Trash2, SplitSquareVertical } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { format, subDays } from "date-fns";
import { parseStatementCSV } from "@/lib/statement-parser";

type Account = { id: string; code: string; name: string };
type BankStatementLineSplit = {
  id: string;
  amount: number;
  ledgerEntryId: string;
  ledgerEntry: { journalEntry: { description: string | null; reference: string | null } };
};
type BankStatementLine = {
  id: string;
  date: string;
  description: string | null;
  amount: number;
  ledgerEntryId: string | null;
  ledgerEntry?: { journalEntry: { description: string | null; reference: string | null } };
  splits?: BankStatementLineSplit[];
};
type BankStatement = {
  id: string;
  fromDate: string;
  toDate: string;
  account: Account;
  lines: BankStatementLine[];
};
type LedgerEntry = {
  id: string;
  date: string;
  description: string | null;
  reference: string | null;
  amount: number;
  currency: string;
};

export default function ReconciliationPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [statements, setStatements] = useState<BankStatement[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [parsedPreview, setParsedPreview] = useState<{
    openingBalance: number;
    closingBalance: number;
    entries: { date: string; description: string; reference: string; currency: string; amount: number; crDr: string }[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [matching, setMatching] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("reconcile");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ id: string; label: string } | null>(null);
  const [deletingLine, setDeletingLine] = useState<string | null>(null);
  const [deleteLineDialog, setDeleteLineDialog] = useState<{ id: string; description: string } | null>(null);
  const [splitDialog, setSplitDialog] = useState<BankStatementLine | null>(null);
  const [splitAmount, setSplitAmount] = useState("");
  const [splitLedgerId, setSplitLedgerId] = useState("");

  const selectedAccount = (accounts ?? []).find((a) => a.id === selectedAccountId);

  const loadAccounts = async () => {
    const res = await fetch("/api/accounts");
    if (res.ok) {
      const data = await res.json();
      setAccounts(Array.isArray(data) ? data : []);
    }
  };

  const loadStatements = async (): Promise<BankStatement[]> => {
    if (!selectedAccountId) return [];
    setLoading(true);
    try {
      const res = await fetch(`/api/reconciliation?accountId=${selectedAccountId}`);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setStatements(list);
        return list;
      }
    } finally {
      setLoading(false);
    }
    return [];
  };

  const loadLedger = async () => {
    if (!selectedAccountId) return;
    const params = new URLSearchParams({ accountId: selectedAccountId });
    const from = fromDate || format(subDays(new Date(), 90), "yyyy-MM-dd");
    const to = toDate || format(new Date(), "yyyy-MM-dd");
    params.set("from", from);
    params.set("to", to);
    const res = await fetch(`/api/reconciliation/match?${params}`);
    if (res.ok) {
      const data = await res.json();
      setLedgerEntries(data.ledgerEntries ?? []);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    if (selectedAccountId) {
      loadStatements();
    } else {
      setStatements([]);
    }
  }, [selectedAccountId]);

  useEffect(() => {
    if (selectedAccountId) loadLedger();
    else setLedgerEntries([]);
  }, [selectedAccountId, fromDate, toDate]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setFile(f ?? null);
    setParsedPreview(null);
    if (!f) return;
    const isPdf = f.name.toLowerCase().endsWith(".pdf");
    try {
      let parsed: { openingBalance: number; closingBalance: number; entries: { date: string; description: string; reference: string; currency: string; amount: number; crDr: string }[] };
      if (isPdf) {
        const formData = new FormData();
        formData.set("file", f);
        const res = await fetch("/api/reconciliation/parse", { method: "POST", body: formData });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Failed to parse PDF");
        }
        parsed = await res.json();
      } else {
        const text = await f.text();
        parsed = parseStatementCSV(text);
      }
      setParsedPreview(parsed);
      if (parsed.entries && parsed.entries.length > 0) {
        const dates = parsed.entries.map((x) => new Date(x.date));
        const min = new Date(Math.min(...dates.map((d) => d.getTime())));
        const max = new Date(Math.max(...dates.map((d) => d.getTime())));
        setFromDate(format(min, "yyyy-MM-dd"));
        setToDate(format(max, "yyyy-MM-dd"));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to parse statement");
    }
  };

  const removePreviewEntry = (index: number) => {
    if (!parsedPreview?.entries) return;
    const next = parsedPreview.entries.filter((_, i) => i !== index);
    if (next.length === 0) {
      setParsedPreview(null);
      return;
    }
    setParsedPreview({ ...parsedPreview, entries: next });
  };

  const handleImport = async () => {
    if (!selectedAccountId) {
      toast.error("Select a cash account first");
      return;
    }
    if (!fromDate || !toDate) {
      toast.error("Set From and To dates");
      return;
    }
    const entries = parsedPreview?.entries;
    if (!entries || entries.length === 0) {
      toast.error("No entries to import. Upload a statement first.");
      return;
    }
    setImporting(true);
    try {
      const res = await fetch("/api/reconciliation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: selectedAccountId,
          fromDate,
          toDate,
          entries: entries.map((e) => ({
            date: e.date,
            description: e.description,
            amount: e.amount,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setFile(null);
        setParsedPreview(null);
        setStatements((prev) => [data, ...(prev ?? [])]);
        loadLedger();
        setActiveTab("bank-statements");
        toast.success("Bank statement imported");
      } else {
        toast.error((data as { error?: string }).error ?? `Import failed (${res.status})`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const handleMatch = async (bankLineId: string, ledgerEntryId: string) => {
    setMatching(bankLineId);
    try {
      const res = await fetch("/api/reconciliation/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankLineId, ledgerEntryId }),
      });
      if (res.ok) {
        loadStatements();
        loadLedger();
      }
    } finally {
      setMatching(null);
    }
  };

  const handleDeleteLine = async () => {
    if (!deleteLineDialog) return;
    setDeletingLine(deleteLineDialog.id);
    try {
      const res = await fetch(`/api/reconciliation/lines/${deleteLineDialog.id}`, { method: "DELETE" });
      if (res.ok) {
        loadStatements();
        loadLedger();
        setDeleteLineDialog(null);
        toast.success("Entry deleted");
      } else {
        const data = await res.json();
        toast.error(data.error ?? "Failed to delete");
      }
    } catch {
      toast.error("Failed to delete entry");
    } finally {
      setDeletingLine(null);
    }
  };

  const handleAddSplit = async () => {
    if (!splitDialog || !splitLedgerId) return;
    const amt = parseFloat(splitAmount);
    if (isNaN(amt) || amt === 0) {
      toast.error("Enter a valid amount");
      return;
    }
    const sign = splitDialog.amount >= 0 ? 1 : -1;
    const amountToUse = sign * Math.abs(amt);
    try {
      const res = await fetch(`/api/reconciliation/lines/${splitDialog.id}/splits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amountToUse, ledgerEntryId: splitLedgerId }),
      });
      if (res.ok) {
        const list = await loadStatements();
        loadLedger();
        setSplitAmount("");
        setSplitLedgerId("");
        const st = list.find((s) => s.lines?.some((l) => l.id === splitDialog.id));
        const line = st?.lines?.find((l) => l.id === splitDialog.id);
        if (line) {
          const total = (line.splits ?? []).reduce((s, sp) => s + sp.amount, 0);
          setSplitDialog(Math.abs(total - line.amount) < 0.01 ? null : line);
        } else {
          setSplitDialog(null);
        }
        toast.success("Split added");
      } else {
        const data = await res.json();
        toast.error(data.error ?? "Failed to add split");
      }
    } catch {
      toast.error("Failed to add split");
    }
  };

  const handleRemoveSplit = async (splitId: string) => {
    if (!splitDialog) return;
    try {
      const res = await fetch(`/api/reconciliation/lines/${splitDialog.id}/splits/${splitId}`, { method: "DELETE" });
      if (res.ok) {
        const list = await loadStatements();
        loadLedger();
        const st = list.find((s) => s.lines?.some((l) => l.id === splitDialog.id));
        const line = st?.lines?.find((l) => l.id === splitDialog.id);
        if (line) setSplitDialog(line);
        toast.success("Split removed");
      }
    } catch {
      toast.error("Failed to remove split");
    }
  };

  const handleDeleteStatement = async () => {
    if (!deleteDialog) return;
    setDeleting(deleteDialog.id);
    try {
      const res = await fetch(`/api/reconciliation/${deleteDialog.id}`, { method: "DELETE" });
      if (res.ok) {
        loadStatements();
        loadLedger();
        setDeleteDialog(null);
        toast.success("Statement deleted");
      } else {
        const data = await res.json();
        toast.error(data.error ?? "Failed to delete");
      }
    } catch {
      toast.error("Failed to delete statement");
    } finally {
      setDeleting(null);
    }
  };

  const handleUnmatch = async (bankLineId: string) => {
    setMatching(bankLineId);
    try {
      const res = await fetch("/api/reconciliation/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankLineId, ledgerEntryId: null }),
      });
      if (res.ok) {
        loadStatements();
        loadLedger();
      }
    } finally {
      setMatching(null);
    }
  };

  const accountOptions = (accounts ?? [])
    .filter((a) => a?.code?.startsWith("1"))
    .map((a) => ({ value: a.id, label: `${a.code} - ${a.name}` }));

  // Flatten all bank lines from statements for this account
  const allBankLines = (statements ?? []).flatMap((st) => (st.lines ?? []));
  const matchedLedgerIds = new Set<string>();
  for (const l of allBankLines) {
    if (l.ledgerEntryId) matchedLedgerIds.add(l.ledgerEntryId);
    for (const sp of l.splits ?? []) {
      if (sp.ledgerEntryId) matchedLedgerIds.add(sp.ledgerEntryId);
    }
  }
  const unmatchedBankLines = allBankLines.filter((l) => {
    if (l.ledgerEntryId) return false;
    const splitsTotal = (l.splits ?? []).reduce((s, sp) => s + sp.amount, 0);
    return Math.abs(splitsTotal - l.amount) >= 0.01;
  });
  const unmatchedLedgerEntries = (ledgerEntries ?? []).filter((le) => !matchedLedgerIds.has(le.id));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Bank Reconciliation</h1>
        <p className="text-muted-foreground">
          Import bank statements and match them to ledger entries
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select account</CardTitle>
          <CardDescription>
            Choose the bank account to reconcile. Tabs will appear below once selected.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="min-w-[280px] max-w-md">
            <SearchableSelect
              options={accountOptions}
              value={selectedAccountId}
              onChange={(id) => {
                setSelectedAccountId(id);
                setActiveTab("reconcile");
              }}
              placeholder="Select bank account"
              searchPlaceholder="Search…"
            />
          </div>
        </CardContent>
      </Card>

      {selectedAccountId && selectedAccount && (
        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">
                  {selectedAccount.code} - {selectedAccount.name}
                </CardTitle>
                <CardDescription>
                  Reconcile bank statement lines with your account transactions
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => { loadStatements(); loadLedger(); }}>
                <RefreshCw className="mr-2 size-4" />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="reconcile">
                  Reconcile ({unmatchedBankLines.length})
                </TabsTrigger>
                <TabsTrigger value="bank-statements">Bank statements</TabsTrigger>
                <TabsTrigger value="account-transactions">Account transactions</TabsTrigger>
              </TabsList>

              <TabsContent value="reconcile" className="mt-0">
                <p className="mb-4 text-sm text-muted-foreground">
                  Match unmatched bank statement lines with account transactions. Only unmatched items are shown.
                </p>
                {unmatchedBankLines.length === 0 && unmatchedLedgerEntries.length === 0 ? (
                  <p className="text-muted-foreground">
                    All items are reconciled. Import a new statement or add journal entries to see unmatched items.
                  </p>
                ) : (
                  <div className="grid gap-6 lg:grid-cols-2">
                    <div>
                      <h3 className="mb-2 font-medium">Bank statement (unmatched)</h3>
                      <div className="max-h-[400px] overflow-auto rounded border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Description</TableHead>
                              <TableHead className="text-right">Amount</TableHead>
                              <TableHead className="w-32">Match to</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {unmatchedBankLines.map((line) => (
                              <TableRow key={line.id}>
                                <TableCell>{format(new Date(line.date), "MMM d, yyyy")}</TableCell>
                                <TableCell className="max-w-[180px] truncate">{line.description ?? "—"}</TableCell>
                                <TableCell
                                  className={`text-right font-mono ${
                                    line.amount >= 0 ? "" : "text-destructive"
                                  }`}
                                >
                                  {line.amount >= 0 ? "+" : ""}
                                  {line.amount.toFixed(2)}
                                </TableCell>
                                <TableCell>
                                  <select
                                    className="w-full rounded border bg-background px-2 py-1 text-sm"
                                    onChange={(e) => {
                                      const leId = e.target.value;
                                      if (leId) handleMatch(line.id, leId);
                                    }}
                                    value=""
                                  >
                                    <option value="">Match…</option>
                                    {unmatchedLedgerEntries.map((le) => (
                                      <option key={le.id} value={le.id}>
                                        {format(new Date(le.date), "MMM d")} {le.amount.toFixed(2)}{" "}
                                        {le.description ?? le.reference ?? ""}
                                      </option>
                                    ))}
                                  </select>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        {unmatchedBankLines.length === 0 && (
                          <p className="p-4 text-center text-sm text-muted-foreground">No unmatched bank lines</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <h3 className="mb-2 font-medium">Account transactions (unmatched)</h3>
                      <div className="max-h-[400px] overflow-auto rounded border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Description</TableHead>
                              <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {unmatchedLedgerEntries.map((le) => (
                              <TableRow key={le.id}>
                                <TableCell>{format(new Date(le.date), "MMM d, yyyy")}</TableCell>
                                <TableCell className="max-w-[180px] truncate">
                                  {le.description ?? le.reference ?? "—"}
                                </TableCell>
                                <TableCell
                                  className={`text-right font-mono ${
                                    le.amount >= 0 ? "" : "text-destructive"
                                  }`}
                                >
                                  {le.amount >= 0 ? "+" : ""}
                                  {le.amount.toFixed(2)} {le.currency}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        {unmatchedLedgerEntries.length === 0 && (
                          <p className="p-4 text-center text-sm text-muted-foreground">No unmatched transactions</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="bank-statements" className="mt-0">
                <div className="space-y-6">
                  <div>
                    <h3 className="mb-3 font-medium">Import bank statement</h3>
                    <p className="mb-3 text-sm text-muted-foreground">
                      Upload PDF or CSV. PDF (Bank AL Habib format) and CSV (Date, Description, Reference, Currency, Amount, Cr/Dr) supported. Debits negative, credits positive.
                    </p>
                    <div className="flex flex-wrap items-end gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">From</label>
                        <Input
                          type="date"
                          value={fromDate}
                          onChange={(e) => setFromDate(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">To</label>
                        <Input
                          type="date"
                          value={toDate}
                          onChange={(e) => setToDate(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Statement file</label>
                        <Input
                          type="file"
                          accept=".pdf,.csv"
                          onChange={handleFileChange}
                        />
                      </div>
                    </div>

                    {parsedPreview && parsedPreview.entries && parsedPreview.entries.length > 0 && (
                      <Card className="mt-4 border-dashed">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-base">
                            <FileCheck className="size-4" />
                            Verify entries ({parsedPreview.entries.length} rows)
                          </CardTitle>
                          <CardDescription>
                            Opening: {parsedPreview.openingBalance.toLocaleString()} | Closing: {parsedPreview.closingBalance.toLocaleString()}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="max-h-64 overflow-auto rounded border">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-muted/50">
                                  <TableHead>Date</TableHead>
                                  <TableHead>Description</TableHead>
                                  <TableHead className="text-right">Amount</TableHead>
                                  <TableHead>Currency</TableHead>
                                  <TableHead className="w-16"></TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {(parsedPreview.entries ?? []).map((e, i) => (
                                  <TableRow key={i}>
                                    <TableCell>{e.date}</TableCell>
                                    <TableCell className="max-w-[200px] truncate">{e.description || "—"}</TableCell>
                                    <TableCell
                                      className={`text-right font-mono ${
                                        e.amount < 0 ? "text-destructive" : "text-green-600 dark:text-green-400"
                                      }`}
                                    >
                                      {e.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </TableCell>
                                    <TableCell>{e.currency}</TableCell>
                                    <TableCell>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="size-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                        onClick={() => removePreviewEntry(i)}
                                        title="Remove entry"
                                      >
                                        <Trash2 className="size-4" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                          <div className="mt-4 flex justify-end">
                            <Button
                              onClick={handleImport}
                              disabled={importing}
                            >
                              <Upload className="mr-2 size-4" />
                              {importing ? "Importing…" : "Import statement"}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  <div>
                    <h3 className="mb-3 font-medium">Uploaded statements</h3>
                    {loading ? (
                      <p className="text-muted-foreground">Loading…</p>
                    ) : !statements || statements.length === 0 ? (
                      <p className="text-muted-foreground">No statements yet. Upload and import a PDF or CSV above.</p>
                    ) : (
                      <div className="space-y-4">
                        {statements.map((st) => (
                          <div key={st.id} className="rounded border p-4">
                            <div className="mb-2 flex items-center justify-between">
                              <h4 className="font-medium">
                                {format(new Date(st.fromDate), "MMM d")} – {format(new Date(st.toDate), "MMM d, yyyy")}
                              </h4>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                onClick={() =>
                                  setDeleteDialog({
                                    id: st.id,
                                    label: `${format(new Date(st.fromDate), "MMM d")} – ${format(new Date(st.toDate), "MMM d, yyyy")}`,
                                  })
                                }
                                disabled={deleting === st.id}
                              >
                                <Trash2 className="mr-1 size-4" />
                                Delete
                              </Button>
                            </div>
                            <div className="max-h-64 overflow-auto rounded border">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="w-24"></TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {(st.lines ?? []).map((line) => {
                                    const splitsTotal = (line.splits ?? []).reduce((s, sp) => s + sp.amount, 0);
                                    const isReconciled =
                                      line.ledgerEntryId
                                        ? true
                                        : (line.splits?.length ?? 0) > 0 && Math.abs(splitsTotal - line.amount) < 0.01;
                                    return (
                                      <TableRow key={line.id}>
                                        <TableCell>{format(new Date(line.date), "MMM d, yyyy")}</TableCell>
                                        <TableCell>
                                          <div>
                                            {line.description ?? "—"}
                                            {(line.splits ?? []).length > 0 && (
                                              <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                                                {(line.splits ?? []).map((sp) => (
                                                  <div key={sp.id}>
                                                    {sp.amount.toFixed(2)} → {sp.ledgerEntry?.journalEntry?.description ?? sp.ledgerEntry?.journalEntry?.reference ?? "—"}
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        </TableCell>
                                        <TableCell
                                          className={`text-right font-mono ${line.amount >= 0 ? "" : "text-destructive"}`}
                                        >
                                          {line.amount >= 0 ? "+" : ""}
                                          {line.amount.toFixed(2)}
                                        </TableCell>
                                        <TableCell>
                                          <span
                                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                              isReconciled
                                                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                                : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                                            }`}
                                          >
                                            {isReconciled ? "Reconciled" : "Unreconciled"}
                                          </span>
                                        </TableCell>
                                        <TableCell>
                                          <div className="flex items-center gap-1">
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="size-8 p-0"
                                              onClick={() => setSplitDialog(line)}
                                              title="Split transaction"
                                            >
                                              <SplitSquareVertical className="size-4" />
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="size-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                              onClick={() =>
                                                setDeleteLineDialog({
                                                  id: line.id,
                                                  description: (line.description ?? "").slice(0, 50) || "this entry",
                                                })
                                              }
                                              disabled={deletingLine === line.id}
                                              title="Delete entry"
                                            >
                                              <Trash2 className="size-4" />
                                            </Button>
                                          </div>
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="account-transactions" className="mt-0">
                <p className="mb-4 text-sm text-muted-foreground">
                  Journal entries (ledger) for this account. These are your internal records.
                </p>
                {loading ? (
                  <p className="text-muted-foreground">Loading…</p>
                ) : (
                  <div className="max-h-[500px] overflow-auto rounded border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Reference</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(ledgerEntries ?? []).map((le) => (
                          <TableRow key={le.id}>
                            <TableCell>{format(new Date(le.date), "MMM d, yyyy")}</TableCell>
                            <TableCell>{le.description ?? "—"}</TableCell>
                            <TableCell>{le.reference ?? "—"}</TableCell>
                            <TableCell
                              className={`text-right font-mono ${
                                le.amount >= 0 ? "" : "text-destructive"
                              }`}
                            >
                              {le.amount >= 0 ? "+" : ""}
                              {le.amount.toFixed(2)} {le.currency}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {(ledgerEntries ?? []).length === 0 && (
                      <p className="p-6 text-center text-muted-foreground">No account transactions yet.</p>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={!!deleteDialog}
        onOpenChange={(open) => !open && setDeleteDialog(null)}
        title="Delete statement"
        description={
          deleteDialog
            ? `Are you sure you want to delete the statement for ${deleteDialog.label}? This will remove all lines and their reconciliation matches.`
            : ""
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={handleDeleteStatement}
      />

      <ConfirmDialog
        open={!!deleteLineDialog}
        onOpenChange={(open) => !open && setDeleteLineDialog(null)}
        title="Delete entry"
        description={
          deleteLineDialog
            ? `Are you sure you want to delete this entry? "${deleteLineDialog.description}${deleteLineDialog.description.length >= 50 ? "…" : ""}"`
            : ""
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={handleDeleteLine}
      />

      <Dialog open={!!splitDialog} onOpenChange={(open) => !open && setSplitDialog(null)}>
        <DialogContent showCloseButton className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Split transaction</DialogTitle>
          </DialogHeader>
          {splitDialog && (
            <>
              <p className="text-sm text-muted-foreground">
                Total: {splitDialog.amount >= 0 ? "+" : ""}
                {splitDialog.amount.toFixed(2)} • Allocated:{" "}
                {(splitDialog.splits ?? []).reduce((s, sp) => s + sp.amount, 0).toFixed(2)} • Remaining:{" "}
                {(splitDialog.amount - (splitDialog.splits ?? []).reduce((s, sp) => s + sp.amount, 0)).toFixed(2)}
              </p>
              {splitDialog.ledgerEntryId && (
                <div className="flex items-center justify-between rounded border bg-muted/30 px-2 py-1 text-sm">
                  <span>
                    {splitDialog.amount.toFixed(2)} (full) → {splitDialog.ledgerEntry?.journalEntry?.description ?? splitDialog.ledgerEntry?.journalEntry?.reference ?? "—"}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-destructive"
                    onClick={async () => {
                      await handleUnmatch(splitDialog.id);
                      const list = await loadStatements();
                      const st = list.find((s) => s.lines?.some((l) => l.id === splitDialog.id));
                      const line = st?.lines?.find((l) => l.id === splitDialog.id);
                      if (line) setSplitDialog(line);
                    }}
                  >
                    Unmatch to split
                  </Button>
                </div>
              )}
              {(splitDialog.splits ?? []).map((sp) => (
                <div key={sp.id} className="flex items-center justify-between rounded border bg-muted/30 px-2 py-1 text-sm">
                  <span>
                    {sp.amount.toFixed(2)} → {sp.ledgerEntry?.journalEntry?.description ?? sp.ledgerEntry?.journalEntry?.reference ?? "—"}
                  </span>
                  <Button variant="ghost" size="sm" className="h-6 text-destructive" onClick={() => handleRemoveSplit(sp.id)}>
                    Remove
                  </Button>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Amount"
                  value={splitAmount}
                  onChange={(e) => setSplitAmount(e.target.value)}
                  className="w-24"
                />
                <select
                  className="rounded border bg-background px-2 py-1.5 text-sm"
                  value={splitLedgerId}
                  onChange={(e) => setSplitLedgerId(e.target.value)}
                >
                  <option value="">Select transaction…</option>
                  {(ledgerEntries ?? []).map((le) => (
                    <option key={le.id} value={le.id}>
                      {format(new Date(le.date), "MMM d")} {le.amount.toFixed(2)} {le.description ?? le.reference ?? ""}
                    </option>
                  ))}
                </select>
                <Button size="sm" onClick={handleAddSplit} disabled={!splitAmount || !splitLedgerId}>
                  Add split
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
