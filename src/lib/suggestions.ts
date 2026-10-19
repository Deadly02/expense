import type { Entry, NoteSuggestion } from "./types";

type Recent = Pick<Entry, "note" | "type" | "categoryId" | "amountPaise" | "paymentMode" | "walletId" | "tags" | "createdAt">;

/**
 * One suggestion per distinct note (case-insensitive) and type, carrying the
 * category/amount/payment it was most recently used with. Most-used first.
 * `recent` must be sorted newest first.
 */
export function buildSuggestions(recent: Recent[], max = 300): NoteSuggestion[] {
  const byKey = new Map<string, NoteSuggestion & { order: number }>();
  recent.forEach((r, i) => {
    const key = `${r.type}|${r.note.trim().toLowerCase()}`;
    const found = byKey.get(key);
    if (found) found.uses += 1;
    else
      byKey.set(key, {
        note: r.note.trim(),
        type: r.type,
        categoryId: r.categoryId,
        amountPaise: r.amountPaise,
        paymentMode: r.paymentMode,
        walletId: r.walletId,
        uses: 1,
        order: i,
      });
  });
  return [...byKey.values()]
    .sort((a, b) => b.uses - a.uses || a.order - b.order)
    .slice(0, max)
    .map(({ order: _order, ...s }) => s);
}

/** Tags in order of most recent use. */
export function recentTags(recent: Recent[], max = 12): string[] {
  const out: string[] = [];
  for (const r of recent) for (const t of r.tags) if (!out.includes(t) && out.length < max) out.push(t);
  return out;
}

/**
 * Suggestions matching what's typed: notes starting with it first, then
 * notes containing it. Hides an exact match (nothing to suggest).
 */
export function matchSuggestions(all: NoteSuggestion[], typed: string, type: Entry["type"], limit = 5): NoteSuggestion[] {
  const q = typed.trim().toLowerCase();
  if (!q) return [];
  const ofType = all.filter((s) => s.type === type && s.note.toLowerCase() !== q);
  const starts = ofType.filter((s) => s.note.toLowerCase().startsWith(q));
  const words = ofType.filter((s) => !starts.includes(s) && s.note.toLowerCase().split(/\s+/).some((w) => w.startsWith(q)));
  const contains = ofType.filter((s) => !starts.includes(s) && !words.includes(s) && s.note.toLowerCase().includes(q));
  return [...starts, ...words, ...contains].slice(0, limit);
}
