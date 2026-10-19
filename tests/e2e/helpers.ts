import { expect, type Page } from "@playwright/test";
import { addDays, todayIn } from "../../src/lib/dates";
import { TEST_PIN } from "../../playwright.config";

export const today = () => todayIn("Asia/Kolkata");
export const yesterday = () => addDays(today(), -1);

export async function resetData(page: Page) {
  const res = await page.request.post("/api/test/reset");
  expect(res.ok()).toBeTruthy();
}

export async function unlock(page: Page, pin = TEST_PIN) {
  await page.goto("/unlock");
  await page.getByLabel("PIN").fill(pin);
  await page.getByRole("button", { name: "Unlock" }).click();
}

export async function unlocked(page: Page) {
  await resetData(page);
  await unlock(page);
  await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
}

/** The add/edit sheet (drawer on phone, dialog on laptop). */
export const sheet = (page: Page) => page.getByRole("dialog");

export async function openAdd(page: Page) {
  await page.getByRole("button", { name: "Add entry" }).last().click();
  await expect(sheet(page).getByLabel("Amount in rupees")).toBeFocused();
}

export async function fillEntry(
  page: Page,
  e: { type?: "Money Out" | "Money In"; amount: string; note: string; category: string; date?: string; mode?: string; tags?: string },
) {
  const s = sheet(page);
  if (e.type) await s.getByRole("button", { name: e.type, exact: true }).click();
  await s.getByLabel("Amount in rupees").fill(e.amount);
  await s.getByLabel("Note (what was this for?)").fill(e.note);
  await s.getByRole("group", { name: "Category" }).getByRole("button", { name: e.category, exact: true }).click();
  if (e.date) await s.locator('input[name="date"]').fill(e.date);
  if (e.mode) await s.getByRole("group", { name: "Payment mode" }).getByRole("button", { name: e.mode, exact: true }).click();
  if (e.tags) await s.getByLabel("Tags").fill(e.tags);
}

export async function addEntry(page: Page, e: Parameters<typeof fillEntry>[1]) {
  await openAdd(page);
  await fillEntry(page, e);
  await sheet(page).getByRole("button", { name: "Add", exact: true }).click();
  await expect(sheet(page)).toBeHidden();
  await expect(page.getByText(new RegExp(`Added .* · ${e.note}`)).first()).toBeVisible();
}

/** Clicks Undo on the toast with this text (several toasts can be on screen). */
export async function clickUndo(page: Page, toastText: string | RegExp) {
  await page.locator("[data-sonner-toast]").filter({ hasText: toastText }).first().getByRole("button", { name: "Undo" }).click();
}

export async function homeNumbers(page: Page) {
  return {
    today: (await page.getByTestId("today-spent").filter({ visible: true }).first().textContent())?.trim(),
    in: (await page.getByTestId("month-in").filter({ visible: true }).first().textContent())?.trim(),
    out: (await page.getByTestId("month-out").filter({ visible: true }).first().textContent())?.trim(),
    balance: (await page.getByTestId("month-balance").filter({ visible: true }).first().textContent())?.trim(),
  };
}
