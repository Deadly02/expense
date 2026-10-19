import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/server/env";
import { SESSION_COOKIE, verifySessionToken } from "@/server/session-token";

/**
 * Runs before every page and API request (Next.js 16 calls middleware "proxy").
 * Without a valid PIN cookie, pages redirect to the PIN screen and API calls get 401.
 * Server actions are let through here because each one checks the session
 * itself and redirects properly (see requireSession).
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  let unlocked = false;
  try {
    unlocked = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value, getEnv());
  } catch {
    unlocked = false; // missing/invalid config: the PIN screen explains what's wrong
  }

  if (pathname === "/unlock") {
    return unlocked ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next();
  }
  if (unlocked) return NextResponse.next();

  if (request.method === "POST" && request.headers.has("next-action")) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Locked. Enter your PIN." }, { status: 401 });
  }

  const url = new URL("/unlock", request.url);
  if (pathname !== "/") url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    // Everything except Next.js internals, static files and the PWA/icon files.
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|robots.txt|api/test/).*)",
  ],
};
