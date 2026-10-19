import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getEnv } from "./env";
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions, verifySessionToken } from "./session-token";

export async function hasValidSession(): Promise<boolean> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySessionToken(token, getEnv());
}

/**
 * Call first in every page data loader, server action and route handler.
 * The proxy also checks, but this is the check that actually protects data.
 */
export async function requireSession(): Promise<void> {
  if (!(await hasValidSession())) redirect("/unlock");
}

export async function startSession(): Promise<void> {
  const token = await createSessionToken(getEnv());
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions());
}

export async function endSession(): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
}
