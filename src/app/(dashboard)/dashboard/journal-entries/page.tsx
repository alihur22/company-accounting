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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Plus, Trash2, Upload, Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type LedgerEntry = {
  id: string;
  accountId: string;
  account: { code: string; name: string };
  debit: number;
  credit: number;
  currency: { code: string };
  amountInBase: number;
};

type JournalEntry = {
  id: string;
  date: string;
  description: string | null;
  reference: string | null;
  ledgerEntries: LedgerEntry[];
};

type LineForm = {
  accountId: string;
  debit: string;
  credit: string;
  currencyId: string;
};

export default function JournalEntriesPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<{ id: string; code: string; name: string }[]>([]);
  const [currencies, setCurrencies] = useState<{ id: string; code: string }[]>([]);
  const [baseCurrencyId, setBaseCurrencyId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    date: format(new Date(), "yyyy-MM-dd"),
    description: "",
    reference: "",
    lines: [{ accountId: "", debit: "", credit: "", currencyId: "" }] as LineForm[],
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; errors?: string[] } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const loadData = async () => {
    try {
      const [jeRes, accRes, currRes, companyRes] = await Promise.all([
        fetch("/api/journal-entries"),
        fetch("/api/accounts"),
        fetch("/api/currencies"),
        fetch("/api/company"),
      ]);
      if (jeRes.ok) setEntries(await jeRes.json());
      if (accRes.ok) setAccounts(await accRes.json());
      if (currRes.ok) setCurrencies(await currRes.json());
      if (companyRes.ok) {
        const company = await companyRes.json();
        setBaseCurrencyId(company.baseCurrencyId || "");
      }
    } catch {
      setError("Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const defaultCurrencyId = baseCurrencyId || currencies[0]?.id || "";

  const openCreate = () => {
    setForm({
      date: format(new Date(), "yyyy-MM-dd"),
      description: "",
      reference: "",
      lines: [
        {
          accountId: "",
          debit: "",
          credit: "",
          currencyId: defaultCurrencyId,
        },
      ],
    });
    setDialogOpen(true);
    setError("");
  };

  const addLine = () => {
    setForm((f) => ({
      ...f,
      lines: [
        ...f.lines,
        {
          accountId: "",
          debit: "",
          credit: "",
          currencyId: defaultCurrencyId,
        },
      ],
    }));
  };

  const removeLine = (idx: number) => {
    setForm((f) => ({
      ...f,
      lines: f.lines.filter((_, i) => i !== idx),
    }));
  };

  const updateLine = (idx: number, field: keyof LineForm, value: string) => {
    setForm((f) => ({
      ...f,
      lines: f.lines.map((l, i) =>
        i === idx ? { ...l, [field]: value } : l
      ),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const lines = form.lines
        .filter((l) => l.accountId && (l.debit || l.credit))
        .map((l) => ({
          accountId: l.accountId,
          debit: parseFloat(l.debit) || 0,
          credit: parseFloat(l.credit) || 0,
          currencyId: l.currencyId || defaultCurrencyId,
        }));

      if (lines.length < 2) {
        setError("At least 2 lines required; debits must equal credits");
        setSaving(false);
        return;
      }

      const res = await fetch("/api/journal-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: form.date,
          description: form.description || undefined,
          reference: form.reference || undefined,
          lines,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      setDialogOpen(false);
      loadData();
      toast.success("Journal entry created");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === entries.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(entries.map((e) => e.id)));
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/journal-entries", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      if (res.ok) {
        setSelectedIds(new Set());
        loadData();
        toast.success(`Deleted ${selectedIds.size} journal entr${selectedIds.size === 1 ? "y" : "ies"}`);
      } else {
        const data = await res.json();
        toast.error(data.error ?? "Failed to delete");
      }
    } catch {
      toast.error("Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  const accountOptions = accounts.map((a) => ({
    value: a.id,
    label: `${a.code} - ${a.name}`,
  }));
  const currencyOptions = currencies.map((c) => ({
    value: c.id,
    label: c.code,
  }));

  if (loading) {
    return (
      <div>
        <div className="mb-6 flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-96" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Journal Entries</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setImportOpen(true); setImportResult(null); setImportFile(null); }}>
            <Upload className="mr-2 size-4" />
            Import CSV
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-2 size-4" />
            New entry
          </Button>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Entries</CardTitle>
          <CardDescription>
            Create manual journal entries. Each entry must have at least 2 lines
            with debits equal to credits.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 rounded-full bg-muted p-4">
                <FileText className="size-10 text-muted-foreground" />
              </div>
              <h3 className="mb-1 font-medium">No journal entries yet</h3>
              <p className="mb-4 max-w-sm text-sm text-muted-foreground">
                Create manual journal entries to record transactions. Each entry needs at least 2 lines with debits equal to credits.
              </p>
              <div className="flex gap-2">
                <Button onClick={openCreate}>
                  <Plus className="mr-2 size-4" />
                  New entry
                </Button>
                <Button variant="outline" onClick={() => { setImportOpen(true); setImportResult(null); setImportFile(null); }}>
                  <Upload className="mr-2 size-4" />
                  Import CSV
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-4 flex items-center gap-4">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={entries.length > 0 && selectedIds.size === entries.length}
                    onChange={toggleSelectAll}
                    className="size-4 rounded border-border"
                  />
                  Select all
                </label>
                {selectedIds.size > 0 && (
                  <>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setConfirmDeleteOpen(true)}
                      disabled={deleting}
                    >
                      <Trash2 className="mr-2 size-4" />
                      Delete {selectedIds.size} selected
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                      Clear selection
                    </Button>
                  </>
                )}
              </div>
              <div className="space-y-6">
                {entries.map((je) => (
                  <div
                    key={je.id}
                    className="flex gap-3 rounded-lg border border-border p-4"
                  >
                    <label className="flex shrink-0 items-center pt-1">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(je.id)}
                        onChange={() => toggleSelect(je.id)}
                        className="size-4 rounded border-border"
                      />
                    </label>
                    <div className="min-w-0 flex-1">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex gap-4">
                      <span className="font-medium">
                        {format(new Date(je.date), "MMM d, yyyy")}
                      </span>
                      {je.reference && (
                        <span className="text-muted-foreground">
                          Ref: {je.reference}
                        </span>
                      )}
                    </div>
                    {je.description && (
                      <p className="text-sm text-muted-foreground">
                        {je.description}
                      </p>
                    )}
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Account</TableHead>
                        <TableHead className="text-right">Debit</TableHead>
                        <TableHead className="text-right">Credit</TableHead>
                        <TableHead>Currency</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {je.ledgerEntries.map((le) => (
                        <TableRow key={le.id}>
                          <TableCell className="font-mono">
                            {le.account.code} - {le.account.name}
                          </TableCell>
                          <TableCell className="text-right">
                            {le.debit > 0 ? le.debit.toFixed(2) : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {le.credit > 0 ? le.credit.toFixed(2) : "—"}
                          </TableCell>
                          <TableCell>{le.currency.code}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New journal entry</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Date</label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Reference</label>
                <Input
                  value={form.reference}
                  onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Lines</label>
                <Button type="button" variant="outline" size="sm" onClick={addLine}>
                  <Plus className="mr-1 size-4" />
                  Add line
                </Button>
              </div>
              <div className="space-y-2">
                {form.lines.map((line, idx) => (
                  <div
                    key={idx}
                    className="flex flex-wrap items-end gap-2 rounded border border-border p-2"
                  >
                    <div className="min-w-[180px] flex-1 space-y-1">
                      <label className="text-xs text-muted-foreground">Account</label>
                      <SearchableSelect
                        options={accountOptions}
                        value={line.accountId}
                        onChange={(v) => updateLine(idx, "accountId", v)}
                        placeholder="Select account"
                        searchPlaceholder="Search accounts…"
                      />
                    </div>
                    <div className="w-24 space-y-1">
                      <label className="text-xs text-muted-foreground">Debit</label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0"
                        value={line.debit}
                        onChange={(e) => {
                          updateLine(idx, "debit", e.target.value);
                          if (e.target.value) updateLine(idx, "credit", "");
                        }}
                      />
                    </div>
                    <div className="w-24 space-y-1">
                      <label className="text-xs text-muted-foreground">Credit</label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0"
                        value={line.credit}
                        onChange={(e) => {
                          updateLine(idx, "credit", e.target.value);
                          if (e.target.value) updateLine(idx, "debit", "");
                        }}
                      />
                    </div>
                    <div className="w-20 space-y-1">
                      <label className="text-xs text-muted-foreground">Curr</label>
                      <SearchableSelect
                        options={currencyOptions}
                        value={line.currencyId || defaultCurrencyId}
                        onChange={(v) => updateLine(idx, "currencyId", v)}
                        placeholder="USD"
                        searchPlaceholder="Search…"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeLine(idx)}
                      disabled={form.lines.length <= 1}
                      className="text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import journal entries from CSV</DialogTitle>
            <CardDescription>
              Format: date, account_code, debit, credit, currency_code, description, reference.
              Rows with same date+description+reference are grouped into one entry.
            </CardDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept=".csv"
                onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
              />
              <Button
                variant="outline"
                size="icon"
                title="Download template"
                onClick={() => {
                  const csv = "date,account_code,debit,credit,currency_code,description,reference\n2024-01-15,1000,1000,0,USD,Cash received,INV-001\n2024-01-15,4000,0,1000,USD,Cash received,INV-001";
                  const blob = new Blob([csv], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "journal-import-template.csv";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                <Download className="size-4" />
              </Button>
            </div>
            {importResult && (
              <div className="rounded border p-3 text-sm">
                <p className="font-medium">Imported {importResult.created} entries.</p>
                {importResult.errors && importResult.errors.length > 0 && (
                  <ul className="mt-2 list-inside list-disc text-destructive">
                    {importResult.errors.slice(0, 5).map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                    {importResult.errors.length > 5 && (
                      <li>…and {importResult.errors.length - 5} more</li>
                    )}
                  </ul>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setImportOpen(false)}
            >
              Close
            </Button>
            <Button
              disabled={!importFile || importing}
              onClick={async () => {
                if (!importFile) return;
                setImporting(true);
                setImportResult(null);
                try {
                  const formData = new FormData();
                  formData.append("file", importFile);
                  const res = await fetch("/api/journal-entries/import", {
                    method: "POST",
                    body: formData,
                  });
                  const data = await res.json();
                  if (res.ok) {
                    setImportResult(data);
                    loadData();
                    if (data.created > 0) toast.success(`Imported ${data.created} entries`);
                    if (data.errors?.length) toast.warning(`${data.errors.length} entries had errors`);
                  } else {
                    setImportResult({ created: 0, errors: [data.error ?? "Import failed"] });
                    toast.error(data.error ?? "Import failed");
                  }
                } catch {
                  setImportResult({ created: 0, errors: ["Import failed"] });
                  toast.error("Import failed");
                } finally {
                  setImporting(false);
                }
              }}
            >
              {importing ? "Importing…" : "Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Delete journal entries"
        description={`Are you sure you want to delete ${selectedIds.size} journal entr${selectedIds.size === 1 ? "y" : "ies"}? This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleBulkDelete}
      />
    </div>
  );
}
