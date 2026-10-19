import { createHmac, randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import type { Env } from "./env";

/**
 * Who is trying a PIN, for the wrong-PIN limits.
 *
 * - A device that has unlocked before carries a signed "trusted device" cookie
 *   and gets its own counter, so a stranger on the same Wi-Fi or mobile network
 *   (same IP) can't lock it out.
 * - Everyone else is counted by IP address. On Vercel, x-real-ip and
 *   x-forwarded-for are set by Vercel and can't be faked by the browser.
 *
 * IPs and device ids are stored only as keyed hashes.
 */

export const DEVICE_COOKIE = "mt_device";
export const DEVICE_MAX_AGE_SECONDS = 400 * 24 * 60 * 60; // browsers cap cookies at ~400 days
const DEVICE_AUDIENCE = "money-tracker-device";

export function clientIp(headers: Headers): string {
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "unknown";
}

function keyedHash(kind: string, value: string, env: Env): string {
  return createHmac("sha256", env.sessionSecret).update(`${kind}:${value}`).digest("base64url").slice(0, 32);
}

export async function createDeviceToken(env: Env): Promise<string> {
  return new SignJWT({ d: randomUUID() })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setAudience(DEVICE_AUDIENCE)
    .setExpirationTime(`${DEVICE_MAX_AGE_SECONDS}s`)
    .sign(env.sessionSecret);
}

async function deviceId(token: string | undefined, env: Env): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, env.sessionSecret, { audience: DEVICE_AUDIENCE, algorithms: ["HS256"] });
    return typeof payload.d === "string" ? payload.d : null;
  } catch {
    return null;
  }
}

/** "device:<hash>" for a trusted device, otherwise "ip:<hash>". */
export async function pinClientKey(headers: Headers, deviceToken: string | undefined, env: Env): Promise<{ key: string; trusted: boolean }> {
  const id = await deviceId(deviceToken, env);
  if (id) return { key: "device:" + keyedHash("device", id, env), trusted: true };
  return { key: "ip:" + keyedHash("ip", clientIp(headers), env), trusted: false };
}
