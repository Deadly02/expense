import type { EntryType } from "@/lib/types";

/** Same defaults as supabase/migrations/20261019000100_phase1_core.sql */
export const DEFAULT_CATEGORIES: { type: EntryType; name: string; icon: string; color: string; sortOrder: number }[] = [
  { type: "expense", name: "Food", icon: "utensils", color: "#f97316", sortOrder: 10 },
  { type: "expense", name: "Travel", icon: "car", color: "#0ea5e9", sortOrder: 20 },
  { type: "expense", name: "Groceries", icon: "shopping-basket", color: "#22c55e", sortOrder: 30 },
  { type: "expense", name: "Shopping", icon: "shopping-bag", color: "#ec4899", sortOrder: 40 },
  { type: "expense", name: "Bills", icon: "receipt", color: "#eab308", sortOrder: 50 },
  { type: "expense", name: "Rent", icon: "house", color: "#8b5cf6", sortOrder: 60 },
  { type: "expense", name: "Health", icon: "heart-pulse", color: "#ef4444", sortOrder: 70 },
  { type: "expense", name: "Fun", icon: "party-popper", color: "#14b8a6", sortOrder: 80 },
  { type: "expense", name: "Other", icon: "ellipsis", color: "#64748b", sortOrder: 90 },
  { type: "income", name: "Salary", icon: "briefcase", color: "#16a34a", sortOrder: 10 },
  { type: "income", name: "Freelance", icon: "laptop", color: "#0891b2", sortOrder: 20 },
  { type: "income", name: "Gift", icon: "gift", color: "#db2777", sortOrder: 30 },
  { type: "income", name: "Refund", icon: "undo-2", color: "#2563eb", sortOrder: 40 },
  { type: "income", name: "Other", icon: "ellipsis", color: "#64748b", sortOrder: 90 },
];
