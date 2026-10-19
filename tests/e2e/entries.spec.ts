import { expect, test } from "@playwright/test";
import { formatDMY } from "../../src/lib/dates";
import { addEntry, clickUndo, fillEntry, homeNumbers, openAdd, sheet, today, unlocked, yesterday } from "./helpers";

test.beforeEach(async ({ page }) => {
  await unlocked(page);
});

test("add expense and income with the + button; Home totals in Indian format", async ({ page }) => {
  await expect(page.getByText("No entries yet")).toBeVisible();
  await addEntry(page, { amount: "120.5", note: "Chai and samosa", category: "Food" });
  await addEntry(page, { type: "Money In", amount: "125000", note: "October salary", category: "Salary", mode: "Bank" });

  await expect.poll(() => homeNumbers(page)).toEqual({ today: "₹120.50", in: "₹1,25,000", out: "₹120.50", balance: "₹1,24,879.50" });
  const recent = page.getByTestId("entry").filter({ visible: true });
  await expect(recent).toHaveCount(2);
  await expect(recent.first()).toContainText("October salary");
  await expect(recent.first()).toContainText("+₹1,25,000");
  await expect(recent.nth(1)).toContainText("−₹120.50");
  // safe to spend falls back to this month's income
  await expect(page.getByTestId("safe-per-day").filter({ visible: true })).toContainText("/day");
});

test("note is required, future dates and bad amounts are rejected", async ({ page }) => {
  await openAdd(page);
  const s = sheet(page);
  await s.getByRole("button", { name: "Add", exact: true }).click();
  await expect(s.getByText("Enter an amount.")).toBeVisible();
  await expect(s.getByText("What was this for? Add a short note.")).toBeVisible();
  await expect(s.getByText("Pick a category.")).toBeVisible();

  await s.getByLabel("Amount in rupees").fill("12a,5.5.75");
  await expect(s.getByLabel("Amount in rupees")).toHaveValue("125.57");

  await fillEntry(page, { amount: "50", note: "Movie", category: "Fun", date: "2099-01-01" });
  await s.getByRole("button", { name: "Add", exact: true }).click();
  await expect(s.getByText("Date can't be in the future.")).toBeVisible();
  await expect(s).toBeVisible();

  await s.locator('input[name="date"]').fill(yesterday());
  await expect(s.getByText(formatDMY(yesterday()))).toBeVisible(); // shown as DD-MM-YYYY
  await s.getByRole("button", { name: "Add", exact: true }).click();
  await expect(s).toBeHidden();
  await expect.poll(async () => (await homeNumbers(page)).today).toBe("₹0"); // yesterday doesn't count as today
});

test("smart suggestions fill category and amount from past notes", async ({ page }) => {
  await addEntry(page, { amount: "60", note: "Auto to station", category: "Travel", mode: "UPI" });
  await openAdd(page);
  const s = sheet(page);
  await s.getByLabel("Note (what was this for?)").fill("au");
  const option = s.getByRole("option", { name: /Auto to station/ });
  await expect(option).toContainText("Travel · ₹60");
  await option.click();
  await expect(s.getByLabel("Note (what was this for?)")).toHaveValue("Auto to station");
  await expect(s.getByLabel("Amount in rupees")).toHaveValue("60");
  await expect(s.getByRole("group", { name: "Category" }).getByRole("button", { name: "Travel" })).toHaveAttribute("aria-pressed", "true");
  await expect(s.getByRole("group", { name: "Payment mode" }).getByRole("button", { name: "UPI" })).toHaveAttribute("aria-pressed", "true");
});

