"use client";

import { ChartColumn, HandCoins, House, LayoutList, Menu, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useApp } from "./app-provider";

const TABS = [
  { href: "/", label: "Home", icon: House },
  { href: "/entries", label: "Entries", icon: LayoutList },
  { href: "/charts", label: "Charts", icon: ChartColumn },
  { href: "/owed", label: "Money owed", icon: HandCoins },
  { href: "/more", label: "More", icon: Menu },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}

/** Bottom tab bar on phones, sidebar on laptops, and the floating "+" button. */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { openAdd } = useApp();

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-1 border-r bg-sidebar p-4 md:flex" aria-label="Main">
        <Link href="/" className="mb-4 flex items-center gap-2 px-2 text-lg font-bold">
          <span className="grid size-8 place-items-center rounded-lg bg-foreground text-background">₹</span>
          Money Tracker
        </Link>
        <button
          type="button"
          onClick={() => openAdd()}
          className="mb-3 flex h-10 items-center justify-center gap-2 rounded-lg bg-foreground px-3 text-sm font-semibold text-background"
        >
          <Plus className="size-4" /> Add entry
        </button>
        <nav className="flex flex-col gap-1">
          {TABS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(pathname, href) ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-sidebar-accent hover:text-foreground",
                isActive(pathname, href) && "bg-sidebar-accent text-foreground",
              )}
            >
              <Icon className="size-4" /> {label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="min-w-0">
        <main className="mx-auto w-full max-w-2xl px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:px-8 md:pt-8 md:pb-24">
          {children}
        </main>
      </div>

      {/* Floating add button */}
      <button
        type="button"
        onClick={() => openAdd()}
        aria-label="Add entry"
        className="fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 grid size-14 place-items-center rounded-full bg-foreground text-background shadow-lg transition active:scale-95 md:right-8 md:bottom-8"
      >
        <Plus className="size-7" />
      </button>

      <nav
        aria-label="Tabs"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {TABS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(pathname, href) ? "page" : undefined}
            className={cn(
              "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground",
              isActive(pathname, href) && "text-foreground",
            )}
          >
            <Icon className={cn("size-5", isActive(pathname, href) && "stroke-[2.5]")} />
            <span className="leading-none">{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
