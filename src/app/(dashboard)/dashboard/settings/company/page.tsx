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
import { SearchableSelect } from "@/components/SearchableSelect";

type Company = {
  id: string;
  name: string;
  financialYearStart: string;
  financialYearEnd: string;
  baseCurrencyId: string;
  baseCurrency: { id: string; code: string; name: string };
};

type Currency = { id: string; code: string; name: string };

export default function CompanySettingsPage() {
  const [company, setCompany] = useState<Company | null>(null);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    financialYearStart: "01-01",
    financialYearEnd: "12-31",
    baseCurrencyId: "",
  });

  useEffect(() => {
    async function load() {
      try {
        const [companyRes, currenciesRes] = await Promise.all([
          fetch("/api/company"),
          fetch("/api/currencies"),
        ]);
        if (companyRes.ok) {
          const c = await companyRes.json();
          setCompany(c);
          setForm({
            name: c.name,
            financialYearStart: c.financialYearStart,
            financialYearEnd: c.financialYearEnd,
            baseCurrencyId: c.baseCurrencyId,
          });
        }
        if (currenciesRes.ok) {
          const list = await currenciesRes.json();
          setCurrencies(list);
        }
      } catch {
        setError("Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/company", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to save");
      }
      const updated = await res.json();
      setCompany(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-muted-foreground">Loading…</div>;
  }

  if (!company) {
    return <div className="text-destructive">Company not found</div>;
  }

  const currencyOptions = currencies.map((c) => ({
    value: c.id,
    label: `${c.code} - ${c.name}`,
  }));

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Company Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle>Company Profile</CardTitle>
          <CardDescription>
            Basic business details and financial year configuration
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">Company name</label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Financial year start (MM-DD)</label>
                <Input
                  value={form.financialYearStart}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, financialYearStart: e.target.value }))
                  }
                  placeholder="01-01"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Financial year end (MM-DD)</label>
                <Input
                  value={form.financialYearEnd}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, financialYearEnd: e.target.value }))
                  }
                  placeholder="12-31"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Base currency</label>
              <SearchableSelect
                options={currencyOptions}
                value={form.baseCurrencyId}
                onChange={(v) => setForm((f) => ({ ...f, baseCurrencyId: v }))}
                placeholder="Select base currency"
                searchPlaceholder="Search currencies…"
              />
            </div>
          </CardContent>
          <CardContent className="pt-0">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
