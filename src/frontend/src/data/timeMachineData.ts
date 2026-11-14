/* Loads the inputs for the Time machine screen from the customer's own recent months.
 *
 * This composes existing query functions instead of adding SQL here, so the browser data layer stays the single
 * integration surface. Averages use the last few months that have data, ending at the dataset's "today".
 */

import {
  getMonthlyFlow,
  getSpendingByCategory,
  getTransactionSummary,
  listMonths,
  monthRange,
} from "./database";

/** How many recent months the averages are taken over (fewer when the history is shorter). */
export const BASELINE_MONTHS = 6;

export interface CategoryAverage {
  category: string;
  /** Average per month over the window, in euros. */
  monthlyEur: number;
  /** Share of the window's spending, 0–1. */
  share: number;
}

export interface TimeMachineBaseline {
  startingBalanceEur: number;
  monthlyIncomeEur: number;
  monthlySpendingEur: number;
  monthlyNetEur: number;
  /** Months the averages are based on. */
  monthsUsed: number;
  firstMonth: string | null;
  lastMonth: string | null;
  /** Spending categories, largest average first. */
  categories: CategoryAverage[];
}

/** Baseline for one customer. Never reads another customer's data. */
export async function loadTimeMachineBaseline(customerId: string): Promise<TimeMachineBaseline> {
  const [months, summary] = await Promise.all([
    listMonths(customerId),
    getTransactionSummary(customerId),
  ]);

  const window = months.slice(-BASELINE_MONTHS);
  const firstMonth = window[0] ?? null;
  const lastMonth = window[window.length - 1] ?? null;
  const startingBalanceEur = summary.latestBalanceEur ?? 0;

  if (!firstMonth || !lastMonth) {
    return {
      startingBalanceEur,
      monthlyIncomeEur: 0,
      monthlySpendingEur: 0,
      monthlyNetEur: 0,
      monthsUsed: 0,
      firstMonth,
      lastMonth,
      categories: [],
    };
  }

  const range = { startDate: `${firstMonth}-01`, endDate: monthRange(lastMonth).endDate };
  const [flows, categories] = await Promise.all([
    getMonthlyFlow(customerId, range),
    getSpendingByCategory(customerId, range),
  ]);

  const monthsUsed = flows.length;
  const divisor = monthsUsed > 0 ? monthsUsed : 1;
  const totalIncome = flows.reduce((sum, flow) => sum + flow.incomeEur, 0);
  const totalSpending = flows.reduce((sum, flow) => sum + flow.spendingEur, 0);
  const monthlyIncomeEur = totalIncome / divisor;
  const monthlySpendingEur = totalSpending / divisor;

  return {
    startingBalanceEur,
    monthlyIncomeEur,
    monthlySpendingEur,
    monthlyNetEur: monthlyIncomeEur - monthlySpendingEur,
    monthsUsed,
    firstMonth,
    lastMonth,
    categories: categories.map((category) => ({
      category: category.category,
      monthlyEur: category.totalEur / divisor,
      share: category.share,
    })),
  };
}
