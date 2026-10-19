import { UnlockForm } from "./unlock-form";

export const metadata = { title: "Enter your PIN · Money Tracker" };

/** Fully static: the page you were headed to (?next=) is read in the browser by the form. */
export default function UnlockPage() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-lg bg-foreground font-bold text-background">₹</span>
          <span className="font-semibold">Money Tracker</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Enter your PIN</h1>
        <p className="mt-1 text-sm text-muted-foreground">This device stays unlocked for 30 days.</p>
        <UnlockForm />
      </div>
    </main>
  );
}