test("payment mode is remembered; tags are saved and offered again", async ({ page }) => {
  await addEntry(page, { amount: "999", note: "Hotel deposit", category: "Travel", mode: "Card", tags: "#trip-goa #Office" });
  await expect(page.getByTestId("entry").filter({ visible: true }).first()).toContainText("#trip-goa #office");
  await openAdd(page);
  const s = sheet(page);
  await expect(s.getByRole("group", { name: "Payment mode" }).getByRole("button", { name: "Card" })).toHaveAttribute("aria-pressed", "true");
  await s.getByRole("button", { name: "#trip-goa" }).click();
  await expect(s.getByLabel("Tags")).toHaveValue("#trip-goa");
  await s.getByLabel("Tags").fill("#bad tag!");
  await fillEntry(page, { amount: "1", note: "x", category: "Food" });
  await s.getByLabel("Tags").fill("#no!");
  await s.getByRole("button", { name: "Add", exact: true }).click();
  await expect(s.getByText(/Tags can use letters, numbers and dashes/)).toBeVisible();
});

test("edit, repeat, delete with Undo", async ({ page }) => {
  await addEntry(page, { amount: "150", note: "Groceries run", category: "Groceries", date: yesterday() });
  await page.getByTestId("entry").filter({ hasText: "Groceries run" }).click();
  const s = sheet(page);
  await expect(s.getByRole("heading", { name: "Edit entry" })).toBeVisible();
  await expect(s.getByLabel("Amount in rupees")).toHaveValue("150");
  await s.getByLabel("Amount in rupees").fill("175.25");
  await s.getByRole("button", { name: "Save" }).click();
  await expect(s).toBeHidden();
  await expect(page.getByTestId("entry").filter({ visible: true }).first()).toContainText("−₹175.25");

  // Repeat adds a copy dated today
  await page.getByTestId("entry").filter({ visible: true }).first().click();
  await sheet(page).getByRole("button", { name: "Repeat" }).click();
  await expect(page.getByText(/Repeated today · ₹175.25 · Groceries run/)).toBeVisible();
  await expect.poll(async () => (await homeNumbers(page)).today).toBe("₹175.25");
  await expect(page.getByTestId("entry").filter({ visible: true })).toHaveCount(2);

  // Delete the copy, then Undo within 5 seconds
  await page.getByTestId("entry").filter({ visible: true }).first().click();
  await sheet(page).getByRole("button", { name: "Delete" }).click();
  await expect(page.getByTestId("entry").filter({ visible: true })).toHaveCount(1);
  await expect.poll(async () => (await homeNumbers(page)).today).toBe("₹0");
  await clickUndo(page, "Deleted");
  await expect(page.getByTestId("entry").filter({ visible: true })).toHaveCount(2);
  await expect.poll(async () => (await homeNumbers(page)).today).toBe("₹175.25");
});

test("Undo right after adding removes the entry", async ({ page }) => {
  await addEntry(page, { amount: "40", note: "Oops", category: "Other" });
  await expect(page.getByTestId("entry").filter({ visible: true })).toHaveCount(1);
  await clickUndo(page, "Added ₹40 · Oops");
  await expect(page.getByTestId("entry").filter({ visible: true })).toHaveCount(0);
});

test("Entries page groups by day with day totals and switches months", async ({ page }) => {
  await addEntry(page, { amount: "60", note: "Auto", category: "Travel" });
  await addEntry(page, { amount: "100", note: "Lunch", category: "Food", date: yesterday() });
  await addEntry(page, { type: "Money In", amount: "5000", note: "Freelance logo", category: "Freelance", date: yesterday() });
  await page.goto("/entries");
  await expect(page.getByRole("region", { name: "Today" })).toBeVisible();
  const yesterdaySection = page.getByRole("region", { name: "Yesterday" });
  // Yesterday may fall in last month on the 1st; only check when it's the same month
  if (yesterday().slice(0, 7) === today().slice(0, 7)) {
    await expect(yesterdaySection.getByTestId("day-total")).toHaveText("−₹100+₹5,000");
    await expect(page.getByRole("region", { name: "Month totals" }).getByTestId("entries-balance")).toHaveText("₹4,840");
  }
  await page.getByRole("link", { name: "Previous month" }).click();
  await expect(page).toHaveURL(/month=\d{4}-\d{2}/);
  await page.getByRole("link", { name: "Previous month" }).click();
  await expect(page.getByText("No entries this month")).toBeVisible();
});
