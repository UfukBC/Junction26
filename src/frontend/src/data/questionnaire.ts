/* Financial-goal questionnaire: answers type, option labels, localStorage storage.
 *
 * Answers are personal, so they never leave the device: they live in
 * localStorage, keyed by customer id. T-014 reads them with loadAnswers().
 */

export type FinancialGoal =
  | "emergency_buffer"
  | "home"
  | "travel"
  | "debt"
  | "understand_spending"
  | "invest";

export type IncomePredictability =
  | "very_predictable"
  | "mostly_predictable"
  | "varies"
  | "no_regular_income";

export interface QuestionnaireAnswers {
  goal: FinancialGoal;
  /** Target to save (or pay off) in euros. Null when the goal has no amount. */
  targetAmountEur: number | null;
  /** Target month as "YYYY-MM". Null when the goal has no date. */
  targetDate: string | null;
  incomePredictability: IncomePredictability;
  /** Category names from the demo DB the user wants to control. Empty for "not sure yet". */
  controlCategories: string[];
  /** User asked for a goal savings account with a monthly automatic transfer. */
  createSavingsAccount: boolean;
  /**
   * Realistic euros the 1st-of-month check suggested when the account was created.
   * This is the goal's monthly pace, capped by half of what remained. Null when no account was created.
   */
  monthlyTransferEur: number | null;
  /** ISO timestamp of when the questionnaire was completed. */
  completedAt: string;
}

export interface GoalOption {
  value: FinancialGoal;
  label: string;
  description: string;
  /** Goals with an amount and a date get the target step. */
  asksTarget: boolean;
}

export const GOAL_OPTIONS: GoalOption[] = [
  {
    value: "emergency_buffer",
    label: "Build an emergency buffer",
    description: "A cushion for surprises, about three months of costs.",
    asksTarget: true,
  },
  {
    value: "home",
    label: "Save for a home",
    description: "Grow a down payment, one month at a time.",
    asksTarget: true,
  },
  {
    value: "travel",
    label: "Travel or make a big purchase",
    description: "Put money aside for something you are looking forward to.",
    asksTarget: true,
  },
  {
    value: "debt",
    label: "Pay off debt",
    description: "See how fast a regular payment clears what you owe.",
    asksTarget: true,
  },
  {
    value: "understand_spending",
    label: "Understand my spending",
    description: "Find out where the money actually goes.",
    asksTarget: false,
  },
  {
    value: "invest",
    label: "Start investing",
    description: "Turn a monthly surplus into a long-term habit.",
    asksTarget: true,
  },
];

export const INCOME_OPTIONS: { value: IncomePredictability; label: string; description: string }[] = [
  {
    value: "very_predictable",
    label: "Very predictable",
    description: "The same salary lands on the same day every month.",
  },
  {
    value: "mostly_predictable",
    label: "Mostly predictable",
    description: "A regular income that shifts a little.",
  },
  {
    value: "varies",
    label: "Varies a lot",
    description: "Freelance or shift work, or several sources.",
  },
  {
    value: "no_regular_income",
    label: "No regular income yet",
    description: "Studying, between jobs, or supported by someone else.",
  },
];

export const goalLabel = (goal: FinancialGoal): string =>
  GOAL_OPTIONS.find((option) => option.value === goal)?.label ?? goal;

export const incomeLabel = (value: IncomePredictability): string =>
  INCOME_OPTIONS.find((option) => option.value === value)?.label ?? value;

/** Name of the savings account created for a goal. Shown on the home accounts list. */
export function savingsAccountName(goal: FinancialGoal): string {
  switch (goal) {
    case "emergency_buffer":
      return "Emergency buffer";
    case "home":
      return "Home savings";
    case "travel":
      return "Travel savings";
    case "debt":
      return "Debt payoff";
    case "understand_spending":
      return "Spending buffer";
    case "invest":
      return "Investing savings";
  }
}

/**
 * Money left in one month: income minus expenses, never below zero, rounded to the euro.
 * Expenses here are spending, not transfers. A shortfall saves nothing.
 */
export function remainingToSave(incomeEur: number, expenseEur: number): number {
  return Math.max(0, Math.round(incomeEur - expenseEur));
}

/** Months from an analysed "YYYY-MM" until a target "YYYY-MM", at least 1. */
export function monthsUntil(analysedMonth: string, targetMonth: string): number {
  const [fromYear, fromMonth] = analysedMonth.split("-").map(Number);
  const [targetYear, targetMonthIndex] = targetMonth.split("-").map(Number);
  const diff = (targetYear - fromYear) * 12 + (targetMonthIndex - fromMonth);
  return Math.max(1, diff);
}

export interface RealisticSave {
  /** Income minus expenses for the analysed month. */
  remainingEur: number;
  /** What the goal still needs per month. Null when the goal has no target amount. */
  goalPaceEur: number | null;
  /** Half of what remained. The model may not suggest more than this. */
  safeCapEur: number;
  /** Offer. The goal pace when it fits, otherwise the safe cap. Never the whole remainder. */
  amountEur: number;
}

/**
 * Realistic save for one month.
 * Goal pace = (target − already saved) / months left until the target month.
 * The offer is that pace when it is within half of what remained.
 * Half is the cap so the check never empties the month. No target uses that half on its own.
 */
