import { defineConfig, devices } from "@playwright/test";
import bcrypt from "bcryptjs";

/**
 * End-to-end tests run the production build against the in-memory store
 * (no real database is touched) on a 400px phone and a laptop, using the
 * Chrome installed on this computer.
 */
export const TEST_PIN = "135790";
export const FAKE_SECRET_KEY = "sb_secret_E2E_MUST_NEVER_REACH_THE_BROWSER";
const PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1, // one shared in-memory store
  retries: 0,
  reporter: [["list"]],
  timeout: 30_000,
  expect: { timeout: 7_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: "chrome",
    trace: "retain-on-failure",
    timezoneId: "Asia/Kolkata",
    locale: "en-IN",
  },
  projects: [
    {
      name: "phone-400",
      use: { ...devices["Pixel 7"], channel: "chrome", viewport: { width: 400, height: 860 }, deviceScaleFactor: 1 },
    },
    { name: "laptop", use: { channel: "chrome", viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/unlock`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATA_BACKEND: "memory",
      ALLOW_TEST_RESET: "1",
      PIN_HASH: Buffer.from(bcrypt.hashSync(TEST_PIN, 8)).toString("base64"),
      SESSION_SECRET: "e2e-session-secret-0123456789abcdefghijklmnop",
      SUPABASE_URL: "https://e2e-not-used.supabase.co",
      SUPABASE_SECRET_KEY: FAKE_SECRET_KEY,
      APP_TIME_ZONE: "Asia/Kolkata",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
