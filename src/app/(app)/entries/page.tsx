import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { inClass, outClass } from "@/components/amount";
import { EntryList } from "@/components/entry-list";
import { Card, EmptyState, ListSkeleton, PageTitle, SummarySkeleton } from "@/components/page-bits";
import { monthLabel } from "@/lib/dates";
import { formatRupees } from "@/lib/money";
import { cn } from "@/lib/utils";
import { getMonthEntries } from "@/server/data";

export default function EntriesPage({ searchParams }: PageProps<"/entries">) {
  return (
    <>
      <PageTitle>Entries</PageTitle>
      <Suspense
        fallback={
          <div className="space-y-4">
            <SummarySkeleton />
            <ListSkeleton />
          </div>
        }
      >
        <EntriesContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function EntriesContent({ searchParams }: { searchParams: PageProps<"/entries">["searchParams"] }) {
  const sp = await searchParams;
  const month = typeof sp.month === "string" ? sp.month : undefined;
  const d = await getMonthEntries(month);
  const t = d.totals;

  return (
    <div className="space-y-4">
      <nav className="flex items-center justify-between" aria-label="Month">
        <Link
          href={`/entries?month=${d.prevMonth}`}
          aria-label="Previous month"
          className="grid size-10 place-items-center rounded-lg border"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <h2 className="text-base font-semibold" data-testid="month-label">
          {monthLabel(d.range.from)}
        </h2>
        {d.nextMonth ? (
          <Link href={`/entries?month=${d.nextMonth}`} aria-label="Next month" className="grid size-10 place-items-center rounded-lg border">
            <ChevronRight className="size-5" />
          </Link>
        ) : (
          <span aria-hidden="true" className="grid size-10 place-items-center rounded-lg border opacity-40">
            <ChevronRight className="size-5" />
          </span>
        )}
      </nav>

      <Card className="grid grid-cols-3 gap-2 text-center" aria-label="Month totals">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Money In</p>
          <p className={cn("font-semibold tabular-nums", inClass)} data-testid="entries-in">
            {formatRupees(t.inPaise)}
          </p>
        </div>
        <div className="border-x">
          <p className="text-xs font-medium text-muted-foreground">Money Out</p>
          <p className={cn("font-semibold tabular-nums", outClass)} data-testid="entries-out">
            {formatRupees(t.outPaise)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Balance</p>
          <p className={cn("font-semibold tabular-nums", t.balancePaise < 0 && outClass)} data-testid="entries-balance">
            {formatRupees(t.balancePaise)}
          </p>
        </div>
      </Card>

      {d.entries.length === 0 ? (
        <EmptyState title="No entries this month">Tap + to add one.</EmptyState>
      ) : (
        <EntryList entries={d.entries} categories={d.categories} wallets={d.wallets} today={d.today} />
      )}
      <p className="text-center text-xs text-muted-foreground">Filters, search and CSV export arrive in Phase 2.</p>
    </div>
  );
}
