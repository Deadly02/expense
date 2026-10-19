import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  dayLabel,
  daysLeftInMonth,
  eachDay,
  formatDMY,
  isValidIsoDate,
  lastMonthRange,
  monthLabel,
  monthRange,
  parseDMY,
  rangeForPreset,
  todayIn,
  weekRange,
  weekdayMon0,
  yearRange,
} from "@/lib/dates";

describe("today in India", () => {
  it("uses IST, not the server's UTC date", () => {
    // 20:00 UTC on 18 Oct = 01:30 IST on 19 Oct
    expect(todayIn("Asia/Kolkata", new Date("2026-10-18T20:00:00Z"))).toBe("2026-10-19");
    expect(todayIn("UTC", new Date("2026-10-18T20:00:00Z"))).toBe("2026-10-18");
    // 18:29 UTC = 23:59 IST, still the same day
    expect(todayIn("Asia/Kolkata", new Date("2026-10-18T18:29:00Z"))).toBe("2026-10-18");
  });
});

describe("DD-MM-YYYY", () => {
  it("formats and parses", () => {
    expect(formatDMY("2026-10-09")).toBe("09-10-2026");
    expect(parseDMY("09-10-2026")).toBe("2026-10-09");
    expect(parseDMY("9/10/2026")).toBe("2026-10-09");
    expect(parseDMY("31-02-2026")).toBeNull();
    expect(parseDMY("2026-10-09")).toBeNull();
  });
  it("validates real dates", () => {
    expect(isValidIsoDate("2028-02-29")).toBe(true);
    expect(isValidIsoDate("2026-02-29")).toBe(false);
    expect(isValidIsoDate("2026-13-01")).toBe(false);
  });
});

describe("weeks run Monday to Sunday", () => {
  it.each([
    ["2026-10-19", { from: "2026-10-19", to: "2026-10-25" }], // Monday
    ["2026-10-25", { from: "2026-10-19", to: "2026-10-25" }], // Sunday
    ["2026-10-22", { from: "2026-10-19", to: "2026-10-25" }], // Thursday
    ["2026-01-01", { from: "2025-12-29", to: "2026-01-04" }], // crosses the year
  ])("week of %s", (d, range) => {
    expect(weekRange(d)).toEqual(range);
  });
  it("weekday index", () => {
    expect(weekdayMon0("2026-10-19")).toBe(0);
    expect(weekdayMon0("2026-10-25")).toBe(6);
  });
});

describe("month and year ranges", () => {
  it("handles month lengths and leap years", () => {
    expect(monthRange("2026-02-10")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(monthRange("2028-02-10")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(monthRange("2026-12-31")).toEqual({ from: "2026-12-01", to: "2026-12-31" });
  });
  it("last month across a year boundary", () => {
    expect(lastMonthRange("2026-01-15")).toEqual({ from: "2025-12-01", to: "2025-12-31" });
    expect(lastMonthRange("2026-03-31")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });
  it("year", () => {
    expect(yearRange("2026-10-19")).toEqual({ from: "2026-01-01", to: "2026-12-31" });
  });
  it("adds months without overflowing short months", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-15");
  });
  it("adds days across month and year ends", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("days left including today", () => {
    expect(daysLeftInMonth("2026-10-19")).toBe(13);
    expect(daysLeftInMonth("2026-10-31")).toBe(1);
    expect(daysLeftInMonth("2026-02-01")).toBe(28);
  });
  it("lists every day", () => {
    expect(eachDay({ from: "2026-10-30", to: "2026-11-02" })).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
  });
});

describe("filter presets", () => {
  const today = "2026-10-19";
  it.each([
    ["today", { from: today, to: today }],
    ["week", { from: "2026-10-19", to: "2026-10-25" }],
    ["month", { from: "2026-10-01", to: "2026-10-31" }],
    ["last-month", { from: "2026-09-01", to: "2026-09-30" }],
    ["year", { from: "2026-01-01", to: "2026-12-31" }],
  ] as const)("%s", (preset, range) => {
    expect(rangeForPreset(preset, today)).toEqual(range);
  });
  it("custom ranges are put in order and fall back when invalid", () => {
    expect(rangeForPreset("custom", today, { from: "2026-10-10", to: "2026-10-01" })).toEqual({ from: "2026-10-01", to: "2026-10-10" });
    expect(rangeForPreset("custom", today, { from: "nope" })).toEqual({ from: "2026-10-01", to: today });
  });
});

describe("labels", () => {
  it("day labels", () => {
    expect(dayLabel("2026-10-19", "2026-10-19")).toBe("Today");
    expect(dayLabel("2026-10-18", "2026-10-19")).toBe("Yesterday");
    expect(dayLabel("2026-10-17", "2026-10-19")).toBe("Sat, 17-10-2026");
  });
  it("month label", () => {
    expect(monthLabel("2026-10-19")).toBe("Oct 2026");
  });
});
