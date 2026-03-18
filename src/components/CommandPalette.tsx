"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Search, BookOpen, FileText } from "lucide-react";
import { format } from "date-fns";

type SearchResult = {
  accounts: { id: string; code: string; name: string; type: string; href: string }[];
  journalEntries: { id: string; date: string; description: string | null; reference: string | null; preview: string; href: string }[];
};

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (res.ok) setResults(await res.json());
      else setResults(null);
    } catch {
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(query), 200);
    return () => clearTimeout(t);
  }, [query, search]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
        setQuery("");
      }
    };
    const openSearch = () => {
      setOpen(true);
      setQuery("");
    };
    document.addEventListener("keydown", down);
    document.addEventListener("open-search", openSearch);
    return () => {
      document.removeEventListener("keydown", down);
      document.removeEventListener("open-search", openSearch);
    };
  }, []);

  const handleSelect = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0">
        <Command shouldFilter={false} className="rounded-lg border-0 shadow-none">
          <CommandInput
            placeholder="Search accounts and journal entries…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>
              {loading ? "Searching…" : query.length < 2 ? "Type to search (min 2 chars)" : "No results."}
            </CommandEmpty>
            {results && (
              <>
                {results.accounts.length > 0 && (
                  <CommandGroup heading="Accounts">
                    {results.accounts.map((a) => (
                      <CommandItem
                        key={a.id}
                        value={`account-${a.id}`}
                        onSelect={() => handleSelect(a.href)}
                      >
                        <BookOpen className="mr-2 size-4" />
                        <span className="font-mono">{a.code}</span>
                        <span className="ml-2 text-muted-foreground">{a.name}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {results.journalEntries.length > 0 && (
                  <CommandGroup heading="Journal entries">
                    {results.journalEntries.map((je) => (
                      <CommandItem
                        key={je.id}
                        value={`je-${je.id}`}
                        onSelect={() => handleSelect(je.href)}
                      >
                        <FileText className="mr-2 size-4" />
                        <span className="text-muted-foreground">
                          {format(new Date(je.date), "MMM d")}
                        </span>
                        <span className="ml-2 truncate">
                          {je.description || je.reference || je.preview || "—"}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </>
            )}
          </CommandList>
        </Command>
        <p className="border-t px-3 py-2 text-xs text-muted-foreground">
          <kbd className="rounded border px-1.5 py-0.5">⌘K</kbd> to open
        </p>
      </DialogContent>
    </Dialog>
  );
}
