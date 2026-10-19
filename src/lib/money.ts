/**
 * Money is always an integer number of paise in code (₹1 = 100 paise), so
 * adding and subtracting never produces rounding errors. Strings are parsed
 * digit by digit; no floating-point maths is used for amounts.
 */

/** Largest amount the database column numeric(12,2) can hold: ₹99,99,99,99,999.99 */
export const MAX_PAISE = 999_999_999_999;

/**
 * Parses what a person types ("20", "1,25,000", "₹ 1499.5", "0.75") into paise.
 * Returns null when it isn't a valid amount (letters, more than 2 decimals,
 * negative, too large). Zero is allowed here; callers decide if it's valid.
 */
export function parseRupees(input: string): number | null {
  const s = input.replace(/[₹,\s]/g, "");
  const m = /^(\d{0,10})(?:\.(\d{0,2}))?$/.exec(s);
  if (!m) return null;
  const [, whole = "", frac = ""] = m;
  if (whole === "" && frac === "") return null;
  const paise = Number(whole || "0") * 100 + Number((frac + "00").slice(0, 2));
  return paise > MAX_PAISE ? null : paise;
}

/** Groups digits the Indian way: 1234567 -> "12,34,567". */
export function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3);
  return rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3;
}

export type FormatOptions = {
  /** "always": +₹5 / −₹5, "negative": −₹5 only (default), "never": ₹5 */
  sign?: "always" | "negative" | "never";
  /** Show ".00" for whole rupees (default false: ₹20, but ₹20.50) */
  forceDecimals?: boolean;
};

/** Formats paise as rupees: 12500000 -> "₹1,25,000", 149950 -> "₹1,499.50", -6000 -> "−₹60". */
export function formatRupees(paise: number, opts: FormatOptions = {}): string {
  const { sign = "negative", forceDecimals = false } = opts;
  const abs = Math.abs(Math.trunc(paise));
  const whole = groupIndian(String(Math.floor(abs / 100)));
  const frac = abs % 100;
  const body = "₹" + whole + (frac !== 0 || forceDecimals ? "." + String(frac).padStart(2, "0") : "");
  if (sign === "never" || paise === 0) return body;
  if (paise < 0) return "−" + body;
  return sign === "always" ? "+" + body : body;
}

/** Paise -> the decimal string the database expects: 149950 -> "1499.50". */
export function paiseToDecimal(paise: number): string {
  if (!Number.isSafeInteger(paise)) throw new Error("Amount must be a whole number of paise");
  const neg = paise < 0;
  const abs = Math.abs(paise);
  return (neg ? "-" : "") + Math.floor(abs / 100) + "." + String(abs % 100).padStart(2, "0");
}

/** Database decimal (string or number) -> paise: "1499.5" -> 149950. */
export function decimalToPaise(value: string | number): number {
  const s = typeof value === "number" ? value.toFixed(2) : value.trim();
  const m = /^(-)?(\d+)(?:\.(\d{1,2})\d*)?$/.exec(s);
  if (!m) throw new Error(`Not a money amount: ${String(value)}`);
  const [, neg, whole, frac = ""] = m;
  const paise = Number(whole) * 100 + Number((frac + "00").slice(0, 2));
  return neg ? -paise : paise;
}

/** Paise -> what goes back into an amount box when editing: 149950 -> "1499.5", 2000 -> "20". */
export function paiseToInput(paise: number): string {
  const whole = Math.floor(paise / 100);
  const frac = paise % 100;
  if (frac === 0) return String(whole);
  return `${whole}.${String(frac).padStart(2, "0").replace(/0$/, "")}`;
}

/** Keeps only digits and one dot with at most 2 decimals, while typing. */
export function cleanAmountInput(v: string): string {
  let s = v.replace(/[^\d.]/g, "");
  const dot = s.indexOf(".");
  if (dot !== -1) s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, "").slice(0, 2);
  return s.slice(0, 13);
}

/** Splits a total into n shares that add up exactly (the first shares get the extra paise). */
export function splitEvenly(totalPaise: number, n: number): number[] {
  if (!Number.isInteger(n) || n < 1) throw new Error("Need at least one share");
  const base = Math.floor(totalPaise / n);
  const extra = totalPaise - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0));
}

/** Whole-number percentage label for a part of a total: "<1%", "18%". */
export function percentLabel(part: number, total: number): string {
  if (total <= 0) return "0%";
  const pct = (part / total) * 100;
  if (pct > 0 && pct < 1) return "<1%";
  return Math.round(pct) + "%";
}
