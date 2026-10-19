"use server";

import { refresh } from "next/cache";
import type { ActionResult, Category, QuickAdd, Settings, Wallet } from "@/lib/types";
import {
  categoryInputSchema,
  fieldErrors,
  idSchema,
  quickAddInputSchema,
  settingsInputSchema,
  walletInputSchema,
} from "@/lib/validation";
import { bad, guarded, ok } from "@/server/action-utils";
import { getStore } from "@/server/store";

/** Categories, wallets, quick-adds and settings. */

function firstError(error: import("zod").ZodError) {
  const fe = fieldErrors(error);
  return bad(Object.values(fe)[0] ?? "Please check the form.", fe);
}

export async function saveCategory(id: unknown, raw: unknown): Promise<ActionResult<Category>> {
  return guarded(async () => {
    const parsed = categoryInputSchema.safeParse(raw);
    if (!parsed.success) return firstError(parsed.error);
    const store = getStore();
    if (id === null) {
      const c = await store.createCategory(parsed.data);
      refresh();
      return ok(c);
    }
    const idOk = idSchema.safeParse(id);
    if (!idOk.success) return bad(idOk.error.issues[0].message);
    const existing = (await store.listCategories()).find((c) => c.id === idOk.data);
    if (!existing) return bad("That category no longer exists.");
    // Changing type would mismatch its entries; keep the original type.
    const c = await store.updateCategory(idOk.data, { ...parsed.data, type: existing.type });
    if (!c) return bad("That category no longer exists.");
    refresh();
    return ok(c);
  });
}

export async function saveWallet(id: unknown, raw: unknown): Promise<ActionResult<Wallet>> {
  return guarded(async () => {
    const parsed = walletInputSchema.safeParse(raw);
    if (!parsed.success) return firstError(parsed.error);
    const store = getStore();
    if (id === null) {
      const w = await store.createWallet(parsed.data);
      refresh();
      return ok(w);
    }
    const idOk = idSchema.safeParse(id);
    if (!idOk.success) return bad(idOk.error.issues[0].message);
    if (parsed.data.hidden) {
      const visible = (await store.listWallets()).filter((w) => !w.hidden && w.id !== idOk.data);
      if (visible.length === 0) return bad("Keep at least one wallet visible.");
    }
    const w = await store.updateWallet(idOk.data, parsed.data);
    if (!w) return bad("That wallet no longer exists.");
    refresh();
    return ok(w);
  });
}

export async function saveQuickAdd(id: unknown, raw: unknown): Promise<ActionResult<QuickAdd>> {
  return guarded(async () => {
    const parsed = quickAddInputSchema.safeParse(raw);
    if (!parsed.success) return firstError(parsed.error);
    const store = getStore();
    const [categories, wallets] = await Promise.all([store.listCategories(), store.listWallets()]);
    const cat = categories.find((c) => c.id === parsed.data.categoryId);
    if (!cat || cat.type !== parsed.data.type) return bad("Pick a category.", { categoryId: "Pick a category." });
    if (!wallets.some((w) => w.id === parsed.data.walletId)) return bad("Pick a wallet.", { walletId: "Pick a wallet." });
    let q: QuickAdd | null;
    if (id === null) q = await store.createQuickAdd(parsed.data);
    else {
      const idOk = idSchema.safeParse(id);
      if (!idOk.success) return bad(idOk.error.issues[0].message);
      q = await store.updateQuickAdd(idOk.data, parsed.data);
    }
    if (!q) return bad("That quick-add no longer exists.");
    refresh();
    return ok(q);
  });
}

export async function deleteQuickAdd(id: unknown): Promise<ActionResult<{ id: string }>> {
  return guarded(async () => {
    const idOk = idSchema.safeParse(id);
    if (!idOk.success) return bad(idOk.error.issues[0].message);
    await getStore().deleteQuickAdd(idOk.data);
    refresh();
    return ok({ id: idOk.data });
  });
}

export async function saveSettings(raw: unknown): Promise<ActionResult<Settings>> {
  return guarded(async () => {
    const parsed = settingsInputSchema.safeParse(raw);
    if (!parsed.success) return firstError(parsed.error);
    const store = getStore();
    if (parsed.data.defaultWalletId && !(await store.listWallets()).some((w) => w.id === parsed.data.defaultWalletId)) {
      return bad("Pick a wallet.");
    }
    const s = await store.updateSettings({
      monthlyBudgetPaise: parsed.data.monthlyBudgetPaise || null,
      defaultPaymentMode: parsed.data.defaultPaymentMode,
      defaultWalletId: parsed.data.defaultWalletId,
    });
    refresh();
    return ok(s);
  });
}
