/**
 * Wrong-PIN limits.
 *  - Per device/IP: 5 wrong PINs in 15 minutes blocks that device/IP only.
 *  - Everyone: 20 wrong PINs in 60 minutes (from anywhere) blocks new PIN
 *    entries for everyone, as a backstop against guessing from many IPs.
 * Devices that are already unlocked keep working; only PIN entry is blocked.
 * The same rules are implemented in SQL (pin_begin_attempt) for Supabase.
 */
export const PIN_LIMITS = {
  clientMax: 5,
  clientMinutes: 15,
  globalMax: 20,
  globalMinutes: 60,
} as const;

export type PinLimits = { clientMax: number; clientMinutes: number; globalMax: number; globalMinutes: number };

/** A wrong (or still being checked) PIN attempt. `at` is a timestamp in ms. */
export type PinAttempt = { clientKey: string; at: number };

export type PinLimitResult =
  | { allowed: true }
  | { allowed: false; scope: "client" | "global"; retryAfterSeconds: number };

/** Time when the count of attempts in the window drops below `max`, or null if it's already below. */
function blockedUntil(times: number[], max: number, windowMs: number, now: number): number | null {
  const recent = times.filter((t) => t > now - windowMs).sort((a, b) => b - a);
  if (recent.length < max) return null;
  return recent[max - 1] + windowMs; // the max-th most recent attempt leaving the window frees one slot
}

export function checkPinLimits(attempts: PinAttempt[], clientKey: string, now: number, limits: PinLimits = PIN_LIMITS): PinLimitResult {
  const client = blockedUntil(
    attempts.filter((a) => a.clientKey === clientKey).map((a) => a.at),
    limits.clientMax,
    limits.clientMinutes * 60_000,
    now,
  );
  if (client !== null) return { allowed: false, scope: "client", retryAfterSeconds: Math.max(1, Math.ceil((client - now) / 1000)) };

  const global = blockedUntil(
    attempts.map((a) => a.at),
    limits.globalMax,
    limits.globalMinutes * 60_000,
    now,
  );
  if (global !== null) return { allowed: false, scope: "global", retryAfterSeconds: Math.max(1, Math.ceil((global - now) / 1000)) };

  return { allowed: true };
}

export function pinBlockedMessage(scope: "client" | "global", retryAfterSeconds: number): string {
  const min = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return scope === "client"
    ? `Too many wrong PINs from this device. Try again in ${min} min.`
    : `Too many wrong PINs right now. Try again in ${min} min.`;
}
