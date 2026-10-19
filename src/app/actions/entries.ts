"use server";

import { refresh } from "next/cache";
import type { ActionResult, Entry, EntryInput } from "@/lib/types";
import { entryInputSchema, fieldErrors, idSchema } from "@/lib/validation";
import { bad, guarded, ok } from "@/server/action-utils";
import { today } from "@/server/data";
import { getStore } from "@/server/store";

/** Checks the parts zod can't: the date isn't in the future, the category and wallet exist and match. */
async function validateEntry(raw: unknown): Promise<ActionResult<EntryInput>> {
  const parsed = entryInputSchema.safeParse(raw);
  if (!parsed.success) {
    const fe = fieldErrors(parsed.error);
    return bad(Object.values(fe)[0] ?? "Please check the entry.", fe);
  }
  const input = parsed.data;
  if (input.date > (await today())) return bad("Date can't be in the future.", { date: "Date can't be in the future." });

  const store = getStore();
  const [categories, wallets] = await Promise.all([store.listCategories(), store.listWallets()]);
  const category = categories.find((c) => c.id === input.categoryId);
  if (!category) return bad("Pick a category.", { categoryId: "Pick a category." });
  if (category.type !== input.type) return bad("That category is for the other type. Pick another one.", { categoryId: "Pick a category." });
  if (!wallets.some((w) => w.id === input.walletId)) return bad("Pick a wallet.", { walletId: "Pick a wallet." });
  return ok(input);
}

async function rememberLastUsed(input: Pick<EntryInput, "paymentMode" | "walletId">) {
  await getStore().updateSettings({ lastPaymentMode: input.paymentMode, lastWalletId: input.walletId });
}

export async function createEntry(raw: unknown): Promise<ActionResult<Entry>> {
  return guarded(async () => {
    const v = await validateEntry(raw);
    if (!v.ok) return v;
    const entry = await getStore().createEntry(v.data);
    await rememberLastUsed(v.data);
    refresh();
    return ok(entry);
  });
}

export async function updateEntry(id: unknown, raw: unknown): Promise<ActionResult<Entry>> {
  return guarded(async () => {
    const idOk = idSchema.safeParse(id);
    if (!idOk.success) return bad(idOk.error.issues[0].message);
    const v = await validateEntry(raw);
    if (!v.ok) return v;
    const entry = await getStore().updateEntry(idOk.data, v.data);
    if (!entry) return bad("This entry no longer exists. It may have been deleted on another device.");
    refresh();
    return ok(entry);
  });
}

export async function deleteEntry(id: unknown): Promise<ActionResult<{ id: string }>> {
  return guarded(async () => {
    const idOk = idSchema.safeParse(id);
    if (!idOk.success) return bad(idOk.error.issues[0].message);
    const done = await getStore().softDeleteEntry(idOk.data);
    if (!done) return bad("This entry was already deleted.");
    refresh();
    return ok({ id: idOk.data });
  });
}

export async function restoreEntry(id: unknown): Promise<ActionResult<Entry>> {
  return guarded(async () => {
    const idOk = idSchema.safeParse(id);
    if (!idOk.success) return bad(idOk.error.issues[0].message);
    const entry = await getStore().restoreEntry(idOk.data);
    if (!entry) return bad("Couldn't undo: the entry is gone.");
    refresh();
    return ok(entry);
  });
}

/** Adds a copy of an entry dated today. */
export async function repeatEntry(id: unknown): Promise<ActionResult<Entry>> {
  return guarded(async () => {
    const idOk = idSchema.safeParse(id);
    if (!idOk.success) return bad(idOk.error.issues[0].message);
    const store = getStore();
    const src = await store.getEntry(idOk.data);
    if (!src) return bad("This entry no longer exists.");
    const { id: _id, createdAt: _c, ...rest } = src;
    const v = await validateEntry({ ...rest, date: await today() });
    if (!v.ok) return v;
    const entry = await store.createEntry(v.data);
    refresh();
    return ok(entry);
  });
}

/** One-tap add from a saved quick-add preset, dated today. */
export async function addFromQuickAdd(quickAddId: unknown): Promise<ActionResult<Entry>> {
  return guarded(async () => {
    const idOk = idSchema.safeParse(quickAddId);
    if (!idOk.success) return bad(idOk.error.issues[0].message);
    const store = getStore();
    const q = (await store.listQuickAdds()).find((x) => x.id === idOk.data);
    if (!q) return bad("That quick-add no longer exists.");
    const v = await validateEntry({
      type: q.type,
      amountPaise: q.amountPaise,
      categoryId: q.categoryId,
      note: q.note,
      date: await today(),
      paymentMode: q.paymentMode,
      walletId: q.walletId,
      tags: [],
    });
    if (!v.ok) return v;
    const entry = await store.createEntry(v.data);
    await rememberLastUsed(v.data);
    refresh();
    return ok(entry);
  });
}
