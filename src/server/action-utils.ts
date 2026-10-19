import "server-only";
import { unstable_rethrow } from "next/navigation";
import type { ActionResult } from "@/lib/types";
import { ConfigError } from "./env";
import { requireSession } from "./session";
import { StoreError } from "./store";

/**
 * Wraps a server action: checks the PIN session, runs it, and turns errors
 * into a message for the person instead of a crash.
 */
export async function guarded<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    await requireSession();
    return await fn();
  } catch (err) {
    unstable_rethrow(err); // let Next.js redirects (e.g. to the PIN screen) through
    if (err instanceof StoreError || err instanceof ConfigError) return { ok: false, error: err.message };
    console.error("[action]", err);
    const msg = err instanceof Error ? err.message : "";
    if (/fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|network/i.test(msg)) {
      return { ok: false, error: "Couldn't reach the database. Check your internet connection and try again." };
    }
    return { ok: false, error: msg || "Something went wrong. Please try again." };
  }
}

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });
export const bad = (error: string, fieldErrors?: Record<string, string>): ActionResult<never> => ({ ok: false, error, fieldErrors });
