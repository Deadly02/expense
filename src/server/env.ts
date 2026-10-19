import { createHash } from "node:crypto";
import { DEFAULT_TIME_ZONE } from "@/lib/dates";

/**
 * Reads and checks the server's environment variables. Never import this from
 * a Client Component: nothing here may reach the browser.
 */

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export type Env = {
  /** bcrypt hash of the PIN */
  pinHash: string;
  /** Short fingerprint of the hash: changing the PIN signs out every device. */
  pinFingerprint: string;
  sessionSecret: Uint8Array;
  backend: "supabase" | "memory";
  supabaseUrl: string;
  supabaseSecretKey: string;
  timeZone: string;
  allowTestReset: boolean;
};

let cached: { key: string; env: Env } | null = null;

function decodePinHash(raw: string | undefined): string {
  const v = (raw ?? "").trim();
  if (!v) throw new ConfigError("PIN_HASH is not set. Run `npm run hash-pin` and add the result to your environment variables.");
  // Accept the raw bcrypt hash ($2a$/$2b$...) or the base64 form printed by `npm run hash-pin`
  // (base64 avoids problems with "$" signs in .env files).
  const hash = v.startsWith("$2") ? v : Buffer.from(v, "base64").toString("utf8");
  if (!/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(hash)) {
    throw new ConfigError("PIN_HASH doesn't look right. Run `npm run hash-pin` again and copy the whole value.");
  }
  return hash;
}

function jwtRole(key: string): string | null {
  try {
    const payload = key.split(".")[1];
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")).role ?? null;
  } catch {
    return null;
  }
}

export function getEnv(): Env {
  const e = process.env;
  const key = [e.PIN_HASH, e.SESSION_SECRET, e.DATA_BACKEND, e.SUPABASE_URL, e.SUPABASE_SECRET_KEY, e.APP_TIME_ZONE, e.ALLOW_TEST_RESET].join("|");
  if (cached?.key === key) return cached.env;

  const pinHash = decodePinHash(e.PIN_HASH);

  const secret = (e.SESSION_SECRET ?? "").trim();
  if (secret.length < 32) {
    throw new ConfigError("SESSION_SECRET must be at least 32 characters. `npm run hash-pin` prints one you can use.");
  }

  const backend = e.DATA_BACKEND === "memory" ? "memory" : "supabase";
  const supabaseUrl = (e.SUPABASE_URL ?? "").trim();
  const supabaseSecretKey = (e.SUPABASE_SECRET_KEY ?? "").trim();
  if (backend === "supabase") {
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)\/?$/.test(supabaseUrl) && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(supabaseUrl)) {
      throw new ConfigError("SUPABASE_URL is missing or not a Supabase project URL (https://<ref>.supabase.co).");
    }
    if (!supabaseSecretKey) throw new ConfigError("SUPABASE_SECRET_KEY is not set.");
    if (supabaseSecretKey.startsWith("sb_publishable_") || jwtRole(supabaseSecretKey) === "anon") {
      throw new ConfigError(
        "SUPABASE_SECRET_KEY is the public (publishable/anon) key. Use the secret key (sb_secret_…) from Supabase → Project Settings → API Keys.",
      );
    }
  }

  const timeZone = (e.APP_TIME_ZONE ?? "").trim() || DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone });
  } catch {
    throw new ConfigError(`APP_TIME_ZONE "${timeZone}" is not a valid time zone (e.g. Asia/Kolkata).`);
  }

  const env: Env = {
    pinHash,
    pinFingerprint: createHash("sha256").update(pinHash).digest("base64url").slice(0, 16),
    sessionSecret: new TextEncoder().encode(secret),
    backend,
    supabaseUrl: supabaseUrl.replace(/\/$/, ""),
    supabaseSecretKey,
    timeZone,
    allowTestReset: backend === "memory" && e.ALLOW_TEST_RESET === "1",
  };
  cached = { key, env };
  return env;
}
