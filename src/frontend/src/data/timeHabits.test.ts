import { describe, expect, it } from "vitest";
import type { Purchase } from "./database";
import { describeHabit, detectTimeHabits, median } from "./timeHabits";

// Builds one customer's purchases. Dates: 2026-09-01 is a Tuesday, 2026-09-05 a Saturday.
let n = 0;
function purchase(amountEur: number, hour: number, day = 1 + (n % 4)): Purchase {
  const date = `2026-09-${String(day).padStart(2, "0")}`;
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  n++;
  return {
    timestampIso: `${date}T${String(hour).padStart(2, "0")}:00:${String(n % 60).padStart(2, "0")}`,
    date,
    hour,
    weekday,
    amountEur,
    category: "Lifestyle",
  };
}
const everyday = (count: number) => Array.from({ length: count }, (_, i) => purchase(20 + (i % 5), 10 + (i % 8)));

describe("median", () => {
  it("handles odd, even and empty input", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBe(0);
  });
});

describe("detectTimeHabits", () => {
  it("flags big purchases clustered late in the evening, with the customer's own numbers", () => {
    const history = [...everyday(40), purchase(250, 22), purchase(310, 23), purchase(180, 21), purchase(400, 22), purchase(220, 22), purchase(260, 12)];
    const [finding] = detectTimeHabits(history);
    expect(finding.window).toBe("night");
    expect(finding.bigCount).toBe(6);
    expect(finding.bigInWindowCount).toBe(5);
    expect(finding.bigInWindowTotalEur).toBe(250 + 310 + 180 + 400 + 220);
    expect(finding.bigThresholdEur).toBe(100); // 3 × median (~22 €) is below the 100 € floor
    expect(finding.examples.map((p) => p.amountEur)).toEqual([400, 310, 250]);
  });

  it("flags nothing when big purchases are spread over the day", () => {
    const history = [...everyday(40), ...[11, 14, 16, 12, 18, 22].map((h) => purchase(250, h))];
    expect(detectTimeHabits(history)).toEqual([]);
  });

  it("does not flag a customer whose purchases are mostly late anyway (relative to their own habits)", () => {
    // Everything this customer does happens at night, so big purchases at night are not unusual for them.
    const history = [
      ...Array.from({ length: 40 }, (_, i) => purchase(20 + (i % 5), 21 + (i % 3))),
      ...[21, 22, 23, 22, 21].map((h) => purchase(250, h)),
      purchase(250, 12),
    ];
    expect(detectTimeHabits(history)).toEqual([]);
  });

  it("needs enough history and enough big purchases", () => {
    expect(detectTimeHabits([...everyday(10), purchase(300, 22), purchase(300, 22), purchase(300, 22), purchase(300, 22), purchase(300, 22)])).toEqual([]); // < 30 purchases
    expect(detectTimeHabits([...everyday(40), purchase(300, 22), purchase(300, 22), purchase(300, 22)])).toEqual([]); // < 5 big
  });

  it("does not treat one or two late purchases as a habit", () => {
    const history = [...everyday(40), purchase(300, 22), purchase(300, 23), ...[11, 12, 13, 14].map((h) => purchase(300, h))];
    expect(detectTimeHabits(history)).toEqual([]);
  });

  it("flags weekend clusters too", () => {
    const history = [
      ...everyday(40),
      ...[1, 2, 3, 4].map((d) => purchase(30, 12, d)),
      ...[5, 6, 12, 13, 19].map((d) => purchase(260, 14, d)), // Saturdays and Sundays
      purchase(260, 14, 2), // one big weekday purchase
    ];
    const findings = detectTimeHabits(history);
    expect(findings.map((f) => f.window)).toEqual(["weekend"]);
    expect(findings[0].bigInWindowCount).toBe(5);
  });

  it("depends only on the given customer's purchases: same input, same output, whatever else was analysed", () => {
    const mine = [...everyday(40), purchase(250, 22), purchase(310, 23), purchase(180, 21), purchase(400, 22), purchase(220, 22), purchase(260, 12)];
    const someoneElse = [...everyday(40), purchase(900, 12), purchase(950, 13), purchase(990, 14), purchase(800, 15), purchase(870, 16)];
    const first = detectTimeHabits(mine);
    detectTimeHabits(someoneElse);
    expect(detectTimeHabits([...mine])).toEqual(first);
    expect(detectTimeHabits([...mine].reverse())).toEqual(first);
  });
});

describe("describeHabit", () => {
  it("uses the customer's numbers and states the cause only as a possibility", () => {
    const history = [...everyday(40), purchase(250, 22), purchase(310, 23), purchase(180, 21), purchase(400, 22), purchase(220, 22), purchase(260, 12)];
    const text = describeHabit(detectTimeHabits(history)[0]);
    expect(text.detail).toContain("5 of your 6 big purchases");
    expect(text.detail).toContain("after 21:00");
    expect(text.detail).toMatch(/may be tired|can make/);
    expect(text.detail).not.toMatch(/because you are tired|you are tired/i);
    expect(text.tip.length).toBeGreaterThan(10);
  });
});
