import { describe, expect, it } from "vitest";
import { compareShare, incomeQuintile } from "./categoryBenchmarks";
import type { MonthStory } from "./database";
import { benchmarkFor, categoryTrend, monthTrend } from "./useAdvice";

function story(
  month: string,
  fixedEur: number,
  everydayEur: number,
  categories: MonthStory["slices"][number]["categories"] = [],
): MonthStory {
  return {
    month,
    asOf: `${month}-28`,
    balanceEur: 0,
    incomeEur: 0,
    incomeDetail: "Salary",
    calm: true,
    slices: [
      { name: "Fixed", detail: "", valueEur: fixedEur },
      { name: "Everyday", detail: "", valueEur: everydayEur, categories },
      { name: "Left", detail: "", valueEur: 0 },
    ],
  };
}

describe("incomeQuintile", () => {
  it("picks the closest public band for the demo income", () => {
    expect(incomeQuintile(36416)).toBe("q4");
    expect(incomeQuintile(16000)).toBe("q1");
    expect(incomeQuintile(0)).toBe("all");
  });
});

describe("monthTrend", () => {
  it("compares this month with the previous months' average", () => {
    const flows = [
      { month: "2026-07", incomeEur: 0, spendingEur: 1000, netEur: 0 },
      { month: "2026-08", incomeEur: 0, spendingEur: 2000, netEur: 0 },
      { month: "2026-09", incomeEur: 0, spendingEur: 1500, netEur: 0 },
    ];
    const trend = monthTrend(story("2026-09", 1000, 500), flows);
    expect(trend.monthsCompared).toBe(2);
    expect(trend.averageEur).toBe(1500);
    expect(trend.differenceEur).toBe(0);
    expect(trend.text).toContain("in line");
  });

  it("says above or below with the percentage", () => {
    const flows = [
      { month: "2026-07", incomeEur: 0, spendingEur: 1000, netEur: 0 },
      { month: "2026-08", incomeEur: 0, spendingEur: 1000, netEur: 0 },
    ];
    const higher = monthTrend(story("2026-09", 1000, 300), flows);
    expect(Math.round(higher.differencePct! * 100)).toBe(30);
    expect(higher.text).toContain("above");
  });

  it("has no text without history", () => {
    const trend = monthTrend(story("2026-09", 1000, 500), []);
    expect(trend.text).toBeNull();
  });
});

describe("categoryTrend", () => {
  it("compares the category with its own previous months", () => {
    const trend = categoryTrend(story("2026-09", 0, 0), "Transportation", [
      { month: "2026-07", totalEur: 100, count: 2 },
      { month: "2026-08", totalEur: 200, count: 3 },
      { month: "2026-09", totalEur: 150, count: 2 },
    ]);
    expect(trend.averageEur).toBe(150);
    expect(trend.text).toContain("Transportation");
    expect(trend.text).toContain("in line");
  });
});

describe("compareShare", () => {
  it("says 'people with a similar income' without naming the quintile or a year", () => {
    const comparison = compareShare("Restaurants", 280, 1000, "q4");
    expect(comparison).not.toBeNull();
    expect(comparison!.ratio).toBeGreaterThan(1);
    expect(comparison!.note.toLowerCase()).toContain("people with a similar income");
    expect(comparison!.note).not.toMatch(/Q[1-5]|2022|—/);
  });

  it("does not repeat the same percentage twice", () => {
    const comparison = compareShare("Health", 60, 1000, "q4");
    expect(comparison).not.toBeNull();
    expect(comparison!.note).toContain("about the same");
    expect(comparison!.note.match(/6 %/g)?.length).toBe(1);
  });
});

describe("benchmarkFor", () => {
  it("uses the trailing-12-month totals, not the sparse month", () => {
    const month = story("2026-09", 0, 0, [{ name: "Restaurants", count: 1, valueEur: 90 }]);
    const comparison = benchmarkFor(
      month,
      "Restaurants",
      { quintile: "q4", annualIncomeEur: 36000 },
      [
        { category: "Restaurants", totalEur: 350, count: 40, share: 0.35 },
        { category: "Groceries", totalEur: 650, count: 60, share: 0.65 },
        // Not card spending and not in the benchmark basket: must not dilute the share.
        { category: "Housing", totalEur: 14400, count: 12, share: 0 },
        { category: "Utilities", totalEur: 1800, count: 36, share: 0 },
      ],
    );
    expect(comparison!.userSharePct).toBeCloseTo(35, 5);
  });
});
