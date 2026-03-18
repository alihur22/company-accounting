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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Plus, Pencil, Trash2, Landmark, Wallet } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const ACCOUNT_TYPES = [
  { value: "ASSET", label: "Asset" },
  { value: "LIABILITY", label: "Liability" },
  { value: "EQUITY", label: "Equity" },
  { value: "REVENUE", label: "Revenue" },
  { value: "EXPENSE", label: "Expense" },
] as const;

const ACCOUNT_SUB_TYPES = [
  { value: "none", label: "None" },
  { value: "BANK", label: "Bank (revenue in, expenses out)" },
  { value: "INVESTMENT", label: "Investment" },
  { value: "RECEIVABLE", label: "Receivable" },
  { value: "PAYABLE", label: "Payable" },
] as const;

type Account = {
  id: string;
  code: string;
  name: string;
  type: string;
  subType: string | null;
  parentId: string | null;
  parent: { name: string } | null;
  currency: { id: string; code: string } | null;
  isSystem: boolean;
  balance?: number;
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currencies, setCurrencies] = useState<{ id: string; code: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: "",
    name: "",
    type: "ASSET",
    subType: "none",
    parentId: "",
    currencyId: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);
  const [openingBalanceOpen, setOpeningBalanceOpen] = useState(false);
  const [openingBalanceAccount, setOpeningBalanceAccount] = useState<Account | null>(null);
  const [openingBalanceForm, setOpeningBalanceForm] = useState({ amount: "", date: format(new Date(), "yyyy-MM-dd") });
  const [openingBalanceSaving, setOpeningBalanceSaving] = useState(false);
  const [openingBalanceError, setOpeningBalanceError] = useState("");

  const loadData = async () => {
    try {
      const [accRes, currRes] = await Promise.all([
        fetch("/api/accounts"),
        fetch("/api/currencies"),
      ]);
      if (accRes.ok) setAccounts(await accRes.json());
      if (currRes.ok) setCurrencies(await currRes.json());
    } catch {
      setError("Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ code: "", name: "", type: "ASSET", subType: "none", parentId: "", currencyId: "" });
    setDialogOpen(true);
    setError("");
  };

  const openEdit = (a: Account) => {
    setEditingId(a.id);
    setForm({
      code: a.code,
      name: a.name,
      type: a.type,
      subType: a.subType || "none",
      parentId: a.parentId || "",
      currencyId: a.currency?.id || "",
    });
    setDialogOpen(true);
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const url = editingId ? `/api/accounts/${editingId}` : "/api/accounts";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          subType: form.subType && form.subType !== "none" ? form.subType : null,
          parentId: form.parentId || null,
          currencyId: form.currencyId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      setDialogOpen(false);
      loadData();
      toast.success(editingId ? "Account updated" : "Account created");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const openOpeningBalance = (a: Account) => {
    setOpeningBalanceAccount(a);
    setOpeningBalanceForm({ amount: "", date: format(new Date(), "yyyy-MM-dd") });
    setOpeningBalanceOpen(true);
    setOpeningBalanceError("");
  };

  const handleOpeningBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!openingBalanceAccount) return;
    const amount = parseFloat(openingBalanceForm.amount);
    if (isNaN(amount) || amount === 0) {
      setOpeningBalanceError("Enter a non-zero amount");
      return;
    }
    setOpeningBalanceError("");
    setOpeningBalanceSaving(true);
    try {
      const res = await fetch(`/api/accounts/${openingBalanceAccount.id}/opening-balance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          date: openingBalanceForm.date,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to add opening balance");
      setOpeningBalanceOpen(false);
      setOpeningBalanceAccount(null);
      loadData();
      toast.success("Opening balance added");
    } catch (err) {
      setOpeningBalanceError(err instanceof Error ? err.message : "Failed");
    } finally {
      setOpeningBalanceSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    try {
      const res = await fetch(`/api/accounts/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to delete");
      setDeleteTarget(null);
      loadData();
      toast.success("Account deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const accountOptions = accounts.map((a) => ({
    value: a.id,
    label: `${a.code} - ${a.name}`,
  }));
  const fmt = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const currencyOptions = currencies.map((c) => ({
    value: c.id,
    label: c.code,
  }));

  if (loading) {
    return (
      <div>
        <div className="mb-6 flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
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
        <h1 className="text-2xl font-semibold">Accounts</h1>
        <Button onClick={openCreate}>
          <Plus className="mr-2 size-4" />
          Add account
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Landmark className="size-5" />
            Posting accounts
          </CardTitle>
          <CardDescription>
            Manage your accounts (Bank, Investment, etc.) for recording transactions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 rounded-full bg-muted p-4">
                <Landmark className="size-10 text-muted-foreground" />
              </div>
              <h3 className="mb-1 font-medium">No accounts yet</h3>
              <p className="mb-4 max-w-sm text-sm text-muted-foreground">
                Create your first account (e.g. Bank account, Investment account) to start recording transactions.
              </p>
              <Button onClick={openCreate}>
                <Plus className="mr-2 size-4" />
                Add your first account
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Sub-type</TableHead>
                  <TableHead>Parent</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="w-40"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono">{a.code}</TableCell>
                    <TableCell>{a.name}</TableCell>
                    <TableCell>{a.type}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {a.subType ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {a.parent?.name ?? "—"}
                    </TableCell>
                    <TableCell>{a.currency?.code ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono">
                      {a.balance != null ? (
                        <span className={a.balance < 0 ? "text-destructive" : ""}>
                          {fmt(a.balance)} {a.currency?.code ?? "USD"}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {!a.isSystem && (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => openOpeningBalance(a)}
                            title="Add opening balance"
                          >
                            <Wallet className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => openEdit(a)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setDeleteTarget(a)}
                            className="text-destructive"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit account" : "Add account"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">Code</label>
              <Input
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="e.g. 1101"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Chase Checking"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm((f) => ({ ...f, type: v ?? f.type }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Sub-type</label>
              <Select
                value={form.subType || "none"}
                onValueChange={(v) => setForm((f) => ({ ...f, subType: v ?? "none" }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_SUB_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Parent account</label>
              <SearchableSelect
                options={accountOptions.filter((o) => o.value !== editingId)}
                value={form.parentId}
                onChange={(v) => setForm((f) => ({ ...f, parentId: v }))}
                placeholder="None"
                searchPlaceholder="Search accounts…"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Currency</label>
              <SearchableSelect
                options={currencyOptions}
                value={form.currencyId}
                onChange={(v) => setForm((f) => ({ ...f, currencyId: v }))}
                placeholder="None"
                searchPlaceholder="Search currencies…"
              />
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

      <Dialog open={openingBalanceOpen} onOpenChange={(open) => !open && (setOpeningBalanceOpen(false), setOpeningBalanceAccount(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add opening balance</DialogTitle>
            {openingBalanceAccount && (
              <p className="text-sm text-muted-foreground">
                {openingBalanceAccount.code} - {openingBalanceAccount.name}
              </p>
            )}
          </DialogHeader>
          <form onSubmit={handleOpeningBalance} className="space-y-4">
            {openingBalanceError && (
              <p className="text-sm text-destructive">{openingBalanceError}</p>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">Amount</label>
              <Input
                type="number"
                step="0.01"
                value={openingBalanceForm.amount}
                onChange={(e) => setOpeningBalanceForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="e.g. 10000"
                required
              />
              <p className="text-xs text-muted-foreground">
                Positive for assets (e.g. cash in bank). Negative for overdrawn/liabilities.
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Date</label>
              <Input
                type="date"
                value={openingBalanceForm.date}
                onChange={(e) => setOpeningBalanceForm((f) => ({ ...f, date: e.target.value }))}
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => (setOpeningBalanceOpen(false), setOpeningBalanceAccount(null))}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={openingBalanceSaving}>
                {openingBalanceSaving ? "Adding…" : "Add opening balance"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete account"
        description={deleteTarget ? `Are you sure you want to delete "${deleteTarget.code} - ${deleteTarget.name}"?` : ""}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
