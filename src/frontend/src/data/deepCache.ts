/**
 * Deep-thinking answers that ship with the static build (`public/data/ai-deep-cache.json`,
 * written by `scripts/precache-advice.ts --deep-only`). The two-agent result is stored whole so the
 * card renders exactly as it does against the dev server, with no request leaving the page.
 */
import type { DeepResult } from "../server/deepAnalysis";

interface StaticDeepFile {
  entries?: Record<string, DeepResult>;
}

const deepResults = new Map<string, DeepResult>();
let loaded = false;

export async function primeStaticDeep(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}data/ai-deep-cache.json`);
    if (!response.ok) return;
    const data = (await response.json()) as StaticDeepFile;
    for (const [key, value] of Object.entries(data.entries ?? {})) {
      if (typeof value?.answer?.summary === "string") deepResults.set(key, value);
    }
  } catch {
    // No deep cache (or an unreadable one): the card falls back to the normal overview.
  }
}

/** `customerId|monthKey|segment`, the same key the advice cache uses. */
export function cachedDeepResult(key: string): DeepResult | null {
  return deepResults.get(key) ?? null;
}
