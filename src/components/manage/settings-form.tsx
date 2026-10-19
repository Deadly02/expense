"use client";

import { useState } from "react";
import { toast } from "sonner";
import { saveSettings } from "@/app/actions/manage";
import { useApp } from "@/components/app-provider";
import { Card } from "@/components/page-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cleanAmountInput, paiseToInput, parseRupees } from "@/lib/money";
import { PAYMENT_MODES, type PaymentMode, type Settings, type Wallet } from "@/lib/types";
import { ChoiceRow, Field } from "./form-dialog";

export function SettingsForm({ settings, wallets }: { settings: Settings; wallets: Wallet[] }) {
  const { reload } = useApp();
  const [budget, setBudget] = useState(settings.monthlyBudgetPaise ? paiseToInput(settings.monthlyBudgetPaise) : "");
  const [mode, setMode] = useState<PaymentMode | "last">(settings.defaultPaymentMode ?? "last");
  const [wallet, setWallet] = useState<string>(settings.defaultWalletId ?? "last");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const paise = budget.trim() ? parseRupees(budget) : 0;
    if (paise === null) return setError("Enter a valid budget amount, or leave it empty.");
    setBusy(true);
    setError(null);
    const r = await saveSettings({
      monthlyBudgetPaise: paise || null,
      defaultPaymentMode: mode === "last" ? null : mode,
      defaultWalletId: wallet === "last" ? null : wallet,
    });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    toast.success("Settings saved");
    void reload();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={save} noValidate>
        <Card className="space-y-5">
          <Field label="Monthly budget (₹)" htmlFor="budget">
            <Input
              id="budget"
              inputMode="decimal"
              placeholder="e.g. 30000"
              value={budget}
              onChange={(e) => setBudget(cleanAmountInput(e.target.value))}
            />
            <p className="text-sm text-muted-foreground">Used for &quot;safe to spend per day&quot; on Home. Leave empty for none.</p>
          </Field>
          <Field label="Payment mode for new entries">
            <ChoiceRow
              label="Payment mode for new entries"
              value={mode}
              onChange={setMode}
              options={[{ value: "last" as const, label: "Last used" }, ...PAYMENT_MODES.map((m) => ({ value: m, label: m }))]}
            />
          </Field>
          <Field label="Wallet for new entries" htmlFor="default-wallet">
            <select id="default-wallet" value={wallet} onChange={(e) => setWallet(e.target.value)} className="h-10 w-full rounded-lg border bg-background px-3 text-sm">
              <option value="last">Last used</option>
              {wallets
                .filter((w) => !w.hidden)
                .map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
            </select>
          </Field>
          {error ? (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save settings"}
          </Button>
        </Card>
      </form>

      <Card className="space-y-2 text-sm">
        <h2 className="text-base font-semibold">Change your PIN</h2>
        <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>
            On your computer, in the project folder, run <code className="rounded bg-muted px-1">npm run hash-pin</code> and type the new PIN.
          </li>
          <li>
            In Vercel → your project → Settings → Environment Variables, replace <code className="rounded bg-muted px-1">PIN_HASH</code> with the new value.
          </li>
          <li>Redeploy (Deployments → ⋯ → Redeploy). Every device is then locked and asks for the new PIN.</li>
        </ol>
      </Card>
    </div>
  );
}
