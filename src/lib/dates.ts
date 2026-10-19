/**
 * Dates are handled as "YYYY-MM-DD" strings (the database's date format) in the
 * app's time zone (India by default), so a server running in UTC still knows
 * what "today" is for you. Shown to people as DD-MM-YYYY. Weeks run Mon–Sun.
 */

export const DEFAULT_TIME_ZONE = "Asia/Kolkata";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export type DateRange = { from: string; to: string };

/** True for a real calendar date like "2026-02-28" (not "2026-02-30"). */
export function isValidIsoDate(s: string): boolean {
  const m = ISO.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

function parts(iso: string): [number, number, number] {
  const m = ISO.exec(iso);
  if (!m) throw new Error(`Not a date: ${iso}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function toUtc(iso: string): Date {
  const [y, m, d] = parts(iso);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtc(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** Today's date in the given time zone, e.g. "2026-10-19". */
export function todayIn(timeZone: string = DEFAULT_TIME_ZONE, now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDays(iso: string, n: number): string {
  const d = toUtc(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return fromUtc(d);
}

/** Moves by whole months, keeping the day where possible (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(iso: string, n: number): string {
  const [y, m, d] = parts(iso);
  const first = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(d, last));
  return fromUtc(first);
}

/** Whole days from a to b (b − a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((toUtc(b).getTime() - toUtc(a).getTime()) / 86_400_000);
}

/** 0 = Monday … 6 = Sunday */
export function weekdayMon0(iso: string): number {
  return (toUtc(iso).getUTCDay() + 6) % 7;
}

export function monthRange(iso: string): DateRange {
  const [y, m] = parts(iso);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, "0");
  return { from: `${y}-${mm}-01`, to: `${y}-${mm}-${String(last).padStart(2, "0")}` };
}

/** Monday to Sunday of the week containing the date. */
export function weekRange(iso: string): DateRange {
  const from = addDays(iso, -weekdayMon0(iso));
  return { from, to: addDays(from, 6) };
}

export function yearRange(iso: string): DateRange {
  const [y] = parts(iso);
  return { from: `${y}-01-01`, to: `${y}-12-31` };
}

export function lastMonthRange(iso: string): DateRange {
  return monthRange(addMonths(monthRange(iso).from, -1));
}

export type RangePreset = "today" | "week" | "month" | "last-month" | "year" | "custom";

/** The date range for a filter preset; custom ranges are checked and put in order. */
export function rangeForPreset(preset: RangePreset, today: string, custom?: Partial<DateRange>): DateRange {
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "week":
      return weekRange(today);
    case "month":
      return monthRange(today);
    case "last-month":
      return lastMonthRange(today);
    case "year":
      return yearRange(today);
    case "custom": {
      const from = custom?.from && isValidIsoDate(custom.from) ? custom.from : monthRange(today).from;
      const to = custom?.to && isValidIsoDate(custom.to) ? custom.to : today;
      return from <= to ? { from, to } : { from: to, to: from };
    }
  }
}

/** Days left in the month including today (31 Oct -> 1). */
export function daysLeftInMonth(today: string): number {
  return daysBetween(today, monthRange(today).to) + 1;
}

/** Every date from `from` to `to`, inclusive. */
export function eachDay(range: DateRange): string[] {
  const out: string[] = [];
  for (let d = range.from; d <= range.to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** "2026-10-19" -> "19-10-2026" */
export function formatDMY(iso: string): string {
  const [y, m, d] = parts(iso);
  return `${String(d).padStart(2, "0")}-${String(m).padStart(2, "0")}-${y}`;
}

/** "19-10-2026" (or 19/10/2026, 19.10.2026) -> "2026-10-19", or null if not a real date. */
export function parseDMY(s: string): string | null {
  const m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s.trim());
  if (!m) return null;
  const iso = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return isValidIsoDate(iso) ? iso : null;
}

/** "Today", "Yesterday", or "Sat, 17-10-2026" */
export function dayLabel(iso: string, today: string): string {
  if (iso === today) return "Today";
  if (iso === addDays(today, -1)) return "Yesterday";
  return `${DAYS[toUtc(iso).getUTCDay()]}, ${formatDMY(iso)}`;
}

/** "Oct 2026" */
export function monthLabel(iso: string): string {
  const [y, m] = parts(iso);
  return `${MONTHS[m - 1]} ${y}`;
}

/** "2026-10" for the month containing the date. */
export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

/** "2026-10" -> "2026-10-01", or null if not a valid month. */
export function monthStartFromKey(key: string): string | null {
  const iso = `${key}-01`;
  return /^\d{4}-\d{2}$/.test(key) && isValidIsoDate(iso) ? iso : null;
}

export const WEEKDAY_NAMES_MON0 = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
