export const ENTRY_TYPES = ["expense", "income"] as const;
export type EntryType = (typeof ENTRY_TYPES)[number];

export const PAYMENT_MODES = ["Cash", "UPI", "Card", "Bank"] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export const WALLET_KINDS = ["cash", "bank", "card", "other"] as const;
export type WalletKind = (typeof WALLET_KINDS)[number];

export type Entry = {
  id: string;
  type: EntryType;
  amountPaise: number;
  categoryId: string;
  note: string;
  /** YYYY-MM-DD */
  date: string;
  paymentMode: PaymentMode;
  walletId: string;
  tags: string[];
  createdAt: string;
};

export type EntryInput = Omit<Entry, "id" | "createdAt">;

export type Category = {
  id: string;
  type: EntryType;
  name: string;
  icon: string;
  color: string;
  hidden: boolean;
  sortOrder: number;
};

export type Wallet = {
  id: string;
  name: string;
  kind: WalletKind;
  openingBalancePaise: number;
  hidden: boolean;
  sortOrder: number;
};

export type QuickAdd = {
  id: string;
  type: EntryType;
  amountPaise: number;
  categoryId: string;
  note: string;
  paymentMode: PaymentMode;
  walletId: string;
  sortOrder: number;
};

export type QuickAddInput = Omit<QuickAdd, "id" | "sortOrder">;

/** A past note offered while typing, with what it was last used with. */
export type NoteSuggestion = {
  note: string;
  type: EntryType;
  categoryId: string;
  amountPaise: number;
  paymentMode: PaymentMode;
  walletId: string;
  uses: number;
};

export type Settings = {
  monthlyBudgetPaise: number | null;
  lastPaymentMode: PaymentMode;
  lastWalletId: string | null;
  defaultPaymentMode: PaymentMode | null;
  defaultWalletId: string | null;
};

/** Everything the add/edit sheet needs, loaded once per page view. */
export type Bootstrap = {
  today: string;
  categories: Category[];
  wallets: Wallet[];
  quickAdds: QuickAdd[];
  suggestions: NoteSuggestion[];
  recentTags: string[];
  settings: Settings;
};

/** Result of every server action: either data, or a message to show. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };
