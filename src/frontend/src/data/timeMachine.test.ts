import { describe, expect, it } from "vitest";
import {
  controllableCategories,
  describeTimeMachine,
  horizonLabel,
  projectScenario,
  savedOverHorizon,
  scenarioProjections,
} from "./timeMachine";

const base = { startingBalanceEur: 5000, monthlyNetEur: 200 };

describe("projectScenario", () => {
  it("adds the monthly net", () => {
    const result = projectScenario({ ...base, months: 12 });
    expect(result.points).toHaveLength(13);
    expect(result.points[0].balanceEur).toBe(5000);
    expect(result.finalBalanceEur).toBe(5000 + 200 * 12);
    expect(result.totalContributedEur).toBe(2400);
  });

  it("drains the balance when spending is above income", () => {
    const result = projectScenario({ startingBalanceEur: 1000, monthlyNetEur: -300, months: 4 });
    expect(result.finalBalanceEur).toBe(-200);
    expect(result.points.map((p) => p.balanceEur)).toEqual([1000, 700, 400, 100, -200]);
  });

  it("adds the extra monthly saving on top of the surplus", () => {
    const plain = projectScenario({ ...base, months: 24 });
    const saving = projectScenario({ ...base, months: 24, monthlyExtraEur: 100 });
    expect(saving.finalBalanceEur - plain.finalBalanceEur).toBe(2400);
  });
});

describe("scenarioProjections", () => {
  it("the save line is the continue line plus the signed change", () => {
    const scenarios = scenarioProjections(base, { months: 60, monthlyChangeEur: 100 });
    expect(scenarios.continue.finalBalanceEur).toBe(5000 + 200 * 60);
    expect(scenarios.save.finalBalanceEur).toBe(5000 + 300 * 60);
    expect(savedOverHorizon(scenarios)).toBe(6000);
  });

  it("spending more makes the save line lower", () => {
    const scenarios = scenarioProjections(base, { months: 60, monthlyChangeEur: -50 });
    expect(savedOverHorizon(scenarios)).toBe(-3000);
  });
});

describe("horizonLabel", () => {
  it("reads naturally in years and months", () => {
    expect(horizonLabel(12)).toBe("1 year");
    expect(horizonLabel(18)).toBe("1 year 6 months");
    expect(horizonLabel(60)).toBe("5 years");
    expect(horizonLabel(3)).toBe("3 months");
  });
});

describe("controllableCategories", () => {
  const categories = [
    { category: "Housing" },
    { category: "Utilities" },
    { category: "Health" },
    { category: "Groceries" },
    { category: "Lifestyle" },
    { category: "Restaurants" },
    { category: "Entertainment" },
  ];

  it("drops fixed costs and necessary care, and ranks by controllability", () => {
    expect(controllableCategories(categories).map((c) => c.category)).toEqual([
      "Restaurants",
      "Entertainment",
      "Lifestyle",
      "Groceries",
    ]);
  });

  it("respects the limit and leaves the input order untouched", () => {
    const before = categories.map((c) => c.category);
    expect(controllableCategories(categories, 2).map((c) => c.category)).toEqual(["Restaurants", "Entertainment"]);
    expect(categories.map((c) => c.category)).toEqual(before);
  });

  it("falls back to the largest spending categories when none are controllable", () => {
    const fixed = [{ category: "Housing" }, { category: "Utilities" }];
    expect(controllableCategories(fixed).map((c) => c.category)).toEqual(["Housing", "Utilities"]);
  });
});

describe("describeTimeMachine", () => {
  const saving = scenarioProjections(base, { months: 60, monthlyChangeEur: 100 });

  it("frames the change as saving and mentions the customer's numbers", () => {
    const text = describeTimeMachine({
      months: 60,
      scenarios: saving,
      monthlyNetEur: 200,
      monthlyChangeEur: 100,
      cutCategory: "Restaurants",
    });
    expect(text.headline).toContain("100");
    expect(text.summary).toContain("5 years");
    expect(text.summary).toContain("more");
    expect(text.recommendation).toContain("restaurants");
  });

  it("explains spending more as a loss, not a saving", () => {
    const spendMore = scenarioProjections(base, { months: 60, monthlyChangeEur: -100 });
    const text = describeTimeMachine({
      months: 60,
      scenarios: spendMore,
      monthlyNetEur: 200,
      monthlyChangeEur: -100,
      cutCategory: "Restaurants",
    });
    expect(text.headline).toMatch(/spend 100 € more/i);
    expect(text.recommendation).toMatch(/drag the bar left/i);
  });

  it("invites the user to drag when spending is unchanged", () => {
    const same = scenarioProjections(base, { months: 12, monthlyChangeEur: 0 });
    const text = describeTimeMachine({
      months: 12,
      scenarios: same,
      monthlyNetEur: 200,
      monthlyChangeEur: 0,
      cutCategory: "Restaurants",
    });
    expect(text.headline).toMatch(/current habits/i);
    expect(text.recommendation).toMatch(/drag the bar/i);
  });

  it("changes tone when spending is above income", () => {
    const negative = scenarioProjections(
      { startingBalanceEur: 1000, monthlyNetEur: -300 },
      { months: 12, monthlyChangeEur: 100 },
    );
    const text = describeTimeMachine({
      months: 12,
      scenarios: negative,
      monthlyNetEur: -300,
      monthlyChangeEur: 100,
      cutCategory: "Restaurants",
    });
    expect(text.headline).toMatch(/above your income/i);
    expect(text.summary).toMatch(/falls/i);
  });
});
