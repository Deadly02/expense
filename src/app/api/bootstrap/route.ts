import { NextResponse } from "next/server";
import { getBootstrap } from "@/server/data";
import { hasValidSession } from "@/server/session";

/** Categories, wallets, quick-adds, note suggestions and settings for the add sheet. */
export async function GET() {
  if (!(await hasValidSession())) {
    return NextResponse.json({ error: "Locked. Enter your PIN." }, { status: 401 });
  }
  try {
    const data = await getBootstrap();
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[bootstrap]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't load your data." }, { status: 500 });
  }
}
