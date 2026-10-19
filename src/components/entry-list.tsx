"use client";

import { dayLabel } from "@/lib/dates";
import { formatRupees } from "@/lib/money";
import { groupByDay } from "@/lib/summary";
import type { Category, Entry, Wallet } from "@/lib/types";
import { Amount, inClass, outClass } from "./amount";
import { useApp } from "./app-provider";
import { CategoryIcon } from "./category-icon";

/** Entries grouped by day with day totals. Tap an entry to edit it. */
export function EntryList({
  entries,
  categories,
  wallets,
  today,
  groupDays = true,
}: {
  entries: Entry[];
  categories: Category[];
  wallets: Wallet[];
  today: string;
  groupDays?: boolean;
}) {
  const catById = new Map(categories.map((c) => [c.id, c]));
  const walletById = new Map(wallets.map((w) => [w.id, w]));
  const showWallet = wallets.filter((w) => !w.hidden).length > 1;

  const rows = (list: Entry[]) => (
    <div className="divide-y overflow-hidden rounded-xl border bg-card">
      {list.map((e) => (
        <EntryRow key={e.id} entry={e} category={catById.get(e.categoryId)} walletName={showWallet ? walletById.get(e.walletId)?.name : undefined} today={today} showDate={!groupDays} />
      ))}
    </div>
  );

  if (!groupDays) return rows(entries);

  return (
    <div className="space-y-5">
      {groupByDay(entries).map((g) => (
        <section key={g.date} aria-label={dayLabel(g.date, today)}>
          <h3 className="flex items-baseline justify-between px-1 pb-2 text-sm font-semibold text-muted-foreground">
            <span>{dayLabel(g.date, today)}</span>
            <span className="flex gap-2.5 tabular-nums" data-testid="day-total">
              {g.outPaise > 0 && <span className={outClass}>−{formatRupees(g.outPaise)}</span>}
              {g.inPaise > 0 && <span className={inClass}>+{formatRupees(g.inPaise)}</span>}
            </span>
          </h3>
          {rows(g.entries)}
        </section>
      ))}
    </div>
  );
}

function EntryRow({
  entry,
  category,
  walletName,
  today,
  showDate,
}: {
  entry: Entry;
  category?: Category;
  walletName?: string;
  today: string;
  showDate: boolean;
}) {
  const { openEdit } = useApp();
  const meta = [showDate ? dayLabel(entry.date, today) : null, category?.name, entry.paymentMode, walletName].filter(Boolean).join(" · ");
  return (
    <button
      type="button"
      onClick={() => openEdit(entry)}
      className="flex w-full items-center gap-3 px-3 py-3 text-left transition hover:bg-accent/60 active:bg-accent"
      data-testid="entry"
    >
      <CategoryIcon icon={category?.icon ?? "circle"} color={category?.color ?? "#64748b"} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{entry.note}</span>
        <span className="block truncate text-sm text-muted-foreground">
          {meta}
          {entry.tags.length > 0 && <span className="ml-1.5">{entry.tags.map((t) => "#" + t).join(" ")}</span>}
        </span>
      </span>
      <Amount paise={entry.amountPaise} type={entry.type} />
    </button>
  );
}
