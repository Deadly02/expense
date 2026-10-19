import { expect, test } from "@playwright/test";
import { FAKE_SECRET_KEY } from "../../playwright.config";
import { resetData, unlock } from "./helpers";

test.beforeEach(async ({ page }) => {
  await resetData(page);
});

test("every page needs the PIN; wrong PIN stays on the PIN screen", async ({ page }) => {
  await page.goto("/entries");
  await expect(page).toHaveURL(/\/unlock\?next=%2Fentries$/);
  await expect(page.getByRole("heading", { name: "Enter your PIN" })).toBeVisible();
  await expect(page.getByLabel("PIN")).toBeFocused();

  await page.getByLabel("PIN").fill("000000");
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.locator("#pin-error")).toHaveText("Wrong PIN");
  await expect(page).toHaveURL(/\/unlock/);

  await page.getByLabel("PIN").fill("135790");
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page).toHaveURL(/\/entries$/); // goes back where you were headed
  await expect(page.getByRole("heading", { name: "Entries" })).toBeVisible();
});

test("cookie is httpOnly, signed and lasts 30 days; Lock this device clears it", async ({ page, context }) => {
  await unlock(page);
  await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
  const [cookie] = (await context.cookies()).filter((c) => c.name === "mt_session");
  expect(cookie).toBeTruthy();
  expect(cookie.httpOnly).toBe(true);
  expect(cookie.sameSite).toBe("Lax");
  const days = (cookie.expires * 1000 - Date.now()) / 86_400_000;
  expect(days).toBeGreaterThan(29.9);
  expect(days).toBeLessThan(30.1);
  expect(await page.evaluate(() => document.cookie)).not.toContain("mt_session");

  // A tampered cookie is rejected
  await context.addCookies([{ ...cookie, value: cookie.value.slice(0, -4) + "AAAA" }]);
  await page.goto("/");
  await expect(page).toHaveURL(/\/unlock/);

  await unlock(page);
  await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
  await page.goto("/more");
  await page.getByRole("button", { name: /Lock this device/ }).click();
  await expect(page).toHaveURL(/\/unlock$/);
  expect((await context.cookies()).some((c) => c.name === "mt_session" && c.value)).toBe(false);
  await page.goto("/");
  await expect(page).toHaveURL(/\/unlock/);
});

test("API needs the cookie, and no key or PIN hash ever reaches the browser", async ({ page, request }) => {
  const api = await request.get("/api/bootstrap");
  expect(api.status()).toBe(401);

  const bodies: string[] = [];
  page.on("response", async (r) => {
    const type = r.headers()["content-type"] ?? "";
    if (/html|javascript|json|text\/x-component/.test(type)) bodies.push(await r.text().catch(() => ""));
  });
  await unlock(page);
  await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
  await page.getByRole("button", { name: "Add entry" }).last().click();
  await expect(page.getByRole("dialog").getByLabel("Amount in rupees")).toBeVisible();
  await page.goto("/more/settings");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await page.waitForLoadState("networkidle");

  expect(bodies.length).toBeGreaterThan(5);
  const all = bodies.join("\n");
  expect(all).not.toContain(FAKE_SECRET_KEY);
  expect(all).not.toContain("SUPABASE_SECRET_KEY");
  expect(all).not.toContain("e2e-session-secret");
  expect(all).not.toMatch(/\$2[aby]\$\d\d\$/); // bcrypt hash
});
