import Link from "next/link";
import { Suspense } from "react";
import { inClass, outClass } from "@/components/amount";
import { EntryList } from "@/components/entry-list";
import { Card, EmptyState, ListSkeleton, PageTitle, SummarySkeleton } from "@/components/page-bits";
import { QuickAddBar } from "@/components/quick-add-bar";
import { formatDMY, monthLabel } from "@/lib/dates";
import { formatRupees } from "@/lib/money";
import { cn } from "@/lib/utils";
import { getHomeData } from "@/server/data";

export default function HomePage() {
  return (
    <>
      <PageTitle>Home</PageTitle>
      <Suspense
        fallback={
          <div className="space-y-4">
            <SummarySkeleton />
            <ListSkeleton rows={4} />
          </div>
        }
      >
        <HomeContent />
      </Suspense>
    </>
  );
}

async function HomeContent() {
  const d = await getHomeData();
  const { month, safe } = d;
  return (
    <div className="space-y-4">
      <Card className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Spent today</p>
          <p className="text-3xl font-bold tracking-tight tabular-nums" data-testid="today-spent">
            {formatRupees(d.todaySpentPaise)}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">{formatDMY(d.today)}</p>
      </Card>

      <Card aria-label="This month">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-medium text-muted-foreground">Balance · {monthLabel(d.today)}</p>
          <Link href="/entries" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            Details
          </Link>
        </div>
        <p className={cn("mt-1 text-3xl font-bold tracking-tight tabular-nums", month.balancePaise < 0 && outClass)} data-testid="month-balance">
          {formatRupees(month.balancePaise)}
        </p>
        <div className="mt-3 grid grid-cols-2 border-t pt-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Money In</p>
            <p className={cn("text-lg font-semibold tabular-nums", inClass)} data-testid="month-in">
              {formatRupees(month.inPaise)}
            </p>
          </div>
          <div className="border-l pl-3">
            <p className="text-xs font-medium text-muted-foreground">Money Out</p>
            <p className={cn("text-lg font-semibold tabular-nums", outClass)} data-testid="month-out">
              {formatRupees(month.outPaise)}
            </p>
          </div>
        </div>
      </Card>

      <Card aria-label="Safe to spend">
        <p className="text-sm font-medium text-muted-foreground">Safe to spend per day</p>
        {safe.kind === "none" ? (
          <p className="mt-1 text-sm">
            <Link href="/more/settings" className="font-medium underline underline-offset-4">
              Set a monthly budget
            </Link>{" "}
            to see how much you can spend each day.
          </p>
        ) : (
          <>
            <p className="mt-1 text-2xl font-bold tabular-nums" data-testid="safe-per-day">
              {formatRupees(safe.perDayPaise)}
              <span className="text-base font-medium text-muted-foreground"> /day</span>
            </p>
            <p className="text-sm text-muted-foreground">
              {safe.overPaise > 0
                ? `${formatRupees(safe.overPaise)} over ${safe.kind === "budget" ? "budget" : "this month's income"}`
                : `${formatRupees(safe.leftPaise)} left for ${safe.daysLeft} day${safe.daysLeft === 1 ? "" : "s"}`}
              {safe.kind === "balance" ? " · based on this month's income" : ""}
            </p>
          </>
        )}
      </Card>

      <div>
        <div className="mb-2 flex items-baseline justify-between px-1">
          <h2 className="text-sm font-semibold text-muted-foreground">Quick add</h2>
          <Link href="/more/quick-adds" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            Manage
          </Link>
        </div>
        <QuickAddBar />
      </div>

      <div>
        <div className="mb-2 flex items-baseline justify-between px-1">
          <h2 className="text-sm font-semibold text-muted-foreground">Recent</h2>
          <Link href="/entries" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            See all
          </Link>
        </div>
        {d.recent.length === 0 ? (
          <EmptyState title="No entries yet">Tap + to add your first one.</EmptyState>
        ) : (
          <EntryList entries={d.recent} categories={d.categories} wallets={d.wallets} today={d.today} groupDays={false} />
        )}
      </div>
    </div>
  );
}
