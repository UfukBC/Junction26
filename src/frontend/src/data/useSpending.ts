import { useEffect, useState } from "react";
import { getMonthlyFlow, getSpendingByCategory, monthRange, type CategorySpend } from "./database";

/** "2025-03" → "2025-02" */
export function previousMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

/** Months (YYYY-MM, oldest first) in which the customer has any transaction. */
export function useSpendingMonths(customerId: string) {
  const [months, setMonths] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setMonths(null);
    setError(null);
    getMonthlyFlow(customerId)
      .then((flows) => active && setMonths(flows.map((f) => f.month)))
      .catch((e: unknown) => active && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      active = false;
    };
  }, [customerId]);
  return { months, error };
}

export interface MonthSpending {
  month: string;
  categories: CategorySpend[];
  spendingEur: number;
  incomeEur: number;
  /** Category totals of the month before, when that month has data (for "vs last month"). */
  previous: { month: string; categories: CategorySpend[] } | null;
}

/** Spending by category, total spending and income for one month (1st to last day). */
export function useMonthSpending(customerId: string, month: string | null, availableMonths: string[] | null) {
  const [data, setData] = useState<MonthSpending | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!month) return;
    let active = true;
    setError(null);
    const prev = previousMonth(month);
    const hasPrev = availableMonths?.includes(prev) ?? false;
    Promise.all([
      getSpendingByCategory(customerId, monthRange(month)),
      getMonthlyFlow(customerId, monthRange(month)),
      hasPrev ? getSpendingByCategory(customerId, monthRange(prev)) : Promise.resolve(null),
    ])
      .then(([categories, flow, prevCategories]) => {
        if (!active) return;
        setData({
          month,
          categories,
          spendingEur: categories.reduce((s, c) => s + c.totalEur, 0),
          incomeEur: flow[0]?.incomeEur ?? 0,
          previous: prevCategories ? { month: prev, categories: prevCategories } : null,
        });
      })
      .catch((e: unknown) => active && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      active = false;
    };
  }, [customerId, month, availableMonths]);
  return { data: data && data.month === month ? data : null, error };
}
