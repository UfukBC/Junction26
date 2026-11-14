import { formatEur } from "../format";

export interface SegmentAdvice {
  summary: string;
  recommendation: string;
}

/* --------------------------------------------------------------- fallback */

const Baked: Record<string, SegmentAdvice> = {
  "April 2026|Income": {
    summary: "One salary arrived, 3 074,31 €. That is all of April’s income.",
    recommendation: "Budget the month from this salary. What remains after the bills is what you can save.",
  },
  "April 2026|Fixed": {
    summary: "Housing and utilities were 1 280,55 €, about two fifths of the salary.",
    recommendation: "Leave this basket. These are the regular bills, not the leak.",
  },
  "April 2026|Everyday": {
    summary: "Everyday spending was 92,24 € across 17 purchases. Restaurants were the largest, at 36,82 €.",
    recommendation: "Nothing to cut. This is a calm month. Watch for a jump like December.",
  },
  "April 2026|Left": {
    summary: "1 701,52 € of the salary was still unspent, so the balance rose.",
    recommendation: "On payday, move a set part of this leftover into savings.",
  },
  "April 2026|Restaurants": {
    summary: "Ten restaurant payments totaled 36,82 €, only a few euros each.",
    recommendation: "This is a small habit. No change is needed in a month like this.",
  },
  "April 2026|Home & Tech": {
    summary: "One Home & Tech purchase was 26,70 €.",
    recommendation: "A single small buy. Act only if the same kind of purchase starts repeating.",
  },
  "April 2026|Entertainment": {
    summary: "Five entertainment payments totaled 15,82 €.",
    recommendation: "These are tiny. Leave them.",
  },
  "April 2026|Lifestyle": {
    summary: "One lifestyle purchase was 12,90 €.",
    recommendation: "Nothing to change here.",
  },
  "December 2024|Income": {
    summary: "Salary was 3 599,46 €, higher than April. Pay is not what broke the month.",
    recommendation: "Compare spending with this salary. The shortfall is in spending, not income.",
  },
  "December 2024|Fixed": {
    summary: "Housing and utilities were 1 383,45 €, close to April’s 1 280,55 €.",
    recommendation: "Keep paying these. The spike is in everyday spending, not in the bills.",
  },
  "December 2024|Everyday": {
    summary: "Everyday spending was 2 881,65 €. With the bills, the month went 665,64 € past the salary.",
    recommendation: "Start with groceries, 1 403,33 €, and the one lifestyle purchase of 656,59 €.",
  },
  "December 2024|Left": {
    summary: "Spending passed the salary by 665,64 €. The balance ended at 4 488,43 €.",
    recommendation: "Next month, keep the bills plus everyday spending under the salary.",
  },
  "December 2024|Groceries": {
    summary: "Twenty grocery payments totaled 1 403,33 €, about half of everyday spending.",
    recommendation: "This is the main leak. Look at the largest grocery trips first.",
  },
  "December 2024|Lifestyle": {
    summary: "One lifestyle purchase was 656,59 €, more than April’s whole everyday basket.",
    recommendation: "If this was optional, this single buy is most of the 666 € shortfall.",
  },
  "December 2024|Restaurants": {
    summary: "Ten restaurant visits cost 417,35 €, against 36,82 € in April. The count is the same.",
    recommendation: "Cap the amount per visit. The habit grew in euros, not in how often you went.",
  },
  "December 2024|Health": {
    summary: "Three health payments totaled 404,38 €.",
    recommendation: "Check whether these were necessary care before cutting them. Needed health costs are not the leak.",
  },
};

export function fallbackAdvice(monthTitle: string, segment: string, amountEur: number): SegmentAdvice {
  return (
    Baked[`${monthTitle}|${segment}`] ?? {
      summary: `${segment} is ${formatEur(amountEur)} in ${monthTitle}.`,
      recommendation: "Compare this slice with the salary before deciding what to change.",
    }
  );
}

/* ---------------------------------------------------------------- cache */

export interface AdviceRequest {
  /** Customer id: part of the cache key, never sent to the model. */
  customerId: string;
  /** "2026-09" — the cache segment. */
  monthKey: string;
  /** "September 2026" — what the model is told. */
  monthTitle: string;
  segment: string;
  brief: string;
}

const CACHE_PREFIX = "s-pankki.ai-advice.v1.";
const memory = new Map<string, CachedAdvice>();

interface CachedAdvice extends SegmentAdvice {
  /** Hash of the brief the text was generated from, so changed data does not reuse stale text. */
  briefHash: number;
}

/** FNV-1a, synchronous so the cache can be read during the first render. */
function briefHash(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function cacheKey(request: Pick<AdviceRequest, "customerId" | "monthKey" | "segment">): string {
  return `${request.customerId}|${request.monthKey}|${request.segment}`;
}

function readCache(request: Pick<AdviceRequest, "customerId" | "monthKey" | "segment">): CachedAdvice | null {
  const key = cacheKey(request);
  const hit = memory.get(key);
  if (hit) return hit;
  try {
    const raw = window.localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedAdvice>;
    if (
      typeof parsed.summary !== "string" ||
      typeof parsed.recommendation !== "string" ||
      typeof parsed.briefHash !== "number"
    ) {
      return null;
    }
    const entry: CachedAdvice = {
      summary: parsed.summary,
      recommendation: parsed.recommendation,
      briefHash: parsed.briefHash,
    };
    memory.set(key, entry);
    return entry;
  } catch {
    return null;
  }
}

function writeCache(request: AdviceRequest, advice: SegmentAdvice): void {
  const key = cacheKey(request);
  const entry: CachedAdvice = { ...advice, briefHash: briefHash(request.brief) };
  memory.set(key, entry);
  try {
    window.localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // Storage full or unavailable: the in-memory entry still helps within this session.
  }
}

/** Cached overview for a segment, regardless of the data it was built from (first paint). */
export function cachedAdvice(
  request: Pick<AdviceRequest, "customerId" | "monthKey" | "segment">,
): SegmentAdvice | null {
  const entry = readCache(request);
  return entry ? { summary: entry.summary, recommendation: entry.recommendation } : null;
}

/** Cached overview only when it was generated from the same brief (same data). */
export function cachedAdviceFor(
  request: Pick<AdviceRequest, "customerId" | "monthKey" | "segment">,
  brief: string,
): SegmentAdvice | null {
  const entry = readCache(request);
  return entry && entry.briefHash === briefHash(brief)
    ? { summary: entry.summary, recommendation: entry.recommendation }
    : null;
}

/* --------------------------------------------------------------- request */

/**
 * Cached text first; otherwise asks the local dev server, which calls the model. Returns null when the
 * model is unavailable, so the caller can keep the data-driven fallback.
 */
export async function fetchSegmentAdvice(request: AdviceRequest): Promise<SegmentAdvice | null> {
  const cached = cachedAdviceFor(request, request.brief);
  if (cached) return cached;
  const response = await fetch("/api/segment-advice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ month: request.monthTitle, segment: request.segment, brief: request.brief }),
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { summary?: unknown; recommendation?: unknown };
  if (typeof data.summary !== "string" || typeof data.recommendation !== "string") return null;
  const advice: SegmentAdvice = { summary: data.summary, recommendation: data.recommendation };
  writeCache(request, advice);
  return advice;
}
