"use client";

import { Zap } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { addFromQuickAdd } from "@/app/actions/entries";
import { formatRupees } from "@/lib/money";
import { quickAddLabel } from "@/lib/summary";
import { cn } from "@/lib/utils";
import { useApp } from "./app-provider";
import { CategoryIcon } from "./category-icon";

/** One-tap buttons for saved presets ("Tea ₹20 · Food · Cash"). */
export function QuickAddBar({ compact = false, onAdded }: { compact?: boolean; onAdded?: () => void }) {
  const { data, afterAdded } = useApp();
  const [busyId, setBusyId] = useState<string | null>(null);
  if (!data) return null;
  const catById = new Map(data.categories.map((c) => [c.id, c]));
  const items = data.quickAdds;

  if (items.length === 0) {
    return compact ? null : (
      <p className="text-sm text-muted-foreground">
        <Link href="/more/quick-adds" className="underline underline-offset-4">
          Save quick-adds
        </Link>{" "}
        like &quot;Tea ₹20&quot; to add them in one tap.
      </p>
    );
  }

  async function add(id: string) {
    if (busyId) return;
    setBusyId(id);
    const r = await addFromQuickAdd(id);
    setBusyId(null);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    afterAdded(r.data);
    onAdded?.();
  }

  return (
    <div className={cn("-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0", compact && "-mt-1")}>
      <div className="flex w-max gap-2" role="group" aria-label="Quick-add">
        {items.map((q) => {
          const c = catById.get(q.categoryId);
          const label = quickAddLabel(q.note, formatRupees(q.amountPaise), c?.name ?? "", q.paymentMode);
          return (
            <button
              key={q.id}
              type="button"
              onClick={() => add(q.id)}
              disabled={busyId !== null}
              aria-label={`Quick add: ${label}`}
              className="flex items-center gap-2 rounded-full border bg-card py-1 pr-3 pl-1 text-sm whitespace-nowrap shadow-xs transition hover:bg-accent disabled:opacity-60"
            >
              {c ? <CategoryIcon icon={c.icon} color={c.color} size="sm" /> : <Zap className="size-4" />}
              <span className="font-medium">{q.note}</span>
              <span className="tabular-nums text-muted-foreground">{formatRupees(q.amountPaise)}</span>
              {busyId === q.id ? <span className="text-xs text-muted-foreground">Adding…</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
