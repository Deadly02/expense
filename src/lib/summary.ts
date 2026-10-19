import { daysLeftInMonth } from "./dates";
import type { Entry } from "./types";

/** Pure totals maths on integer paise. */

export type Totals = { inPaise: number; outPaise: number; balancePaise: number; count: number };

export function totals(entries: Pick<Entry, "type" | "amountPaise">[]): Totals {
  let inPaise = 0;
  let outPaise = 0;
  for (const e of entries) {
    if (e.type === "income") inPaise += e.amountPaise;
    else outPaise += e.amountPaise;
  }
  return { inPaise, outPaise, balancePaise: inPaise - outPaise, count: entries.length };
}

export function spentOn(entries: Pick<Entry, "type" | "amountPaise" | "date">[], date: string): number {
  let out = 0;
  for (const e of entries) if (e.type === "expense" && e.date === date) out += e.amountPaise;
  return out;
}

export type DayGroup<T extends Pick<Entry, "type" | "amountPaise" | "date">> = {
  date: string;
  entries: T[];
  inPaise: number;
  outPaise: number;
};

/** Groups entries (already sorted newest first) by date, with day totals. */
export function groupByDay<T extends Pick<Entry, "type" | "amountPaise" | "date">>(entries: T[]): DayGroup<T>[] {
  const groups: DayGroup<T>[] = [];
  for (const e of entries) {
    let g = groups[groups.length - 1];
    if (!g || g.date !== e.date) {
      g = { date: e.date, entries: [], inPaise: 0, outPaise: 0 };
      groups.push(g);
    }
    g.entries.push(e);
    if (e.type === "income") g.inPaise += e.amountPaise;
    else g.outPaise += e.amountPaise;
  }
  return groups;
}

/** Newest first: by date, then by when it was added. */
export function sortEntries<T extends Pick<Entry, "date" | "createdAt" | "id">>(entries: T[]): T[] {
  return [...entries].sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id),
  );
}

export type SafeToSpend =
  | { kind: "budget"; perDayPaise: number; leftPaise: number; daysLeft: number; overPaise: number }
  | { kind: "balance"; perDayPaise: number; leftPaise: number; daysLeft: number; overPaise: number }
  | { kind: "none" };

/**
 * How much can be spent per day for the rest of the month (today included).
 * With a monthly budget: (budget − spent) ÷ days left. Without one, the same
 * from this month's income. Never negative; "overPaise" says by how much it's over.
 */
export function safeToSpend(args: {
  today: string;
  monthOutPaise: number;
  monthInPaise: number;
  budgetPaise: number | null;
}): SafeToSpend {
  const daysLeft = daysLeftInMonth(args.today);
  const base = args.budgetPaise && args.budgetPaise > 0 ? args.budgetPaise : args.monthInPaise > 0 ? args.monthInPaise : null;
  if (base === null) return { kind: "none" };
  const left = base - args.monthOutPaise;
  return {
    kind: args.budgetPaise && args.budgetPaise > 0 ? "budget" : "balance",
    perDayPaise: left > 0 ? Math.floor(left / daysLeft) : 0,
    leftPaise: Math.max(0, left),
    daysLeft,
    overPaise: Math.max(0, -left),
  };
}

/** Builds the label for a quick-add button: "Tea ₹20 · Food · Cash". */
export function quickAddLabel(note: string, amountText: string, categoryName: string, paymentMode: string): string {
  return `${note} ${amountText} · ${categoryName} · ${paymentMode}`;
}
