import { NextResponse } from "next/server";
import { getEnv } from "@/server/env";
import { resetMemoryStore } from "@/server/store/memory";

/**
 * Automated tests only: wipes the in-memory store. Returns 404 unless the app
 * runs with DATA_BACKEND=memory and ALLOW_TEST_RESET=1 (never with real data).
 */
export async function POST() {
  let allowed = false;
  try {
    allowed = getEnv().allowTestReset;
  } catch {
    allowed = false;
  }
  if (!allowed) return NextResponse.json({ error: "Not found" }, { status: 404 });
  resetMemoryStore();
  return NextResponse.json({ ok: true });
}
