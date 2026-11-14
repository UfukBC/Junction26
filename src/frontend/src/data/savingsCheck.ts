/** Facts the model is allowed to use. The browser never calls the model directly. */
export interface SavingsCheckRequest {
  goalLabel: string;
  targetAmountEur: number | null;
  targetMonth: string | null;
  analysedMonth: string;
  monthsLeft: number;
  alreadySavedEur: number;
  incomeEur: number;
  expenseEur: number;
  remainingEur: number;
  goalPaceEur: number | null;
  safeCapEur: number;
  incomePredictability: string;
}

export interface SavingsCheckResult {
  amountEur: number;
  reason: string;
  source: "nemotron-3.5-super-vl";
}

/** Nemotron via the dev server, or null when the call fails. */
export async function fetchSavingsCheck(body: SavingsCheckRequest): Promise<SavingsCheckResult | null> {
  try {
    const response = await fetch("/api/savings-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { amountEur?: unknown; reason?: unknown };
    if (typeof data.amountEur !== "number" || !Number.isFinite(data.amountEur)) return null;
    if (typeof data.reason !== "string" || data.reason.trim() === "") return null;
    return { amountEur: Math.round(data.amountEur), reason: data.reason.trim(), source: "nemotron-3.5-super-vl" };
  } catch {
    return null;
  }
}
