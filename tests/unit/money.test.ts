import { describe, expect, it } from "vitest";
import {
  MAX_PAISE,
  cleanAmountInput,
  decimalToPaise,
  formatRupees,
  groupIndian,
  paiseToDecimal,
  paiseToInput,
  parseRupees,
  percentLabel,
  splitEvenly,
} from "@/lib/money";
import { safeToSpend, totals } from "@/lib/summary";

describe("parseRupees", () => {
  it.each([
    ["20", 2000],
    ["0.75", 75],
    [".5", 50],
    ["1499.5", 149950],
    ["1,25,000", 12500000],
    ["₹ 1,499.50", 149950],
    ["0", 0],
    ["9999999999.99", MAX_PAISE],
  ])("%s -> %d paise", (input, paise) => {
    expect(parseRupees(input)).toBe(paise);
  });

  it.each(["", "abc", "1.234", "-5", "1.2.3", "12345678901", "."])("rejects %j", (input) => {
    expect(parseRupees(input)).toBeNull();
  });

  it("never uses floating point: 0.1 + 0.2 style amounts add exactly", () => {
    const a = parseRupees("0.10")!;
    const b = parseRupees("0.20")!;
    expect(a + b).toBe(30);
    expect(formatRupees(a + b)).toBe("₹0.30");
  });
});

describe("formatRupees (Indian format)", () => {
  it.each([
    [0, "₹0"],
    [2000, "₹20"],
    [149950, "₹1,499.50"],
    [12500000, "₹1,25,000"],
    [1234567800, "₹1,23,45,678"],
    [5, "₹0.05"],
    [-6000, "−₹60"],
  ])("%d -> %s", (paise, text) => {
    expect(formatRupees(paise)).toBe(text);
  });

  it("signs", () => {
    expect(formatRupees(2000, { sign: "always" })).toBe("+₹20");
    expect(formatRupees(-2000, { sign: "always" })).toBe("−₹20");
    expect(formatRupees(-2000, { sign: "never" })).toBe("₹20");
    expect(formatRupees(2000, { forceDecimals: true })).toBe("₹20.00");
  });

  it("groups digits the Indian way", () => {
    expect(groupIndian("1")).toBe("1");
    expect(groupIndian("1000")).toBe("1,000");
    expect(groupIndian("100000")).toBe("1,00,000");
    expect(groupIndian("10000000")).toBe("1,00,00,000");
  });
});

describe("database round trip", () => {
  it.each([0, 5, 99, 100, 149950, 12500000, MAX_PAISE])("%d paise survives paise -> decimal -> paise", (paise) => {
    expect(decimalToPaise(paiseToDecimal(paise))).toBe(paise);
  });

  it("reads numeric strings exactly", () => {
    expect(decimalToPaise("1499.5")).toBe(149950);
    expect(decimalToPaise("1499.50")).toBe(149950);
    expect(decimalToPaise("20")).toBe(2000);
    expect(decimalToPaise(1499.5)).toBe(149950);
    expect(paiseToDecimal(149950)).toBe("1499.50");
    expect(() => paiseToDecimal(1.5)).toThrow();
  });

  it("formats amounts back into the amount box", () => {
    expect(paiseToInput(2000)).toBe("20");
    expect(paiseToInput(149950)).toBe("1499.5");
    expect(paiseToInput(149905)).toBe("1499.05");
  });
});

describe("typing helpers", () => {
  it("cleans the amount box while typing", () => {
    expect(cleanAmountInput("12a,5.5.75")).toBe("125.57");
    expect(cleanAmountInput("₹1,000")).toBe("1000");
  });
  it("splits evenly to the paisa", () => {
    expect(splitEvenly(1000, 3)).toEqual([334, 333, 333]);
    expect(splitEvenly(1000, 3).reduce((a, b) => a + b)).toBe(1000);
  });
  it("percent labels", () => {
    expect(percentLabel(45, 22064)).toBe("<1%");
    expect(percentLabel(18000, 22064)).toBe("82%");
    expect(percentLabel(0, 0)).toBe("0%");
  });
});

describe("totals and safe-to-spend", () => {
  const entries = [
    { type: "expense" as const, amountPaise: 12050 },
    { type: "expense" as const, amountPaise: 6000 },
    { type: "income" as const, amountPaise: 12500000 },
  ];
  it("adds in paise", () => {
    expect(totals(entries)).toEqual({ inPaise: 12500000, outPaise: 18050, balancePaise: 12481950, count: 3 });
  });
  it("uses the budget when set", () => {
    // 19 Oct -> 13 days left including today. (30000 − 4000) / 13 = 2000
    expect(safeToSpend({ today: "2026-10-19", monthOutPaise: 400000, monthInPaise: 0, budgetPaise: 3000000 })).toEqual({
      kind: "budget",
      perDayPaise: 200000,
      leftPaise: 2600000,
      daysLeft: 13,
      overPaise: 0,
    });
  });
  it("falls back to income, and never goes negative", () => {
    const s = safeToSpend({ today: "2026-10-31", monthOutPaise: 500, monthInPaise: 400, budgetPaise: null });
    expect(s).toEqual({ kind: "balance", perDayPaise: 0, leftPaise: 0, daysLeft: 1, overPaise: 100 });
  });
  it("needs a budget or income", () => {
    expect(safeToSpend({ today: "2026-10-19", monthOutPaise: 500, monthInPaise: 0, budgetPaise: null })).toEqual({ kind: "none" });
  });
});
