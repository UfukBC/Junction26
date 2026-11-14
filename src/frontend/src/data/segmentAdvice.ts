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

/* ---------------------------------------------------- precached (static) */

/** Shape of `public/data/ai-cache.json`, written by `scripts/precache-advice.ts`. */
interface StaticAdviceFile {
  entries?: Record<string, { summary?: unknown; recommendation?: unknown; source?: unknown }>;
}

const staticAdvice = new Map<string, SegmentAdvice>();
let staticLoaded = false;

function staticUrl(): string {
  return `${import.meta.env.BASE_URL}data/ai-cache.json`;
}

/**
 * Load the answered prompts that ship with the static build. The file is optional: when it is missing
 * (plain `npm run dev`) the app keeps calling the dev-server routes exactly as before.
 */
export async function primeStaticAdvice(): Promise<void> {
  if (staticLoaded) return;
  staticLoaded = true;
  try {
    const response = await fetch(staticUrl());
    if (!response.ok) return;
    const data = (await response.json()) as StaticAdviceFile;
    for (const [key, value] of Object.entries(data.entries ?? {})) {
      if (typeof value?.summary === "string" && typeof value?.recommendation === "string") {
        staticAdvice.set(key, {
          summary: value.summary,
          recommendation: value.recommendation,
          source: value.source === "nemotron-3.5-super-vl" ? "nemotron-3.5-super-vl" : undefined,
        });
      }
    }
  } catch {
    // No static cache (or an unreadable one): fall through to the dev API.
  }
}

/** True once the static cache has entries, meaning this page needs no backend for its AI text. */
export function isStaticBuild(): boolean {
  return staticAdvice.size > 0;
}

function staticAdviceFor(
  request: Pick<AdviceRequest, "customerId" | "monthKey" | "segment">,
): SegmentAdvice | null {
  return staticAdvice.get(cacheKey(request)) ?? null;
}

/* ------------------------------------------------------------- lookups */

/** Cached overview for a segment, regardless of the data it was built from (first paint). */
export function cachedAdvice(
  request: Pick<AdviceRequest, "customerId" | "monthKey" | "segment">,
): SegmentAdvice | null {
  const precached = staticAdviceFor(request);
  if (precached) return precached;
  const entry = readCache(request);
  return entry ? { summary: entry.summary, recommendation: entry.recommendation } : null;
}

/** Cached overview only when it was generated from the same brief (same data). */
export function cachedAdviceFor(
  request: Pick<AdviceRequest, "customerId" | "monthKey" | "segment">,
  brief: string,
): SegmentAdvice | null {
  // The precache is generated from the same data that ships with the build, so its key is enough.
  const precached = staticAdviceFor(request);
  if (precached) return precached;
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
  const data = (await response.json()) as { summary?: unknown; recommendation?: unknown; source?: unknown };
  if (typeof data.summary !== "string" || typeof data.recommendation !== "string") return null;
  const advice: SegmentAdvice = {
    summary: data.summary,
    recommendation: data.recommendation,
    source: data.source === "nemotron-3.5-super-vl" ? "nemotron-3.5-super-vl" : undefined,
  };
  writeCache(request, advice);
  return advice;
}
