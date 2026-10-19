"use client";

import { useRouter } from "next/navigation";
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { deleteEntry, repeatEntry, restoreEntry } from "@/app/actions/entries";
import { formatRupees } from "@/lib/money";
import type { ActionResult, Bootstrap, Entry, EntryInput } from "@/lib/types";
import { EntrySheet } from "./entry-sheet";

export type SheetState = ({ mode: "add"; prefill?: Partial<EntryInput> } | { mode: "edit"; entry: Entry }) & { key: number };

type AppContextValue = {
  data: Bootstrap | null;
  loadError: string | null;
  reload: () => Promise<void>;
  openAdd: (prefill?: Partial<EntryInput>) => void;
  openEdit: (entry: Entry) => void;
  /** Toast with an Undo button for 5 seconds. */
  toastUndo: (message: string, undo: () => Promise<ActionResult<unknown>>) => void;
  /** Shared handlers so every screen behaves the same. */
  afterAdded: (entry: Entry) => void;
  removeEntry: (entry: Entry) => Promise<boolean>;
  repeat: (entry: Entry) => Promise<boolean>;
};

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = use(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [data, setData] = useState<Bootstrap | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // The last opened sheet stays rendered while it animates closed.
  const [sheet, setSheet] = useState<{ state: SheetState | null; open: boolean }>({ state: null, open: false });
  const loading = useRef<Promise<void> | null>(null);

  const reload = useCallback(async () => {
    // One request at a time; later callers wait for the same one.
    if (loading.current) return loading.current;
    loading.current = (async () => {
      try {
        const res = await fetch("/api/bootstrap", { cache: "no-store" });
        if (res.status === 401) {
          router.replace("/unlock");
          return;
        }
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error || "Couldn't load your data.");
        setData(body as Bootstrap);
        setLoadError(null);
      } catch (err) {
        setLoadError(
          !navigator.onLine ? "No internet connection." : err instanceof Error ? err.message : "Couldn't load your data.",
        );
      } finally {
        loading.current = null;
      }
    })();
    return loading.current;
  }, [router]);

  useEffect(() => {
    void reload();
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void reload();
        router.refresh(); // keeps phone and laptop in sync when you switch back to the app
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [reload, router]);

  const toastUndo = useCallback(
    (message: string, undo: () => Promise<ActionResult<unknown>>) => {
      toast.success(message, {
        duration: 5000,
        action: {
          label: "Undo",
          onClick: async () => {
            const r = await undo();
            if (r.ok) {
              toast("Undone", { duration: 1500 });
              void reload();
            } else toast.error(r.error);
          },
        },
      });
    },
    [reload],
  );

  const afterAdded = useCallback(
    (entry: Entry) => {
      toastUndo(`Added ${formatRupees(entry.amountPaise)} · ${entry.note}`, () => deleteEntry(entry.id));
      void reload();
    },
    [toastUndo, reload],
  );

  const removeEntry = useCallback(
    async (entry: Entry) => {
      const r = await deleteEntry(entry.id);
      if (!r.ok) {
        toast.error(r.error);
        return false;
      }
      toastUndo("Deleted", () => restoreEntry(entry.id));
      return true;
    },
    [toastUndo],
  );

  const repeat = useCallback(
    async (entry: Entry) => {
      const r = await repeatEntry(entry.id);
      if (!r.ok) {
        toast.error(r.error);
        return false;
      }
      const copy = r.data;
      toastUndo(`Repeated today · ${formatRupees(copy.amountPaise)} · ${copy.note}`, () => deleteEntry(copy.id));
      void reload();
      return true;
    },
    [toastUndo, reload],
  );

  const value = useMemo<AppContextValue>(
    () => ({
      data,
      loadError,
      reload,
      openAdd: (prefill) => setSheet((s) => ({ state: { mode: "add", prefill, key: (s.state?.key ?? 0) + 1 }, open: true })),
      openEdit: (entry) => setSheet((s) => ({ state: { mode: "edit", entry, key: (s.state?.key ?? 0) + 1 }, open: true })),
      toastUndo,
      afterAdded,
      removeEntry,
      repeat,
    }),
    [data, loadError, reload, toastUndo, afterAdded, removeEntry, repeat],
  );

  return (
    <AppContext value={value}>
      {children}
      <EntrySheet state={sheet.state} open={sheet.open} onClose={() => setSheet((s) => ({ ...s, open: false }))} />
    </AppContext>
  );
}
