import { expect, test } from "@playwright/test";
import { addEntry, clickUndo, homeNumbers, openAdd, sheet, unlocked } from "./helpers";

test.beforeEach(async ({ page }) => {
  await unlocked(page);
});

test("custom categories: add with icon and colour, rename, hide", async ({ page }) => {
  await page.goto("/more/categories");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Category name").fill("Pets");
  await d.getByRole("button", { name: "paw-print" }).click();
  await d.getByRole("button", { name: "#8b5cf6" }).click();
  await d.getByRole("button", { name: "Save" }).click();
  await expect(d).toBeHidden();
  await expect(page.getByRole("button", { name: "Pets" })).toBeVisible();

  // Duplicate names are refused
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await d.getByLabel("Category name").fill("pets");
  await d.getByRole("button", { name: "Save" }).click();
  await expect(d.getByRole("alert")).toHaveText("A category with that name already exists.");
  await d.getByRole("button", { name: "Cancel" }).click();

  // Used when adding
  await addEntry(page, { amount: "450", note: "Dog food", category: "Pets" });

  // Rename and hide
  await page.goto("/more/categories");
  await page.getByRole("button", { name: "Pets" }).click();
  await d.getByLabel("Category name").fill("Pet care");
  await d.getByLabel("Hide this category").click();
  await d.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: /Pet care.*Hidden/ })).toBeVisible();

  await openAdd(page);
  await expect(sheet(page).getByRole("group", { name: "Category" }).getByRole("button", { name: "Pet care" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  // The old entry keeps its (renamed) category
  await page.goto("/");
  await expect(page.getByTestId("entry").filter({ visible: true }).first()).toContainText("Pet care");
});

test("quick-add presets: create, one tap to add, Undo", async ({ page }) => {
  await page.goto("/more/quick-adds");
  await expect(page.getByText("No quick-adds yet").first()).toBeVisible();
  await page.getByRole("button", { name: "Add quick-add" }).click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Amount (₹)").fill("20");
  await d.getByLabel("Note").fill("Tea");
  await d.getByRole("group", { name: "Category" }).getByRole("button", { name: "Food" }).click();
  await d.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: "Tea ₹20 · Food · Cash" })).toBeVisible();

  await page.goto("/");
  await page.getByRole("button", { name: "Quick add: Tea ₹20 · Food · Cash" }).click();
  await expect(page.getByText("Added ₹20 · Tea")).toBeVisible();
  await expect.poll(async () => (await homeNumbers(page)).today).toBe("₹20");
  await page.getByRole("button", { name: "Quick add: Tea ₹20 · Food · Cash" }).click();
  await expect.poll(async () => (await homeNumbers(page)).today).toBe("₹40");
  await clickUndo(page, "Added ₹20 · Tea");
  await expect.poll(async () => (await homeNumbers(page)).today).toBe("₹20");

  // Also inside the add sheet
  await openAdd(page);
  await sheet(page).getByRole("button", { name: "Quick add: Tea ₹20 · Food · Cash" }).click();
  await expect(sheet(page)).toBeHidden();
  await expect.poll(async () => (await homeNumbers(page)).today).toBe("₹40");
});

test("wallets: add one and pick it when adding", async ({ page }) => {
  await page.goto("/more/wallets");
  await page.getByRole("button", { name: "Add wallet" }).click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Name").fill("HDFC Savings");
  await d.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: /HDFC Savings/ })).toBeVisible();

  await openAdd(page);
  await sheet(page).getByLabel("Wallet").selectOption({ label: "HDFC Savings" });
  await sheet(page).getByLabel("Amount in rupees").fill("300");
  await sheet(page).getByLabel("Note (what was this for?)").fill("Electricity");
  await sheet(page).getByRole("group", { name: "Category" }).getByRole("button", { name: "Bills" }).click();
  await sheet(page).getByRole("button", { name: "Add", exact: true }).click();
  await expect(sheet(page)).toBeHidden();
  await page.goto("/");
  await expect(page.getByTestId("entry").filter({ visible: true }).first()).toContainText("HDFC Savings");
});

test("monthly budget drives safe-to-spend per day", async ({ page }) => {
  await page.goto("/more/settings");
  await page.getByLabel("Monthly budget (₹)").fill("31000");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Settings saved")).toBeVisible();
  await page.goto("/");
  await expect(page.getByTestId("safe-per-day").filter({ visible: true })).toBeVisible();
  await expect(page.getByText(/left for \d+ days?/).filter({ visible: true })).toContainText("₹31,000");
  await addEntry(page, { amount: "1000", note: "Shoes", category: "Shopping" });
  await expect(page.getByText(/left for \d+ days?/).filter({ visible: true })).toContainText("₹30,000");
});
