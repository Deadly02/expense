import "server-only";
import { addMonths, monthRange, monthStartFromKey, todayIn } from "@/lib/dates";
import { buildSuggestions, recentTags } from "@/lib/suggestions";
import { safeToSpend, spentOn, totals } from "@/lib/summary";
import type { Bootstrap } from "@/lib/types";
import { getEnv } from "./env";
import { requireSession } from "./session";
import { getStore } from "./store";

/**
 * Data access layer for pages and route handlers. Every function checks the
 * PIN session first, then reads through the store.
 */

export async function today(): Promise<string> {
  return todayIn(getEnv().timeZone);
}

export async function getBootstrap(): Promise<Bootstrap> {
  await requireSession();
  const store = getStore();
  const [categories, wallets, quickAdds, recent, settings] = await Promise.all([
    store.listCategories(),
    store.listWallets(),
    store.listQuickAdds(),
    store.recentEntries(1500),
    store.getSettings(),
  ]);
  return {
    today: await today(),
    categories,
    wallets,
    quickAdds,
    suggestions: buildSuggestions(recent),
    recentTags: recentTags(recent),
    settings,
  };
}

export async function getHomeData() {
  await requireSession();
  const store = getStore();
  const t = await today();
  const month = monthRange(t);
  const [monthEntries, recent, settings, categories, wallets] = await Promise.all([
    store.listEntries(month),
    store.listEntries({ limit: 8 }),
    store.getSettings(),
    store.listCategories(),
    store.listWallets(),
  ]);
  const m = totals(monthEntries);
  return {
    today: t,
    todaySpentPaise: spentOn(monthEntries, t),
    month: m,
    safe: safeToSpend({ today: t, monthOutPaise: m.outPaise, monthInPaise: m.inPaise, budgetPaise: settings.monthlyBudgetPaise }),
    recent,
    categories,
    wallets,
  };
}

/** Entries for one month ("2026-10"); defaults to the current month and never goes past it. */
export async function getMonthEntries(monthKeyParam: string | undefined) {
  await requireSession();
  const store = getStore();
  const t = await today();
  const current = monthRange(t).from;
  let start = (monthKeyParam && monthStartFromKey(monthKeyParam)) || current;
  if (start > current) start = current;
  const range = monthRange(start);
  const [entries, categories, wallets] = await Promise.all([store.listEntries(range), store.listCategories(), store.listWallets()]);
  return {
    today: t,
    range,
    entries,
    totals: totals(entries),
    prevMonth: addMonths(start, -1).slice(0, 7),
    nextMonth: start < current ? addMonths(start, 1).slice(0, 7) : null,
    categories,
    wallets,
  };
}

export async function getSettingsData() {
  await requireSession();
  const store = getStore();
  const [settings, wallets] = await Promise.all([store.getSettings(), store.listWallets()]);
  return { settings, wallets };
}

export async function getCategoriesData() {
  await requireSession();
  return getStore().listCategories();
}

export async function getWalletsData() {
  await requireSession();
  return getStore().listWallets();
}

export async function getQuickAddsData() {
  await requireSession();
  const store = getStore();
  const [quickAdds, categories, wallets] = await Promise.all([store.listQuickAdds(), store.listCategories(), store.listWallets()]);
  return { quickAdds, categories, wallets };
}
