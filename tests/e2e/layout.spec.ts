import { expect, test } from "@playwright/test";
import { addEntry, unlocked } from "./helpers";

test.beforeEach(async ({ page }) => {
  await unlocked(page);
});

test("phone: bottom tab bar; laptop: sidebar; no sideways scrolling", async ({ page }, info) => {
  const phone = info.project.name.startsWith("phone");
  const tabs = page.getByRole("navigation", { name: "Tabs" });
  const sidebar = page.getByRole("complementary", { name: "Main" });
  if (phone) {
    await expect(tabs).toBeVisible();
    await expect(sidebar).toBeHidden();
    for (const name of ["Home", "Entries", "Charts", "Money owed", "More"]) await expect(tabs.getByRole("link", { name })).toBeVisible();
  } else {
    await expect(sidebar).toBeVisible();
    await expect(tabs).toBeHidden();
  }
  await addEntry(page, { amount: "1499.50", note: "A fairly long note to check that rows truncate nicely on phones", category: "Shopping" });
  for (const path of ["/", "/entries", "/charts", "/owed", "/more", "/more/categories", "/more/quick-adds", "/more/wallets", "/more/settings"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(0);
  }
});

test("navigation between tabs, and dark mode follows the system", async ({ page }, info) => {
  const nav = info.project.name.startsWith("phone") ? page.getByRole("navigation", { name: "Tabs" }) : page.getByRole("complementary", { name: "Main" });
  await nav.getByRole("link", { name: "Entries" }).click();
  await expect(page.getByRole("heading", { name: "Entries" })).toBeVisible();
  await nav.getByRole("link", { name: "Charts" }).click();
  await expect(page.getByText("Charts are coming in Phase 2")).toBeVisible();
  await nav.getByRole("link", { name: "More" }).click();
  await expect(page.getByRole("link", { name: /Categories/ })).toBeVisible();

  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveClass(/dark/);
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).not.toBe("rgb(255, 255, 255)");

  await page.goto("/more");
  await page.getByRole("button", { name: "Light" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});

test("loading skeletons show while data streams in", async ({ page }) => {
  // The static shell (title + skeleton) is sent before the data.
  const html = await (await page.request.get("/")).text();
  expect(html).toContain('aria-label="Loading"');
});
