import { formatRupees } from "@/lib/money";
import type { EntryType } from "@/lib/types";
import { cn } from "@/lib/utils";

/** An amount coloured by type: Money Out red with −, Money In green with +. */
export function Amount({ paise, type, className }: { paise: number; type: EntryType; className?: string }) {
  return (
    <span
      className={cn(
        "font-semibold tabular-nums whitespace-nowrap",
        type === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
        className,
      )}
    >
      {formatRupees(type === "income" ? paise : -paise, { sign: "always" })}
    </span>
  );
}

export const inClass = "text-emerald-600 dark:text-emerald-400";
export const outClass = "text-red-600 dark:text-red-400";
