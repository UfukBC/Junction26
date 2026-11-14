/* Time machine: project a customer's balance forward from their own recent habits.
 *
 * Pure functions only — no database, no other customers. The screen feeds in the customer's own averages
 * (see `loadTimeMachineBaseline` in timeMachineData.ts) and compares two lines: keep spending as now, or put
 * some of it aside each month instead.
 *
 * The model is deliberately simple and explainable: each month the balance changes by income minus spending,
 * plus the signed monthly change from the chosen category. Money left in the account earns nothing here.
 */

import { formatEurWhole } from "../format";

export const DEFAULT_HORIZON_MONTHS = 60; // 5 years
export const MIN_HORIZON_MONTHS = 1;
export const MAX_HORIZON_MONTHS = 240; // 20 years

export interface ScenarioInput {
  /** Balance today. */
  startingBalanceEur: number;
  /** Income minus spending in an average month; may be negative. */
  monthlyNetEur: number;
  months: number;
  /** Extra saved each month by spending less (negative when spending more). */
  monthlyExtraEur?: number;
}

export interface ProjectionPoint {
  month: number;
  balanceEur: number;
  /** Money added from the surplus up to this month. */
  contributedEur: number;
}

export interface Projection {
  /** Month 0 (today) through `months`. */
  points: ProjectionPoint[];
  finalBalanceEur: number;
  totalContributedEur: number;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Project one scenario month by month. */
export function projectScenario(input: ScenarioInput): Projection {
  const months = Math.max(0, Math.floor(input.months));
  const monthlyNet = input.monthlyNetEur + (input.monthlyExtraEur ?? 0);

  let balance = input.startingBalanceEur;
  let contributed = 0;
  const points: ProjectionPoint[] = [{ month: 0, balanceEur: round2(balance), contributedEur: 0 }];

  for (let month = 1; month <= months; month++) {
    balance += monthlyNet;
    contributed += monthlyNet;
    points.push({ month, balanceEur: round2(balance), contributedEur: round2(contributed) });
  }

  return {
    points,
    finalBalanceEur: round2(balance),
    totalContributedEur: round2(contributed),
  };
}

export type ScenarioId = "continue" | "save";

export interface ScenarioSet {
  /** Keep spending as now. */
  continue: Projection;
  /** Put the category's signed difference aside each month. */
  save: Projection;
}

export interface ScenarioOptions {
  months: number;
  /** Positive = spend less and save the difference; negative = spend more. */
  monthlyChangeEur: number;
}

/** The two scenarios compared on screen. `continue` is the reference line. */
export function scenarioProjections(
  base: { startingBalanceEur: number; monthlyNetEur: number },
  options: ScenarioOptions,
): ScenarioSet {
  const common = {
    startingBalanceEur: base.startingBalanceEur,
    monthlyNetEur: base.monthlyNetEur,
    months: options.months,
  };
  return {
    continue: projectScenario(common),
    save: projectScenario({ ...common, monthlyExtraEur: options.monthlyChangeEur }),
  };
}

/** Extra balance at the end of the horizon from saving (negative when spending more). */
export function savedOverHorizon(scenarios: ScenarioSet): number {
  return round2(scenarios.save.finalBalanceEur - scenarios.continue.finalBalanceEur);
}

export const SCENARIO_LABELS: Record<ScenarioId, string> = {
  continue: "Continue as now",
  save: "Save more",
};

/**
 * Categories a person can realistically change month to month, most controllable first. Fixed costs (Housing,
 * Utilities) and necessary care (Health) are deliberately left out, so the control never suggests cutting rent.
 */
export const CONTROLLABLE_CATEGORIES = [
  "Restaurants",
  "Entertainment",
  "Lifestyle",
  "Travel",
  "Home & Tech",
  "Groceries",
  "Transportation",
] as const;

/** The customer's own categories that are worth trimming, most controllable first (falls back to top spending). */
export function controllableCategories<T extends { category: string }>(categories: T[], limit = 4): T[] {
  const rank = new Map<string, number>(CONTROLLABLE_CATEGORIES.map((name, index) => [name, index]));
  const controllable = categories
    .filter((entry) => rank.has(entry.category))
    .sort((a, b) => rank.get(a.category)! - rank.get(b.category)!);
  return (controllable.length > 0 ? controllable : categories).slice(0, limit);
}

/** "5 years", "1 year 6 months", "3 months" */
export function horizonLabel(months: number): string {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const yearPart = years > 0 ? `${years} ${years === 1 ? "year" : "years"}` : "";
  const monthPart = rest > 0 ? `${rest} ${rest === 1 ? "month" : "months"}` : "";
  return [yearPart, monthPart].filter(Boolean).join(" ") || "0 months";
}

export interface TimeMachineNarrative {
  headline: string;
  summary: string;
  recommendation: string;
}

/** Plain-language explanation of saving more or less, using only the customer's own numbers. Rule-based.
 *  `monthlyChangeEur` is signed: positive = spending less (saving), negative = spending more. */
export function describeTimeMachine(params: {
  months: number;
  scenarios: ScenarioSet;
  monthlyNetEur: number;
  monthlyChangeEur: number;
  cutCategory: string;
}): TimeMachineNarrative {
  const { months, scenarios, monthlyNetEur, monthlyChangeEur, cutCategory } = params;
  const period = horizonLabel(months);
  const category = cutCategory.toLowerCase();
  const continueFinal = scenarios.continue.finalBalanceEur;
  const saveFinal = scenarios.save.finalBalanceEur;
  const saved = savedOverHorizon(scenarios);

  if (monthlyNetEur <= 0) {
    const gap = Math.abs(monthlyNetEur);
    const advice =
      monthlyChangeEur > 0.5
        ? `Saving ${formatEurWhole(monthlyChangeEur)} on ${category} narrows the gap by that much every month — ${formatEurWhole(saved)} over ${period}.`
        : `Bring one everyday category under control: even a small monthly saving changes the direction of the line.`;
    return {
      headline: `Your spending is ${formatEurWhole(gap)} above your income`,
      summary: `If this continues, your balance falls by about ${formatEurWhole(gap)} every month.`,
      recommendation: advice,
    };
  }

  if (monthlyChangeEur > 0.5) {
    return {
      headline: `Save ${formatEurWhole(monthlyChangeEur)} more each month`,
      summary: `On today's habits your balance reaches ${formatEurWhole(continueFinal)} in ${period}. Putting ${formatEurWhole(monthlyChangeEur)} aside instead of spending it on ${category} brings that to ${formatEurWhole(saveFinal)} — ${formatEurWhole(saved)} more.`,
      recommendation: `The extra adds up to ${formatEurWhole(saved)} over ${period}. Start with ${category}, the change that is easiest for you to control.`,
    };
  }

  if (monthlyChangeEur < -0.5) {
    return {
      headline: `Spend ${formatEurWhole(-monthlyChangeEur)} more each month`,
      summary: `On today's habits your balance reaches ${formatEurWhole(continueFinal)} in ${period}. Spending ${formatEurWhole(-monthlyChangeEur)} more on ${category} would leave ${formatEurWhole(Math.abs(saved))} less.`,
      recommendation: `Drag the bar left to see what saving that amount instead would do.`,
    };
  }

  return {
    headline: `Your current habits, projected`,
    summary: `Keeping today's spending, your balance reaches ${formatEurWhole(continueFinal)} in ${period}.`,
    recommendation: `Drag the bar below to see what spending less on ${category} would save over ${period}.`,
  };
}