export function realisticMonthlySave(input: {
  incomeEur: number;
  expenseEur: number;
  targetAmountEur: number | null;
  targetMonth: string | null;
  analysedMonth: string;
  alreadySavedEur: number;
}): RealisticSave {
  const remainingEur = remainingToSave(input.incomeEur, input.expenseEur);
  const safeCapEur = Math.floor(remainingEur / 2);
  if (input.targetAmountEur == null || input.targetAmountEur <= 0) {
    return { remainingEur, goalPaceEur: null, safeCapEur, amountEur: safeCapEur };
  }
  const stillNeeded = Math.max(0, Math.round(input.targetAmountEur) - Math.max(0, input.alreadySavedEur));
  if (stillNeeded === 0) {
    return { remainingEur, goalPaceEur: 0, safeCapEur, amountEur: 0 };
  }
  const months = input.targetMonth ? monthsUntil(input.analysedMonth, input.targetMonth) : 1;
  const goalPaceEur = Math.max(1, Math.round(stillNeeded / months));
  return { remainingEur, goalPaceEur, safeCapEur, amountEur: Math.min(goalPaceEur, safeCapEur) };
}

export interface MonthlySaveDecision {
  /** Analysed month, "YYYY-MM". */
  month: string;
  amountEur: number;
  accepted: boolean;
}

/**
 * The monthly check is meant for the 1st.
 * Hardcoded on so the demo can show the popup on any day.
 */
export function monthlySaveCheckIsDue(): boolean {
  return true;
}

const SWEEP_PREFIX = "s-pankki.savings-sweep.v1.";

const sweepKey = (customerId: string) => `${SWEEP_PREFIX}${customerId}`;

function isSaveDecision(value: unknown): value is MonthlySaveDecision {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.month === "string" &&
    /^\d{4}-\d{2}$/.test(row.month) &&
    typeof row.amountEur === "number" &&
    Number.isFinite(row.amountEur) &&
    typeof row.accepted === "boolean"
  );
}

/** Confirmed or skipped 1st-of-month saves for this customer. */
export function loadSweeps(customerId: string): MonthlySaveDecision[] {
  try {
    const raw = window.localStorage.getItem(sweepKey(customerId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isSaveDecision) : [];
  } catch {
    return [];
  }
}

/** Returns false when the browser refuses to store. */
export function saveSweep(customerId: string, decision: MonthlySaveDecision): boolean {
  try {
    const next = loadSweeps(customerId).filter((row) => row.month !== decision.month);
    next.push(decision);
    window.localStorage.setItem(sweepKey(customerId), JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

export function clearSweeps(customerId: string): void {
  try {
    window.localStorage.removeItem(sweepKey(customerId));
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}

export function savedBalanceEur(sweeps: MonthlySaveDecision[]): number {
  return sweeps.reduce((sum, row) => sum + (row.accepted ? row.amountEur : 0), 0);
}

const STORAGE_PREFIX = "s-pankki.questionnaire.v2.";

const storageKey = (customerId: string) => `${STORAGE_PREFIX}${customerId}`;

function isQuestionnaireAnswers(value: unknown): value is QuestionnaireAnswers {
  if (!value || typeof value !== "object") return false;
  const answers = value as Record<string, unknown>;
  return (
    GOAL_OPTIONS.some((option) => option.value === answers.goal) &&
    (answers.targetAmountEur === null || typeof answers.targetAmountEur === "number") &&
    (answers.targetDate === null || typeof answers.targetDate === "string") &&
    INCOME_OPTIONS.some((option) => option.value === answers.incomePredictability) &&
    Array.isArray(answers.controlCategories) &&
    answers.controlCategories.every((category) => typeof category === "string") &&
    (answers.createSavingsAccount === undefined || typeof answers.createSavingsAccount === "boolean") &&
    (answers.monthlyTransferEur === undefined ||
      answers.monthlyTransferEur === null ||
      typeof answers.monthlyTransferEur === "number") &&
    typeof answers.completedAt === "string"
  );
}

function withSavings(answers: QuestionnaireAnswers): QuestionnaireAnswers {
  const created = answers.createSavingsAccount === true;
  const monthly = answers.monthlyTransferEur;
  return {
    ...answers,
    createSavingsAccount: created,
    monthlyTransferEur:
      created && typeof monthly === "number" && Number.isFinite(monthly) ? Math.round(monthly) : null,
  };
}

/** Saved answers for a customer, or null when there are none (or storage is unavailable). */
export function loadAnswers(customerId: string): QuestionnaireAnswers | null {
  try {
    const raw = window.localStorage.getItem(storageKey(customerId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isQuestionnaireAnswers(parsed) ? withSavings(parsed) : null;
  } catch {
    return null;
  }
}

/** Returns false when the browser refuses to store (private mode, quota, disabled storage). */
export function saveAnswers(customerId: string, answers: QuestionnaireAnswers): boolean {
  try {
    window.localStorage.setItem(storageKey(customerId), JSON.stringify(answers));
    return true;
  } catch {
    return false;
  }
}

export function clearAnswers(customerId: string): void {
  try {
    window.localStorage.removeItem(storageKey(customerId));
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}
