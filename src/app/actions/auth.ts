"use server";

import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { pinBlockedMessage } from "@/lib/pin-limits";
import { pinSchema } from "@/lib/validation";
import { DEVICE_COOKIE, DEVICE_MAX_AGE_SECONDS, createDeviceToken, pinClientKey } from "@/server/client-key";
import { ConfigError, getEnv } from "@/server/env";
import { endSession, startSession } from "@/server/session";
import { sessionCookieOptions } from "@/server/session-token";
import { getStore } from "@/server/store";

export type UnlockState = { error: string | null };

/** Only same-site paths like "/entries?month=2026-10"; anything else goes home. */
function safeNext(v: FormDataEntryValue | null): string {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/\\") && !s.startsWith("/unlock") ? s : "/";
}

export async function unlock(_prev: UnlockState, formData: FormData): Promise<UnlockState> {
  const parsed = pinSchema.safeParse(formData.get("pin"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const env = getEnv();
    const store = getStore();
    const cookieStore = await cookies();
    const client = await pinClientKey(await headers(), cookieStore.get(DEVICE_COOKIE)?.value, env);
    const attempt = await store.pinBeginAttempt(client.key);
    if (!attempt.allowed) return { error: pinBlockedMessage(attempt.scope, attempt.retryAfterSeconds) };
    const match = await bcrypt.compare(parsed.data, env.pinHash);
    await store.pinFinishAttempt(attempt.attemptId, match);
    if (!match) return { error: "Wrong PIN" };
    await startSession();
    if (!client.trusted) {
      // From now on this device has its own wrong-PIN counter (kept after "Lock this device").
      cookieStore.set(DEVICE_COOKIE, await createDeviceToken(env), { ...sessionCookieOptions(), maxAge: DEVICE_MAX_AGE_SECONDS });
    }
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof ConfigError) return { error: err.message };
    console.error("[unlock]", err);
    const msg = err instanceof Error ? err.message : "";
    if (/fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT/i.test(msg)) {
      return { error: "Couldn't reach the database. Check your internet connection and try again." };
    }
    return { error: msg || "Something went wrong. Please try again." };
  }
  redirect(safeNext(formData.get("next")));
}

/** "Lock this device": forgets the PIN cookie on this device only. */
export async function lockDevice(): Promise<void> {
  await endSession();
  redirect("/unlock");
}
