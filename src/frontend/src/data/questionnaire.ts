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
    typeof answers.completedAt === "string"
  );
}

/** Saved answers for a customer, or null when there are none (or storage is unavailable). */
export function loadAnswers(customerId: string): QuestionnaireAnswers | null {
  try {
    const raw = window.localStorage.getItem(storageKey(customerId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isQuestionnaireAnswers(parsed) ? parsed : null;
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
