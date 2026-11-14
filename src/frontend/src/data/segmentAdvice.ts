import { formatEur } from "../format";

export interface SegmentAdvice {
  summary: string;
  recommendation: string;
  /** Set when the text came from local Qwen. Absent for the written fallback. */
  source?: "nemotron-3.5-super-vl";
}

function fallbackLine(segment: string, amountEur: number): string {
  const money = formatEur(amountEur);
  if (segment === "Income") return `Income this month was ${money}.`;
  if (segment === "Fixed") return `Housing and utilities were ${money}.`;
  if (segment === "Left") {
    return amountEur < 0
      ? `Spending passed income by ${formatEur(Math.abs(amountEur))}.`
      : `${money} was left after the bills and everyday spending.`;
  }
  if (segment === "Health") return `Health payments were ${money}.`;
  return `${segment} payments were ${money}.`;
}

export function fallbackAdvice(_monthTitle: string, segment: string, amountEur: number): SegmentAdvice {
  const text = fallbackLine(segment, amountEur);
  return { summary: text, recommendation: "" };
}

export async function fetchSegmentAdvice(body: {
  month: string;
  segment: string;
  brief: string;
}): Promise<SegmentAdvice | null> {
  const response = await fetch("/api/segment-advice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { summary?: unknown; recommendation?: unknown; source?: unknown };
  if (typeof data.summary !== "string" || typeof data.recommendation !== "string") return null;
  return {
    summary: data.summary,
    recommendation: data.recommendation,
    source: data.source === "nemotron-3.5-super-vl" ? "nemotron-3.5-super-vl" : undefined,
  };
}
