"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { saveWallet } from "@/app/actions/manage";
import { useApp } from "@/components/app-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { Wallet, WalletKind } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChoiceRow, Field, FormDialog } from "./form-dialog";

const KINDS: { value: WalletKind; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank account" },
  { value: "card", label: "Credit card" },
  { value: "other", label: "Other" },
];

type Draft = { id: string | null; name: string; kind: WalletKind; hidden: boolean };

export function WalletsManager({ wallets }: { wallets: Wallet[] }) {
  const { reload } = useApp();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function edit(w: Wallet | null) {
    setDraft(w ? { id: w.id, name: w.name, kind: w.kind, hidden: w.hidden } : { id: null, name: "", kind: "bank", hidden: false });
    setError(null);
    setOpen(true);
  }

  async function save() {
    if (!draft) return;
    if (!draft.name.trim()) return setError("Give the wallet a name.");
    setBusy(true);
    const r = await saveWallet(draft.id, { name: draft.name, kind: draft.kind, hidden: draft.hidden });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setOpen(false);
    toast.success("Wallet saved");
    void reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => edit(null)}>
          <Plus /> Add wallet
        </Button>
      </div>
      <ul className="divide-y overflow-hidden rounded-xl border bg-card">
        {wallets.map((w) => (
          <li key={w.id}>
            <button type="button" onClick={() => edit(w)} className={cn("flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent/60", w.hidden && "opacity-60")}>
              <span className="flex-1 font-medium">{w.name}</span>
              <span className="text-sm text-muted-foreground">{KINDS.find((k) => k.value === w.kind)?.label}</span>
              {w.hidden && <span className="rounded-full bg-muted px-2 py-0.5 text-xs">Hidden</span>}
            </button>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted-foreground">Balances, transfers and credit-card cycles arrive in Phase 4.</p>

      {draft && (
        <FormDialog open={open} onOpenChange={setOpen} title={draft.id ? "Edit wallet" : "New wallet"} error={error} busy={busy} onSubmit={save}>
          <Field label="Name" htmlFor="wallet-name">
            <Input id="wallet-name" maxLength={30} placeholder="e.g. HDFC Savings" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus />
          </Field>
          <Field label="Kind">
            <ChoiceRow label="Kind" value={draft.kind} onChange={(k) => setDraft({ ...draft, kind: k })} options={KINDS} />
          </Field>
          {draft.id && (
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">Hide this wallet</span>
              <Switch checked={draft.hidden} onCheckedChange={(v) => setDraft({ ...draft, hidden: v })} aria-label="Hide this wallet" />
            </label>
          )}
        </FormDialog>
      )}
    </div>
  );
}
