"use client";

import { Moon, Sun, LogOut, User, Search } from "lucide-react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useThemeStore } from "@/stores/theme-store";
import { CommandPalette } from "@/components/CommandPalette";

export function Header({ userEmail }: { userEmail?: string | null }) {
  const { isDark, toggle } = useThemeStore();

  return (
    <>
      <CommandPalette />
      <header className="flex h-14 items-center justify-end gap-2 border-b border-border bg-background px-4">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => document.dispatchEvent(new CustomEvent("open-search"))}
        title="Search (⌘K)"
      >
        <Search className="size-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={toggle} title="Toggle theme">
        {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon">
              <User className="size-4" />
              <span className="sr-only">User menu</span>
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          {userEmail && (
            <DropdownMenuItem disabled className="font-normal">
              {userEmail}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-destructive focus:text-destructive"
          >
            <LogOut className="mr-2 size-4" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
    </>
  );
}
