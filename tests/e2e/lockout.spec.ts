import { expect, test, type Browser, type Page } from "@playwright/test";
import { TEST_PIN } from "../../playwright.config";
import { resetData } from "./helpers";

/**
 * Wrong-PIN limits. Each "person" is a separate browser with its own cookies and
 * its own IP address (sent as x-real-ip, the header Vercel sets).
 */

async function person(browser: Browser, baseURL: string, ip: string) {
  const context = await browser.newContext({ baseURL, extraHTTPHeaders: { "x-real-ip": ip } });
  const page = await context.newPage();
  return { context, page };
}

async function tryPin(page: Page, pin: string) {
  await page.goto("/unlock");
  await page.getByLabel("PIN").fill(pin);
  await page.getByRole("button", { name: "Unlock" }).click();
}

async function wrongPins(page: Page, n: number) {
  await page.goto("/unlock");
  for (let i = 0; i < n; i++) {
    await page.getByLabel("PIN").fill("000000");
    await page.getByRole("button", { name: "Unlock" }).click();
    await expect(page.locator("#pin-error")).toHaveText("Wrong PIN");
    await expect(page.getByRole("button", { name: "Unlock" })).toBeEnabled();
  }
}

test.beforeEach(async ({ page }) => {
  await resetData(page);
});

test("5 wrong PINs block that IP for 15 minutes, but not other people", async ({ browser, baseURL }) => {
  const stranger = await person(browser, baseURL!, "203.0.113.50");
  await wrongPins(stranger.page, 5);
  await tryPin(stranger.page, TEST_PIN); // even the right PIN is refused from the blocked IP
  await expect(stranger.page.locator("#pin-error")).toHaveText("Too many wrong PINs from this device. Try again in 15 min.");

  const me = await person(browser, baseURL!, "198.51.100.7");
  await tryPin(me.page, TEST_PIN);
  await expect(me.page.getByRole("heading", { name: "Home" })).toBeVisible();
  await stranger.context.close();
  await me.context.close();
});

test("a stranger on the same Wi-Fi (same IP) can't lock out a device that unlocked before", async ({ browser, baseURL }) => {
  const sharedIp = "203.0.113.77";
  const me = await person(browser, baseURL!, sharedIp);
  await tryPin(me.page, TEST_PIN);
  await expect(me.page.getByRole("heading", { name: "Home" })).toBeVisible();
  const device = (await me.context.cookies()).find((c) => c.name === "mt_device");
  expect(device?.httpOnly).toBe(true);

  // Lock this device: the session goes, the trusted-device cookie stays
  await me.page.goto("/more");
  await me.page.getByRole("button", { name: /Lock this device/ }).click();
  await expect(me.page).toHaveURL(/\/unlock$/);
  expect((await me.context.cookies()).some((c) => c.name === "mt_session" && c.value)).toBe(false);

  const stranger = await person(browser, baseURL!, sharedIp);
  await wrongPins(stranger.page, 5);
  await tryPin(stranger.page, TEST_PIN);
  await expect(stranger.page.locator("#pin-error")).toHaveText(/Too many wrong PINs from this device/);

  // My device has its own counter, so I can still get in from the same IP
  await tryPin(me.page, TEST_PIN);
  await expect(me.page.getByRole("heading", { name: "Home" })).toBeVisible();
  await stranger.context.close();
  await me.context.close();
});

test("20 wrong PINs in an hour from many IPs block new PIN entries for everyone", async ({ browser, baseURL }) => {
  test.setTimeout(90_000);
  // Unlock one device first: devices already unlocked keep working during a block.
  const myLaptop = await person(browser, baseURL!, "198.51.100.10");
  await tryPin(myLaptop.page, TEST_PIN);
  await expect(myLaptop.page.getByRole("heading", { name: "Home" })).toBeVisible();

  for (let i = 1; i <= 5; i++) {
    const bot = await person(browser, baseURL!, `192.0.2.${i}`);
    await wrongPins(bot.page, 4); // 4 each stays under the per-IP limit
    await bot.context.close();
  }

  const myPhone = await person(browser, baseURL!, "198.51.100.20");
  await tryPin(myPhone.page, TEST_PIN);
  await expect(myPhone.page.locator("#pin-error")).toHaveText(/^Too many wrong PINs right now\. Try again in (59|60) min\.$/);

  await myLaptop.page.goto("/entries");
  await expect(myLaptop.page.getByRole("heading", { name: "Entries" })).toBeVisible();
  await myPhone.context.close();
  await myLaptop.context.close();
});

test("a correct PIN clears that device's earlier wrong PINs", async ({ browser, baseURL }) => {
  const me = await person(browser, baseURL!, "198.51.100.30");
  await wrongPins(me.page, 4);
  await tryPin(me.page, TEST_PIN);
  await expect(me.page.getByRole("heading", { name: "Home" })).toBeVisible();
  await me.page.goto("/more");
  await me.page.getByRole("button", { name: /Lock this device/ }).click();
  await expect(me.page).toHaveURL(/\/unlock$/);
  await wrongPins(me.page, 4); // would be blocked if the earlier 4 still counted
  await tryPin(me.page, TEST_PIN);
  await expect(me.page.getByRole("heading", { name: "Home" })).toBeVisible();
  await me.context.close();
});
