/* Typed client for the local AI narration server (src/backend).
 *
 * Every function sends aggregates only (never raw transactions, never the DB) and resolves to
 * `null` when the server is unreachable, slow, or has no key. Callers keep their static copy in
 * that case, so the demo never shows an error card because of narration.
 */

export type AiLanguage = "en" | "fi";

export interface AiGoal {
  label: string;
  targetAmountEur?: number | null;
  targetDate?: string | null;
}

export interface AiMonthRow {
  month: string;
  spendingEur: number | null;
  incomeEur?: number | null;
}

export interface AiOverviewInput {
  language?: AiLanguage;
  year: number;
  totals: {
    spendingEur: number;
    incomeEur: number;
    monthsWithData: number;
    averageMonthlySpendingEur?: number | null;
  };
  months: AiMonthRow[];
  goal?: AiGoal | null;
}

export interface AiMonthSummaryInput {
  language?: AiLanguage;
  month: string;
  spendingEur: number;
  incomeEur?: number | null;
  topCategories: { name: string; amountEur: number; sharePct: number }[];
  yearAverageMonthlySpendingEur?: number | null;
}

export interface AiCategoryInput {
  language?: AiLanguage;
  category: string;
  amountEur: number;
  sharePct: number;
  benchmarkSharePct?: number | null;
}

export interface AiInsightInput {
  language?: AiLanguage;
  insights?: { title: string; detail?: string | null; amountEur?: number | null }[] | null;
  aggregates?: {
    month?: string | null;
    spendingEur?: number | null;
    incomeEur?: number | null;
    categories?: { name: string; amountEur: number; sharePct?: number | null }[] | null;
  } | null;
  questionnaire?: {
    goal?: string | null;
    targetAmountEur?: number | null;
    targetDate?: string | null;
    incomePredictability?: string | null;
    controlCategories?: string[] | null;
  } | null;
}

export interface AiWhatIfInput {
  language?: AiLanguage;
  scenario: string;
  baseline: { spendingEur: number };
  result: { spendingEur: number };
  savingEur?: number | null;
}

export interface AiHealth {
  ok: boolean;
  provider: string;
  model: string;
  cacheEntries: number;
  endpoints: string[];
}

const TIMEOUT_MS = 30_000;

async function post(path: string, body: unknown): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return (await response.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function text(path: string, body: unknown): Promise<string | null> {
  const data = (await post(path, body)) as { text?: unknown } | null;
  return typeof data?.text === "string" && data.text.trim() ? data.text.trim() : null;
}

/** 3-5 sentence overview of a year: totals, monthly rhythm, and what it means for the goal. */
export function fetchAiOverview(input: AiOverviewInput): Promise<string | null> {
  return text("/api/ai/overview", input);
}

/** 2-3 sentences for one month: what stands out, top categories, vs. the monthly average. */
export function fetchAiMonthSummary(input: AiMonthSummaryInput): Promise<string | null> {
  return text("/api/ai/month-summary", input);
}

/** One plain-language sentence about a category, its share and the benchmark. */
export function fetchAiCategory(input: AiCategoryInput): Promise<string | null> {
  return text("/api/ai/category", input);
}

/** 1-2 sentences narrating insight objects or aggregates for the user's goal. */
export function fetchAiInsight(input: AiInsightInput): Promise<string | null> {
  return text("/api/ai/insight", input);
}

/** 2 sentences about a what-if scenario, stating the saving. */
export function fetchAiWhatIf(input: AiWhatIfInput): Promise<string | null> {
  return text("/api/ai/what-if", input);
}

/** Server status: which provider/model is active and how many cached replies exist. */
export async function fetchAiHealth(): Promise<AiHealth | null> {
  try {
    const response = await fetch("/api/health");
    if (!response.ok) return null;
    return (await response.json()) as AiHealth;
  } catch {
    return null;
  }
}

/** Drops the in-memory response cache; returns how many entries were cleared. */
export async function clearAiCache(): Promise<number | null> {
  const data = (await post("/api/cache/clear", {})) as { cleared?: unknown } | null;
  return typeof data?.cleared === "number" ? data.cleared : null;
}
