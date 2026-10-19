import "server-only";
import { createClient, type PostgrestError, type SupabaseClient } from "@supabase/supabase-js";
import { decimalToPaise, paiseToDecimal } from "@/lib/money";
import { PAYMENT_MODES, type Category, type Entry, type EntryInput, type PaymentMode, type QuickAdd, type QuickAddInput, type Settings, type Wallet } from "@/lib/types";
import { getEnv } from "../env";
import { PIN_LIMITS } from "@/lib/pin-limits";
import { DEFAULT_SETTINGS, SETTING_KEYS, StoreError, type CategoryInput, type EntryQuery, type PinAttemptStart, type RecentEntry, type Store, type WalletInput } from "./types";

/**
 * Real data, via the Supabase secret key. Runs on the server only; the key is
 * never sent to the browser.
 */

let client: { key: string; sb: SupabaseClient } | null = null;
function db(): SupabaseClient {
  const env = getEnv();
  const key = env.supabaseUrl + env.supabaseSecretKey;
  if (client?.key !== key) {
    client = {
      key,
      sb: createClient(env.supabaseUrl, env.supabaseSecretKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      }),
    };
  }
  return client.sb;
}

/** Turns database errors into messages a person can act on. */
function fail(error: PostgrestError, what: string): never {
  if (error.code === "23505") throw new StoreError(`${what} with that name already exists.`);
  if (error.code === "23503") throw new StoreError("That category or wallet no longer exists. Refresh and try again.");
  if (error.code === "42P01" || error.code === "PGRST205" || error.code === "42703") {
    throw new Error("The database isn't set up yet. Run the migrations in supabase/migrations (see README).");
  }
  if (error.code === "42501") throw new Error("The server key can't access the database. Check SUPABASE_SECRET_KEY.");
  throw new Error(error.message || "The database returned an error.");
}

// Amounts are read as text (amount::text) so no decimal is ever rounded through a float.
const ENTRY_COLS = "id,type,amount_text:amount::text,category_id,note,txn_date,payment_mode,wallet_id,tags,created_at";
type EntryRow = {
  id: string;
  type: Entry["type"];
  amount_text: string;
  category_id: string;
  note: string;
  txn_date: string;
  payment_mode: PaymentMode;
  wallet_id: string;
  tags: string[] | null;
  created_at: string;
};
const toEntry = (r: EntryRow): Entry => ({
  id: r.id,
  type: r.type,
  amountPaise: decimalToPaise(r.amount_text),
  categoryId: r.category_id,
  note: r.note,
  date: r.txn_date,
  paymentMode: r.payment_mode,
  walletId: r.wallet_id,
  tags: r.tags ?? [],
  createdAt: r.created_at,
});
const entryRow = (e: EntryInput) => ({
  type: e.type,
  amount: paiseToDecimal(e.amountPaise),
  category_id: e.categoryId,
  note: e.note,
  txn_date: e.date,
  payment_mode: e.paymentMode,
  wallet_id: e.walletId,
  tags: e.tags,
});

const CATEGORY_COLS = "id,type,name,icon,color,hidden,sort_order";
type CategoryRow = { id: string; type: Category["type"]; name: string; icon: string; color: string; hidden: boolean; sort_order: number };
const toCategory = (r: CategoryRow): Category => ({ id: r.id, type: r.type, name: r.name, icon: r.icon, color: r.color, hidden: r.hidden, sortOrder: r.sort_order });

const WALLET_COLS = "id,name,kind,opening_text:opening_balance::text,hidden,sort_order";
type WalletRow = { id: string; name: string; kind: Wallet["kind"]; opening_text: string; hidden: boolean; sort_order: number };
const toWallet = (r: WalletRow): Wallet => ({
  id: r.id,
  name: r.name,
  kind: r.kind,
  openingBalancePaise: decimalToPaise(r.opening_text),
  hidden: r.hidden,
  sortOrder: r.sort_order,
});

const QUICK_COLS = "id,type,amount_text:amount::text,category_id,note,payment_mode,wallet_id,sort_order";
type QuickRow = { id: string; type: QuickAdd["type"]; amount_text: string; category_id: string; note: string; payment_mode: PaymentMode; wallet_id: string; sort_order: number };
const toQuick = (r: QuickRow): QuickAdd => ({
  id: r.id,
  type: r.type,
  amountPaise: decimalToPaise(r.amount_text),
  categoryId: r.category_id,
  note: r.note,
  paymentMode: r.payment_mode,
  walletId: r.wallet_id,
  sortOrder: r.sort_order,
});
const quickRow = (q: QuickAddInput) => ({
  type: q.type,
  amount: paiseToDecimal(q.amountPaise),
  category_id: q.categoryId,
  note: q.note,
  payment_mode: q.paymentMode,
  wallet_id: q.walletId,
});

async function nextSortOrder(table: string, filter?: { col: string; val: string }): Promise<number> {
  let query = db().from(table).select("sort_order").order("sort_order", { ascending: false }).limit(1);
  if (filter) query = query.eq(filter.col, filter.val);
  const { data, error } = await query;
  if (error) fail(error, "Item");
  return ((data?.[0] as { sort_order: number } | undefined)?.sort_order ?? 0) + 10;
}

const PAGE = 1000;

export const supabaseStore: Store = {
  async listEntries(q: EntryQuery) {
    const out: Entry[] = [];
    const want = q.limit ?? Infinity;
    for (let from = 0; out.length < want; from += PAGE) {
      let query = db()
        .from("transactions")
        .select(ENTRY_COLS)
        .is("deleted_at", null)
        .order("txn_date", { ascending: false })
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, from + Math.min(PAGE, want - out.length) - 1);
      if (q.from) query = query.gte("txn_date", q.from);
      if (q.to) query = query.lte("txn_date", q.to);
      const { data, error } = await query;
      if (error) fail(error, "Entry");
      const rows = (data ?? []) as unknown as EntryRow[];
      out.push(...rows.map(toEntry));
      if (rows.length < PAGE) break;
    }
    return out;
  },
  async getEntry(id) {
    const { data, error } = await db().from("transactions").select(ENTRY_COLS).eq("id", id).is("deleted_at", null).maybeSingle();
    if (error) fail(error, "Entry");
    return data ? toEntry(data as unknown as EntryRow) : null;
  },
  async createEntry(input) {
    const { data, error } = await db().from("transactions").insert(entryRow(input)).select(ENTRY_COLS).single();
    if (error) fail(error, "Entry");
    return toEntry(data as unknown as EntryRow);
  },
  async updateEntry(id, input) {
    const { data, error } = await db()
      .from("transactions")
      .update(entryRow(input))
      .eq("id", id)
      .is("deleted_at", null)
      .select(ENTRY_COLS)
      .maybeSingle();
    if (error) fail(error, "Entry");
    return data ? toEntry(data as unknown as EntryRow) : null;
  },
  async softDeleteEntry(id) {
    const { data, error } = await db()
      .from("transactions")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .is("deleted_at", null)
      .select("id");
    if (error) fail(error, "Entry");
    return (data ?? []).length > 0;
  },
  async restoreEntry(id) {
    const { data, error } = await db().from("transactions").update({ deleted_at: null }).eq("id", id).select(ENTRY_COLS).maybeSingle();
    if (error) fail(error, "Entry");
    return data ? toEntry(data as unknown as EntryRow) : null;
  },
  async recentEntries(limit) {
    const { data, error } = await db()
      .from("transactions")
      .select("note,type,category_id,amount_text:amount::text,payment_mode,wallet_id,tags,created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) fail(error, "Entry");
    return ((data ?? []) as unknown as (Omit<EntryRow, "id" | "txn_date">)[]).map(
      (r): RecentEntry => ({
        note: r.note,
        type: r.type,
        categoryId: r.category_id,
        amountPaise: decimalToPaise(r.amount_text),
        paymentMode: r.payment_mode,
        walletId: r.wallet_id,
        tags: r.tags ?? [],
        createdAt: r.created_at,
      }),
    );
  },

  async listCategories() {
    const { data, error } = await db().from("categories").select(CATEGORY_COLS).order("type").order("sort_order").order("name");
    if (error) fail(error, "Category");
    return ((data ?? []) as CategoryRow[]).map(toCategory);
  },
  async createCategory(input: CategoryInput) {
    const sort_order = await nextSortOrder("categories", { col: "type", val: input.type });
    const { data, error } = await db().from("categories").insert({ ...input, sort_order }).select(CATEGORY_COLS).single();
    if (error) fail(error, "A category");
    return toCategory(data as CategoryRow);
  },
  async updateCategory(id, input) {
    const { data, error } = await db().from("categories").update(input).eq("id", id).select(CATEGORY_COLS).maybeSingle();
    if (error) fail(error, "A category");
    return data ? toCategory(data as CategoryRow) : null;
  },

  async listWallets() {
    const { data, error } = await db().from("wallets").select(WALLET_COLS).order("sort_order").order("name");
    if (error) fail(error, "Wallet");
    return ((data ?? []) as unknown as WalletRow[]).map(toWallet);
  },
  async createWallet(input: WalletInput) {
    const sort_order = await nextSortOrder("wallets");
    const { data, error } = await db().from("wallets").insert({ ...input, sort_order }).select(WALLET_COLS).single();
    if (error) fail(error, "A wallet");
    return toWallet(data as unknown as WalletRow);
  },
  async updateWallet(id, input) {
    const { data, error } = await db().from("wallets").update(input).eq("id", id).select(WALLET_COLS).maybeSingle();
    if (error) fail(error, "A wallet");
    return data ? toWallet(data as unknown as WalletRow) : null;
  },

  async listQuickAdds() {
    const { data, error } = await db().from("quick_adds").select(QUICK_COLS).order("sort_order");
    if (error) fail(error, "Quick-add");
    return ((data ?? []) as unknown as QuickRow[]).map(toQuick);
  },
  async createQuickAdd(input) {
    const sort_order = await nextSortOrder("quick_adds");
    const { data, error } = await db().from("quick_adds").insert({ ...quickRow(input), sort_order }).select(QUICK_COLS).single();
    if (error) fail(error, "A quick-add");
    return toQuick(data as unknown as QuickRow);
  },
  async updateQuickAdd(id, input) {
    const { data, error } = await db().from("quick_adds").update(quickRow(input)).eq("id", id).select(QUICK_COLS).maybeSingle();
    if (error) fail(error, "A quick-add");
    return data ? toQuick(data as unknown as QuickRow) : null;
  },
  async deleteQuickAdd(id) {
    const { data, error } = await db().from("quick_adds").delete().eq("id", id).select("id");
    if (error) fail(error, "Quick-add");
    return (data ?? []).length > 0;
  },

  async getSettings() {
    const { data, error } = await db().from("app_settings").select("key,value");
    if (error) fail(error, "Setting");
    const map = new Map(((data ?? []) as { key: string; value: unknown }[]).map((r) => [r.key, r.value]));
    return readSettings(map);
  },
  async updateSettings(patch) {
    const rows = (Object.keys(patch) as (keyof Settings)[]).map((k) => ({
      key: SETTING_KEYS[k],
      value: patch[k] ?? null,
      updated_at: new Date().toISOString(),
    }));
    if (rows.length) {
      const { error } = await db().from("app_settings").upsert(rows, { onConflict: "key" });
      if (error) fail(error, "Setting");
    }
    return this.getSettings();
  },

  async pinBeginAttempt(clientKey): Promise<PinAttemptStart> {
    const { data, error } = await db().rpc("pin_begin_attempt", {
      p_client: clientKey,
      p_client_max: PIN_LIMITS.clientMax,
      p_client_minutes: PIN_LIMITS.clientMinutes,
      p_global_max: PIN_LIMITS.globalMax,
      p_global_minutes: PIN_LIMITS.globalMinutes,
    });
    if (error) fail(error, "PIN check");
    const row = (Array.isArray(data) ? data[0] : data) as
      | { allowed: boolean; scope: "client" | "global" | null; retry_after_seconds: number; attempt_id: number | string | null }
      | undefined;
    if (!row) throw new Error("The PIN check didn't answer. Run the migrations (see README).");
    if (row.allowed && row.attempt_id != null) return { allowed: true, attemptId: String(row.attempt_id) };
    return { allowed: false, scope: row.scope === "global" ? "global" : "client", retryAfterSeconds: row.retry_after_seconds };
  },
  async pinFinishAttempt(attemptId, success) {
    if (!success) return;
    const { error } = await db().rpc("pin_finish_attempt", { p_attempt_id: Number(attemptId), p_success: true });
    if (error) fail(error, "PIN check");
  },
};

/** Reads app_settings values defensively: anything unexpected falls back to the default. */
function readSettings(map: Map<string, unknown>): Settings {
  const mode = (v: unknown): PaymentMode | null => (PAYMENT_MODES.includes(v as PaymentMode) ? (v as PaymentMode) : null);
  const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
  const budget = map.get(SETTING_KEYS.monthlyBudgetPaise);
  return {
    monthlyBudgetPaise: typeof budget === "number" && Number.isSafeInteger(budget) && budget > 0 ? budget : null,
    lastPaymentMode: mode(map.get(SETTING_KEYS.lastPaymentMode)) ?? DEFAULT_SETTINGS.lastPaymentMode,
    lastWalletId: str(map.get(SETTING_KEYS.lastWalletId)),
    defaultPaymentMode: mode(map.get(SETTING_KEYS.defaultPaymentMode)),
    defaultWalletId: str(map.get(SETTING_KEYS.defaultWalletId)),
  };
}
