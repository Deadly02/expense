import { describe, expect, it } from "vitest";
import { buildSuggestions, matchSuggestions, recentTags } from "@/lib/suggestions";
import { groupByDay, sortEntries } from "@/lib/summary";
import { entryInputSchema, parseTagText } from "@/lib/validation";

const base = { categoryId: "c1", paymentMode: "Cash" as const, walletId: "w1", tags: [] as string[] };

describe("grouping by day", () => {
  it("groups with day totals, newest first", () => {
    const sorted = sortEntries([
      { id: "a", type: "expense" as const, amountPaise: 6000, date: "2026-10-18", createdAt: "2026-10-18T10:00:00Z" },
      { id: "b", type: "income" as const, amountPaise: 12500000, date: "2026-10-18", createdAt: "2026-10-18T11:00:00Z" },
      { id: "c", type: "expense" as const, amountPaise: 12050, date: "2026-10-19", createdAt: "2026-10-19T09:00:00Z" },
    ]);
    expect(sorted.map((e) => e.id)).toEqual(["c", "b", "a"]);
    const groups = groupByDay(sorted);
    expect(groups.map((g) => [g.date, g.outPaise, g.inPaise])).toEqual([
      ["2026-10-19", 12050, 0],
      ["2026-10-18", 6000, 12500000],
    ]);
  });
});

describe("note suggestions", () => {
  const recent = [
    { ...base, note: "Tea", type: "expense" as const, amountPaise: 2000, createdAt: "3", tags: ["office"] },
    { ...base, note: "tea ", type: "expense" as const, amountPaise: 1500, createdAt: "2", tags: [] },
    { ...base, note: "Auto to station", type: "expense" as const, amountPaise: 6000, createdAt: "1", categoryId: "travel", tags: ["trip-goa"] },
    { ...base, note: "Masala tea", type: "expense" as const, amountPaise: 3000, createdAt: "0", tags: [] },
    { ...base, note: "Salary", type: "income" as const, amountPaise: 12500000, createdAt: "0", tags: [] },
  ];
  const all = buildSuggestions(recent);

  it("one per note, with the most recent amount, most used first", () => {
    expect(all[0]).toMatchObject({ note: "Tea", amountPaise: 2000, uses: 2 });
    expect(all.filter((s) => s.note.toLowerCase() === "tea")).toHaveLength(1);
  });
  it("matches start of note first, then words, and only the same type", () => {
    expect(matchSuggestions(all, "te", "expense").map((s) => s.note)).toEqual(["Tea", "Masala tea"]);
    expect(matchSuggestions(all, "sta", "expense").map((s) => s.note)).toEqual(["Auto to station"]);
    expect(matchSuggestions(all, "salar", "expense")).toEqual([]); // Salary is income only
    expect(matchSuggestions(all, "", "expense")).toEqual([]);
    expect(matchSuggestions(all, "tea", "expense").map((s) => s.note)).toEqual(["Masala tea"]); // exact match hidden
  });
  it("recent tags", () => {
    expect(recentTags(recent)).toEqual(["office", "trip-goa"]);
  });
});

describe("server-side validation", () => {
  const ok = {
    type: "expense",
    amountPaise: 2000,
    categoryId: "6f9619ff-8b86-4011-b42d-00c04fc964ff",
    note: "  Tea  ",
    date: "2026-10-19",
    paymentMode: "UPI",
    walletId: "7f9619ff-8b86-4011-b42d-00c04fc964ff",
    tags: ["#Trip-Goa", "office", "trip-goa"],
  };
  it("accepts a valid entry and normalises note and tags", () => {
    const r = entryInputSchema.parse(ok);
    expect(r.note).toBe("Tea");
    expect(r.tags).toEqual(["trip-goa", "office"]);
  });
  it.each([
    [{ note: "" }, "note"],
    [{ note: "x".repeat(81) }, "note"],
    [{ amountPaise: 0 }, "amountPaise"],
    [{ amountPaise: 12.5 }, "amountPaise"],
    [{ date: "2026-02-30" }, "date"],
    [{ paymentMode: "Cheque" }, "paymentMode"],
    [{ categoryId: "not-a-uuid" }, "categoryId"],
    [{ type: "transfer" }, "type"],
    [{ tags: ["bad tag!"] }, "tags.0"],
  ])("rejects %j", (patch, path) => {
    const r = entryInputSchema.safeParse({ ...ok, ...patch });
    expect(r.success).toBe(false);
    expect(r.error!.issues[0].path.join(".")).toBe(path);
  });
  it("parses typed tags", () => {
    expect(parseTagText("#trip-goa, office  #Trip-Goa")).toEqual({ tags: ["trip-goa", "office"], invalid: [] });
    expect(parseTagText("#ok #no!").invalid).toEqual(["#no!"]);
  });
});
