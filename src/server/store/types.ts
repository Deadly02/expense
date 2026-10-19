import type {
  Category,
  Entry,
  EntryInput,
  QuickAdd,
  QuickAddInput,
  Settings,
  Wallet,
  WalletKind,
  EntryType,
} from "@/lib/types";

export type EntryQuery = {
  from?: string;
  to?: string;
  limit?: number;
};

/** A raw past entry used to build note suggestions and recent tags. */
export type RecentEntry = Pick<Entry, "note" | "type" | "categoryId" | "amountPaise" | "paymentMode" | "walletId" | "tags" | "createdAt">;

export type CategoryInput = { type: EntryType; name: string; icon: string; color: string; hidden: boolean };
export type WalletInput = { name: string; kind: WalletKind; hidden: boolean };

/** Thrown for problems the person can fix (duplicate names, missing rows...). */
export class StoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoreError";
  }
}

/**
 * Everything the app reads or writes. Implemented for Supabase (real data) and
 * in memory (automated tests only).
 */
export interface Store {
  listEntries(q: EntryQuery): Promise<Entry[]>;
  getEntry(id: string): Promise<Entry | null>;
  createEntry(input: EntryInput): Promise<Entry>;
  updateEntry(id: string, input: EntryInput): Promise<Entry | null>;
  softDeleteEntry(id: string): Promise<boolean>;
  restoreEntry(id: string): Promise<Entry | null>;
  recentEntries(limit: number): Promise<RecentEntry[]>;

  listCategories(): Promise<Category[]>;
  createCategory(input: CategoryInput): Promise<Category>;
  updateCategory(id: string, input: CategoryInput): Promise<Category | null>;

  listWallets(): Promise<Wallet[]>;
  createWallet(input: WalletInput): Promise<Wallet>;
  updateWallet(id: string, input: WalletInput): Promise<Wallet | null>;

  listQuickAdds(): Promise<QuickAdd[]>;
  createQuickAdd(input: QuickAddInput): Promise<QuickAdd>;
  updateQuickAdd(id: string, input: QuickAddInput): Promise<QuickAdd | null>;
  deleteQuickAdd(id: string): Promise<boolean>;

  getSettings(): Promise<Settings>;
  updateSettings(patch: Partial<Settings>): Promise<Settings>;

  /**
   * Called before checking a PIN. Refuses when the device/IP or everyone is over
   * the wrong-PIN limit; otherwise records the attempt (counted as wrong until
   * finished as correct, so parallel guesses can't slip past the limit).
   */
  pinBeginAttempt(clientKey: string): Promise<PinAttemptStart>;
  /** A correct PIN removes this attempt and the earlier wrong ones from the same device/IP. */
  pinFinishAttempt(attemptId: string, success: boolean): Promise<void>;
}

export type PinAttemptStart =
  | { allowed: true; attemptId: string }
  | { allowed: false; scope: "client" | "global"; retryAfterSeconds: number };

export const DEFAULT_SETTINGS: Settings = {
  monthlyBudgetPaise: null,
  lastPaymentMode: "Cash",
  lastWalletId: null,
  defaultPaymentMode: null,
  defaultWalletId: null,
};

/** app_settings keys <-> Settings fields */
export const SETTING_KEYS: Record<keyof Settings, string> = {
  monthlyBudgetPaise: "monthly_budget_paise",
  lastPaymentMode: "last_payment_mode",
  lastWalletId: "last_wallet_id",
  defaultPaymentMode: "default_payment_mode",
  defaultWalletId: "default_wallet_id",
};
