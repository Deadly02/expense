"use client";

import { Button } from "@/components/ui/button";

/** Shown when a page can't load (database unreachable, migrations not run, ...). */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const offline = typeof navigator !== "undefined" && !navigator.onLine;
  return (
    <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
      <p className="font-semibold">Couldn&apos;t load this page</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {offline ? "No internet connection. Check your connection and try again." : error.message || "Something went wrong."}
      </p>
      <Button className="mt-4" variant="secondary" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
