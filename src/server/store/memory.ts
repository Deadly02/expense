import "server-only";
import { randomUUID } from "node:crypto";
import { checkPinLimits, type PinAttempt } from "@/lib/pin-limits";
import { sortEntries } from "@/lib/summary";
import type { Category, Entry, EntryInput, QuickAdd, QuickAddInput, Settings, Wallet } from "@/lib/types";
import { DEFAULT_CATEGORIES } from "./seed";
import { DEFAULT_SETTINGS, StoreError, type CategoryInput, type EntryQuery, type PinAttemptStart, type Store, type WalletInput } from "./types";

/**
 * In-memory store for automated tests (DATA_BACKEND=memory). Data disappears
 * when the server restarts. Never used with real data.
 */

type State = {
  entries: (Entry & { deletedAt: string | null })[];
  categories: Category[];
  wallets: Wallet[];
  quickAdds: QuickAdd[];
  settings: Settings;
  pinAttempts: (PinAttempt & { id: string })[];
};

function freshState(): State {
  return {
    entries: [],
    categories: DEFAULT_CATEGORIES.map((c) => ({ id: randomUUID(), hidden: false, ...c })),
    wallets: [{ id: randomUUID(), name: "Cash", kind: "cash", openingBalancePaise: 0, hidden: false, sortOrder: 10 }],
    quickAdds: [],
    settings: { ...DEFAULT_SETTINGS },
    pinAttempts: [],
  };
}

const g = globalThis as unknown as { __moneyTrackerMemory?: State };
const state = (): State => (g.__moneyTrackerMemory ??= freshState());

export function resetMemoryStore(): void {
  g.__moneyTrackerMemory = freshState();
}

const strip = ({ deletedAt: _deletedAt, ...e }: Entry & { deletedAt: string | null }): Entry => ({ ...e, tags: [...e.tags] });
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const nextSort = (items: { sortOrder: number }[]) => items.reduce((m, i) => Math.max(m, i.sortOrder), 0) + 10;

/** Mimics created_at: strictly increasing even within the same millisecond. */
let lastCreated = 0;
function createdAt(): string {
  lastCreated = Math.max(Date.now(), lastCreated + 1);
  return new Date(lastCreated).toISOString();
}

export const memoryStore: Store = {
  async listEntries(q: EntryQuery) {
    let rows = state().entries.filter(
      (e) => !e.deletedAt && (!q.from || e.date >= q.from) && (!q.to || e.date <= q.to),
    );
    rows = sortEntries(rows);
    return (q.limit ? rows.slice(0, q.limit) : rows).map(strip);
  },
  async getEntry(id) {
    const e = state().entries.find((x) => x.id === id && !x.deletedAt);
    return e ? strip(e) : null;
  },
  async createEntry(input: EntryInput) {
    const e = { ...input, tags: [...input.tags], id: randomUUID(), createdAt: createdAt(), deletedAt: null };
    state().entries.push(e);
    return strip(e);
  },
  async updateEntry(id, input) {
    const e = state().entries.find((x) => x.id === id && !x.deletedAt);
    if (!e) return null;
    Object.assign(e, input, { tags: [...input.tags] });
    return strip(e);
  },
  async softDeleteEntry(id) {
    const e = state().entries.find((x) => x.id === id && !x.deletedAt);
    if (!e) return false;
    e.deletedAt = new Date().toISOString();
    return true;
  },
  async restoreEntry(id) {
    const e = state().entries.find((x) => x.id === id);
    if (!e) return null;
    e.deletedAt = null;
    return strip(e);
  },
  async recentEntries(limit) {
    return [...state().entries]
      .filter((e) => !e.deletedAt)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map(strip);
  },

  async listCategories() {
    return [...state().categories].sort((a, b) => a.type.localeCompare(b.type) || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  },
  async createCategory(input: CategoryInput) {
    const s = state();
    if (s.categories.some((c) => c.type === input.type && sameName(c.name, input.name))) {
      throw new StoreError("A category with that name already exists.");
    }
    const c: Category = { id: randomUUID(), ...input, sortOrder: nextSort(s.categories.filter((x) => x.type === input.type)) };
    s.categories.push(c);
    return { ...c };
  },
  async updateCategory(id, input) {
    const s = state();
    const c = s.categories.find((x) => x.id === id);
    if (!c) return null;
    if (s.categories.some((x) => x.id !== id && x.type === input.type && sameName(x.name, input.name))) {
      throw new StoreError("A category with that name already exists.");
    }
    Object.assign(c, input);
    return { ...c };
  },

  async listWallets() {
    return [...state().wallets].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  },
  async createWallet(input: WalletInput) {
    const s = state();
    if (s.wallets.some((w) => sameName(w.name, input.name))) throw new StoreError("A wallet with that name already exists.");
    const w: Wallet = { id: randomUUID(), openingBalancePaise: 0, sortOrder: nextSort(s.wallets), ...input };
    s.wallets.push(w);
    return { ...w };
  },
  async updateWallet(id, input) {
    const s = state();
    const w = s.wallets.find((x) => x.id === id);
    if (!w) return null;
    if (s.wallets.some((x) => x.id !== id && sameName(x.name, input.name))) throw new StoreError("A wallet with that name already exists.");
    Object.assign(w, input);
    return { ...w };
  },

  async listQuickAdds() {
    return [...state().quickAdds].sort((a, b) => a.sortOrder - b.sortOrder);
  },
  async createQuickAdd(input: QuickAddInput) {
    const s = state();
    const q: QuickAdd = { id: randomUUID(), ...input, sortOrder: nextSort(s.quickAdds) };
    s.quickAdds.push(q);
    return { ...q };
  },
  async updateQuickAdd(id, input) {
    const q = state().quickAdds.find((x) => x.id === id);
    if (!q) return null;
    Object.assign(q, input);
    return { ...q };
  },
  async deleteQuickAdd(id) {
    const s = state();
    const before = s.quickAdds.length;
    s.quickAdds = s.quickAdds.filter((q) => q.id !== id);
    return s.quickAdds.length < before;
  },

  async getSettings() {
    return { ...state().settings };
  },
  async updateSettings(patch) {
    const s = state();
    s.settings = { ...s.settings, ...patch };
    return { ...s.settings };
  },

  async pinBeginAttempt(clientKey): Promise<PinAttemptStart> {
    const s = state();
    const now = Date.now();
    s.pinAttempts = s.pinAttempts.filter((a) => a.at > now - 86_400_000);
    const verdict = checkPinLimits(s.pinAttempts, clientKey, now);
    if (!verdict.allowed) return verdict;
    const id = randomUUID();
    s.pinAttempts.push({ id, clientKey, at: now });
    return { allowed: true, attemptId: id };
  },
  async pinFinishAttempt(attemptId, success) {
    if (!success) return;
    const s = state();
    const attempt = s.pinAttempts.find((a) => a.id === attemptId);
    if (attempt) s.pinAttempts = s.pinAttempts.filter((a) => a.clientKey !== attempt.clientKey);
  },
};
