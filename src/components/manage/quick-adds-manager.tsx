"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { deleteQuickAdd, saveQuickAdd } from "@/app/actions/manage";
import { useApp } from "@/components/app-provider";
import { CategoryIcon } from "@/components/category-icon";
import { EmptyState } from "@/components/page-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cleanAmountInput, formatRupees, paiseToInput, parseRupees } from "@/lib/money";
import { quickAddLabel } from "@/lib/summary";
import { PAYMENT_MODES, type Category, type EntryType, type PaymentMode, type QuickAdd, type Wallet } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChoiceRow, Field, FormDialog } from "./form-dialog";

type Draft = {
  id: string | null;
  type: EntryType;
  amountText: string;
  note: string;
  categoryId: string | null;
  paymentMode: PaymentMode;
  walletId: string;
};

export function QuickAddsManager({ quickAdds, categories, wallets }: { quickAdds: QuickAdd[]; categories: Category[]; wallets: Wallet[] }) {
  const { reload } = useApp();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const catById = new Map(categories.map((c) => [c.id, c]));
  const visibleWallets = wallets.filter((w) => !w.hidden);

  function edit(q: QuickAdd | null) {
    setDraft(
      q
        ? { id: q.id, type: q.type, amountText: paiseToInput(q.amountPaise), note: q.note, categoryId: q.categoryId, paymentMode: q.paymentMode, walletId: q.walletId }
        : { id: null, type: "expense", amountText: "", note: "", categoryId: null, paymentMode: "Cash", walletId: visibleWallets[0]?.id ?? "" },
    );
    setError(null);
    setOpen(true);
  }

  async function save() {
    if (!draft) return;
    const paise = parseRupees(draft.amountText);
    if (!paise) return setError("Enter an amount more than ₹0.");
    if (!draft.note.trim()) return setError("What is it for? Add a short note, e.g. Tea.");
    if (!draft.categoryId) return setError("Pick a category.");
    setBusy(true);
    const r = await saveQuickAdd(draft.id, {
      type: draft.type,
      amountPaise: paise,
      categoryId: draft.categoryId,
      note: draft.note,
      paymentMode: draft.paymentMode,
      walletId: draft.walletId,
    });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setOpen(false);
    toast.success("Quick-add saved");
    void reload();
  }

  async function remove() {
    if (!draft?.id) return;
    setBusy(true);
    const r = await deleteQuickAdd(draft.id);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setOpen(false);
    toast.success("Quick-add deleted");
    void reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => edit(null)}>
          <Plus /> Add quick-add
        </Button>
      </div>
      {quickAdds.length === 0 ? (
        <EmptyState title="No quick-adds yet">Save things you buy often, like &quot;Tea ₹20 · Food · Cash&quot;, and add them in one tap.</EmptyState>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {quickAdds.map((q) => {
            const c = catById.get(q.categoryId);
            return (
              <li key={q.id}>
                <button type="button" onClick={() => edit(q)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-accent/60">
                  {c && <CategoryIcon icon={c.icon} color={c.color} />}
                  <span className="flex-1 font-medium">{quickAddLabel(q.note, formatRupees(q.amountPaise), c?.name ?? "", q.paymentMode)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {draft && (
        <FormDialog
          open={open}
          onOpenChange={setOpen}
          title={draft.id ? "Edit quick-add" : "New quick-add"}
          error={error}
          busy={busy}
          onSubmit={save}
          extraActions={
            draft.id ? (
              <Button type="button" variant="ghost" className="text-destructive" onClick={remove} disabled={busy}>
                <Trash2 /> Delete
              </Button>
            ) : null
          }
        >
          <ChoiceRow
            label="Type"
            value={draft.type}
            onChange={(t) => setDraft({ ...draft, type: t, categoryId: catById.get(draft.categoryId ?? "")?.type === t ? draft.categoryId : null })}
            options={[
              { value: "expense", label: "Money Out" },
              { value: "income", label: "Money In" },
            ]}
          />
          <div className="grid grid-cols-[1fr_2fr] gap-2">
            <Field label="Amount (₹)" htmlFor="qa-amount">
              <Input id="qa-amount" inputMode="decimal" value={draft.amountText} onChange={(e) => setDraft({ ...draft, amountText: cleanAmountInput(e.target.value) })} />
            </Field>
            <Field label="Note" htmlFor="qa-note">
              <Input id="qa-note" maxLength={80} placeholder="e.g. Tea" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
            </Field>
          </div>
          <Field label="Category">
            <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Category">
              {categories
                .filter((c) => c.type === draft.type && (!c.hidden || c.id === draft.categoryId))
                .map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={draft.categoryId === c.id}
                    onClick={() => setDraft({ ...draft, categoryId: c.id })}
                    className={cn("flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-sm", draft.categoryId === c.id && "border-foreground bg-foreground text-background")}
                  >
                    <CategoryIcon icon={c.icon} color={c.color} size="sm" className={draft.categoryId === c.id ? "bg-background/90" : ""} />
                    <span className="truncate">{c.name}</span>
                  </button>
                ))}
            </div>
          </Field>
          <Field label="Payment mode">
            <ChoiceRow label="Payment mode" value={draft.paymentMode} onChange={(m) => setDraft({ ...draft, paymentMode: m })} options={PAYMENT_MODES.map((m) => ({ value: m, label: m }))} />
          </Field>
          {visibleWallets.length > 1 && (
            <Field label="Wallet" htmlFor="qa-wallet">
              <select id="qa-wallet" value={draft.walletId} onChange={(e) => setDraft({ ...draft, walletId: e.target.value })} className="h-10 w-full rounded-lg border bg-background px-3 text-sm">
                {visibleWallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </FormDialog>
      )}
    </div>
  );
}
