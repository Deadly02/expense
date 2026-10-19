"use client";

import { useActionState, useSyncExternalStore } from "react";
import { unlock, type UnlockState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

const noSubscribe = () => () => {};

export function UnlockForm() {
  const [state, action, pending] = useActionState<UnlockState, FormData>(unlock, { error: null });
  // Where to go after unlocking (?next=/entries). The server checks it's a safe, same-site path.
  const next = useSyncExternalStore(
    noSubscribe,
    () => new URLSearchParams(window.location.search).get("next") ?? "/",
    () => "/",
  );

  return (
    <form action={action} className="mt-5 space-y-3">
      <input type="hidden" name="next" value={next} />
      <input
        name="pin"
        type="password"
        inputMode="numeric"
        autoComplete="current-password"
        autoFocus
        required
        maxLength={64}
        aria-label="PIN"
        aria-invalid={!!state.error}
        aria-describedby={state.error ? "pin-error" : undefined}
        className="h-14 w-full rounded-xl border bg-background px-4 text-center text-2xl tracking-[0.4em] outline-none focus:ring-2 focus:ring-ring"
      />
      {state.error ? (
        <p id="pin-error" role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={pending}>
        {pending ? "Checking…" : "Unlock"}
      </Button>
    </form>
  );
}
