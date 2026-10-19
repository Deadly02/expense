import { SignJWT, jwtVerify } from "jose";
import type { Env } from "./env";

/** Signed session token (HS256). Used by the proxy and by server code. */

export const SESSION_COOKIE = "mt_session";
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days
const AUDIENCE = "money-tracker";

export async function createSessionToken(env: Env): Promise<string> {
  return new SignJWT({ pf: env.pinFingerprint })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setAudience(AUDIENCE)
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(env.sessionSecret);
}

/** True only for an unexpired token signed with our secret for the current PIN. */
export async function verifySessionToken(token: string | undefined, env: Env): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, env.sessionSecret, { audience: AUDIENCE, algorithms: ["HS256"] });
    return payload.pf === env.pinFingerprint;
  } catch {
    return false;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}
