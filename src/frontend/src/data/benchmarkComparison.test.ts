import { describe, expect, it } from "vitest";
import { getCategoryBenchmark } from "./benchmarks";
import {
  CATEGORY_TO_COICOP,
  bandIncomeEur,
  benchmarkMonthEur,
  buildPeerBaseline,
  compareCategory,
  getClosestQuintile,
  peerFacts,
  peerNoteFor,
} from "./benchmarkComparison";
import type { CategorySpend, MonthlyFlow } from "./database";

const flow = (month: string, incomeEur: number): MonthlyFlow => ({ month, incomeEur, spendingEur: 0, netEur: incomeEur });
const spend = (category: string, totalEur: number): CategorySpend => ({ category, totalEur, count: 1, share: 0 });
const year = (monthlyIncome: number) =>
  Array.from({ length: 12 }, (_, i) => flow(`2025-${String(i + 1).padStart(2, "0")}`, monthlyIncome));

describe("CATEGORY_TO_COICOP", () => {
  const codes = Object.values(CATEGORY_TO_COICOP).flat();

  it("only uses codes that exist in benchmarks.json", () => {
    for (const code of codes) expect(getCategoryBenchmark(code), code).toBeDefined();
  });

  it("never counts a code twice, directly or through a parent code", () => {
    expect(new Set(codes).size).toBe(codes.length);
    for (const a of codes) for (const b of codes) if (a !== b) expect(b.startsWith(a), `${a} contains ${b}`).toBe(false);
  });

  it("maps only the eight purchase categories", () => {
    expect(Object.keys(CATEGORY_TO_COICOP).sort()).toEqual(
      ["Entertainment", "Groceries", "Health", "Home & Tech", "Lifestyle", "Restaurants", "Transportation", "Travel"],
    );
  });
});

describe("getClosestQuintile (per consumption unit)", () => {
  it("uses income per consumption unit, not per household", () => {
    expect(Math.round(bandIncomeEur(getClosestQuintile(31154)))).toBe(31154); // Q3: 44 550 / 1.43
  });

  it("puts the median customer (3 210 €/month) in Q4, not Q2", () => {
    expect(getClosestQuintile(3210 * 12).id).toBe("q4");
  });

  it("covers both ends", () => {
    expect(getClosestQuintile(15000).id).toBe("q1");
    expect(getClosestQuintile(90000).id).toBe("q5");
  });
});

describe("benchmarkMonthEur / compareCategory", () => {
  it("sums all mapped codes", () => {
    expect(benchmarkMonthEur("Transportation", "all")).toBe(147 + 32); // 072 + 073, no car purchases
    expect(benchmarkMonthEur("Travel", "all")).toBe(18 + 11); // 098 + 112
  });

  it("compares in euros", () => {
    expect(compareCategory("Groceries", 400, "q3")).toEqual({
      category: "Groceries",
      quintileId: "q3",
      userMonthlyEur: 400,
      benchmarkMonthEur: 335,
      diffEur: 65,
    });
  });

  it("does not compare unmapped or fixed-bill categories", () => {
    expect(compareCategory("Housing", 900, "q3")).toBeNull();
    expect(compareCategory("Utilities", 120, "q3")).toBeNull();
  });
});

describe("buildPeerBaseline", () => {
  it("returns null without data", () => {
    expect(buildPeerBaseline([], [])).toBeNull();
  });

  it("keeps the band steady when one month has no salary", () => {
    const steady = buildPeerBaseline(year(3210), []);
    const gap = year(3210);
    gap[5] = flow(gap[5].month, 0);
    gap[6] = flow(gap[6].month, 6420); // salary landed in the next month
    expect(buildPeerBaseline(gap, [])!.quintile.id).toBe(steady!.quintile.id);
  });

  it("averages categories over the window", () => {
    const baseline = buildPeerBaseline(year(3210), [spend("Groceries", 4800)])!;
    expect(baseline.monthsUsed).toBe(12);
    expect(baseline.categoryAvgEur.Groceries).toBe(400);
  });
});

describe("wording", () => {
  const baseline = buildPeerBaseline(year(3210), [spend("Groceries", 4800), spend("Travel", 1200)])!;

  it("never says 'income' (useAdvice rejects Everyday text that does)", () => {
    const text = [peerNoteFor(baseline, "Groceries"), ...peerFacts(baseline, ["Groceries", "Travel"])].join(" ");
    expect(text).not.toMatch(/income/i);
    expect(text).toContain("Q4");
  });

  it("skips categories without a benchmark and respects the limit", () => {
    expect(peerFacts(baseline, ["Housing", "Groceries", "Travel"], 1)).toHaveLength(1);
    expect(peerNoteFor(null, "Groceries")).toBe("");
    expect(peerNoteFor(baseline, "Housing")).toBe("");
  });
});
