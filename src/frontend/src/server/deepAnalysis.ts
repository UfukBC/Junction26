/**
 * Deep thinking: two different models get the same data. The analyst writes the summary and recommendation,
 * the reviewer checks it. When the reviewer disagrees they discuss (up to MAX_ROUNDS) and settle on one answer.
 * Every figure in the final answer is also checked against the data in code, so the result does not rest on
 * either model alone. If one agent is down the other still answers, and the result says which one ran.
 *
 * Pure orchestration: no network here. The agents are passed in (see agents.ts), so tests can fake them.
 */
import { ADVISOR_VOICE } from "../data/advisor";
import type { NewsItem } from "./news";

export type AgentId = "analyst" | "reviewer";
/** waiting: not called yet · ok: answered · offline: configured but the call failed · not-configured: no key. */
export type AgentState = "waiting" | "ok" | "offline" | "not-configured";

export interface AgentInfo {
  id: AgentId;
  role: string;
  model: string;
  label: string;
  state: AgentState;
}

/** Thrown by an agent call that found no credentials: the agent shows as "not set up" instead of "offline". */
export class AgentNotConfigured extends Error {}

/** Returns the reply text, which holds one JSON object matching `schema`. Throws when the model is unreachable. */
export type AgentCall = (system: string, user: string, schema: JsonSchema) => Promise<string>;

export interface Agent {
  model: string;
  label: string;
  /** null when the agent has no key: it is shown as not configured and never called. */
  call: AgentCall | null;
}

export interface Answer {
  summary: string;
  recommendation: string;
}

/**
 * verified: the reviewer agreed with the analyst.
 * corrected: the reviewer found a problem and the final answer was changed after the discussion.
 * disputed: still no agreement after the last round; the answer with fewer unsupported figures is shown.
 * unchecked: only one agent answered, nobody checked it.
 */
export type Verdict = "verified" | "corrected" | "disputed" | "unchecked";

export interface Turn {
  agent: AgentId;
  kind: "answer" | "review" | "reply";
  text: string;
}

export interface DeepResult {
  answer: Answer;
  verdict: Verdict;
  agents: AgentInfo[];
  turns: Turn[];
  news: NewsItem[];
  /** Figures in the final answer that appear nowhere in the data or the news. Empty is the goal. */
  unsupportedFigures: string[];
}

export type Stage = "analysing" | "reviewing" | "discussing";

export type DeepEvent =
  | { type: "agents"; agents: AgentInfo[] }
  | { type: "news"; news: NewsItem[] }
  | { type: "stage"; stage: Stage; agent: AgentId }
  | { type: "turn"; turn: Turn }
  | { type: "done"; result: DeepResult }
  | { type: "failed"; agents: AgentInfo[] };

export type JsonSchema = Record<string, unknown>;

export const MAX_ROUNDS = 2;

const ANSWER_SCHEMA: JsonSchema = {
  type: "object",
  properties: { summary: { type: "string" }, recommendation: { type: "string" } },
  required: ["summary", "recommendation"],
  additionalProperties: false,
};

const REVIEW_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["correct", "incorrect"] },
    issues: { type: "array", items: { type: "string" } },
    summary: { type: "string" },
    recommendation: { type: "string" },
  },
  required: ["verdict", "issues", "summary", "recommendation"],
  additionalProperties: false,
};

const REPLY_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    reply: { type: "string" },
    summary: { type: "string" },
    recommendation: { type: "string" },
  },
  required: ["reply", "summary", "recommendation"],
  additionalProperties: false,
};

const NEWS_RULE =
  "News headlines are today's Finnish news, not this customer's data. Mention one only if it clearly changes what this customer should do with money (prices, interest rates, taxes, benefits, work); otherwise ignore the news. Never take figures from the news into the customer's figures.";

export const ANALYST_SYSTEM = [
  ADVISOR_VOICE,
  "You are the analyst. Another AI will check every claim you make against the same data.",
  "summary states the facts in one or two sentences, using only the figures given.",
  "recommendation is one concrete next step that uses a figure from the data.",
  NEWS_RULE,
  'Reply with JSON only: {"summary": string, "recommendation": string}',
].join(" ");

export const REVIEWER_SYSTEM = [
  "You are an independent reviewer at a Finnish mobile bank. You get the same customer data as the analyst, and the analyst's answer.",
  "Check: every figure appears in the data or follows from it by simple arithmetic; every statement is true for this data;",
  "the recommendation is concrete, safe and follows from the data; the rules written in the data are followed; news is used correctly or not at all.",
  "Do not mark an answer incorrect for wording or style, only for a wrong fact, a wrong figure, a broken rule, or unsafe advice.",
  'verdict is "correct" or "incorrect". issues lists at most 3 short problems, each naming the wrong claim and the right figure; empty when correct.',
  "summary and recommendation are your corrected version, or the analyst's text unchanged when it is correct.",
  NEWS_RULE,
  'Reply with JSON only: {"verdict": "correct" | "incorrect", "issues": string[], "summary": string, "recommendation": string}',
].join(" ");

export const REPLY_SYSTEM = [
  ADVISOR_VOICE,
  "You are the analyst. A reviewer checked your answer against the same data and raised issues.",
  "If the reviewer is right, fix your answer. If you are right, keep it and say which figure in the data shows it.",
  "reply is one sentence to the reviewer. summary and recommendation are your answer after this.",
  'Reply with JSON only: {"reply": string, "summary": string, "recommendation": string}',
].join(" ");

/**
 * With house rules, the analyst writes under the same rules as the normal overview (and the reviewer treats a
 * broken rule as an error), so a deep answer never says something the normal overview is forbidden to say.
 */
export function systemPrompts(guidance?: string): { analyst: string; reviewer: string; reply: string } {
  if (!guidance) return { analyst: ANALYST_SYSTEM, reviewer: REVIEWER_SYSTEM, reply: REPLY_SYSTEM };
  const rules = `House rules for this advice:\n${guidance}`;
  return {
    analyst: [rules, "You are the analyst. Another AI will check every claim you make against the same data.", NEWS_RULE].join("\n"),
    reviewer: `${REVIEWER_SYSTEM}\nThe analyst had to follow these house rules; an answer that breaks one is incorrect.\n${rules}`,
    reply: `${REPLY_SYSTEM}\nKeep following these house rules.\n${rules}`,
  };
}

function clip(value: string, max = 360): string {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > max ? clean.slice(0, max - 1) + "…" : clean;
}

function parseObject(raw: string): Record<string, unknown> {
  const json = raw.replace(/```json|```/g, "").match(/\{[\s\S]*\}/)?.[0];
  if (!json) throw new Error("no json");
  const value = JSON.parse(json) as unknown;
  if (!value || typeof value !== "object") throw new Error("not an object");
  return value as Record<string, unknown>;
}

function readAnswer(value: Record<string, unknown>): Answer {
  if (typeof value.summary !== "string" || !value.summary.trim()) throw new Error("no summary");
  return {
    summary: clip(value.summary),
    recommendation: typeof value.recommendation === "string" ? clip(value.recommendation) : "",
  };
}

interface Review extends Answer {
  correct: boolean;
  issues: string[];
}

function readReview(value: Record<string, unknown>, fallback: Answer): Review {
  if (value.verdict !== "correct" && value.verdict !== "incorrect") throw new Error("no verdict");
  const issues = Array.isArray(value.issues)
    ? value.issues.filter((item): item is string => typeof item === "string" && item.trim() !== "").slice(0, 3).map((item) => clip(item, 200))
    : [];
  let corrected = fallback;
  try {
    corrected = readAnswer(value);
  } catch {
    // The reviewer may leave its version out when it agrees.
  }
  // "incorrect" without a single issue is not a usable review; treat it as agreement.
  const correct = value.verdict === "correct" || issues.length === 0;
  return { ...corrected, correct, issues };
}

/** Numbers as plain floats: "1 234,56 €" → 1234.56, "38 %" → 38. Dates are kept apart as strings. */
function numbersIn(text: string): { values: number[]; dates: string[] } {
  const dates = text.match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? [];
  const rest = text.replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ");
  const values = (rest.match(/\d{1,3}(?:[   ]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?/g) ?? []).map((token) =>
    Number(token.replace(/[   ]/g, "").replace(",", ".")),
  );
  return { values: values.filter((value) => Number.isFinite(value)), dates };
}

/**
 * Every figure the data supports: the numbers themselves, simple shares of one (half, quarter, 10 %, 20 %),
 * and sums, differences and percentages of two. That is the "simple arithmetic" the reviewer is told to allow.
 */
function derivedFigures(values: number[]): number[] {
  const base = [...new Set(values.filter((value) => value > 0))];
  const out = new Set<number>();
  for (const a of base) {
    for (const share of [0.5, 0.25, 0.1, 0.2]) out.add(a * share);
    for (const b of base) {
      if (a === b) continue;
      out.add(a + b);
      out.add(Math.abs(a - b));
      out.add((a / b) * 100);
    }
  }
  return [...out];
}

const MONTH_YEAR = /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/gi;

/**
 * Figures in `answer` that the data does not support. Small numbers (under 10) are skipped: counts and ordinals.
 * A figure from the data matches within 2 % (or 1 unit), so rounding is fine; a derived figure must match within 0.5 %.
 * Month labels ("September 2026") are not figures and are left out on both sides.
 */
export function unsupportedFigures(answer: Answer, source: string): string[] {
  const text = `${answer.summary} ${answer.recommendation}`.replace(MONTH_YEAR, " ");
  const known = numbersIn(source.replace(MONTH_YEAR, " "));
  const derived = derivedFigures(known.values);
  const found = numbersIn(text);
  const missing: string[] = [];
  for (const value of found.values) {
    if (value < 10) continue;
    const ok =
      known.values.some((candidate) => Math.abs(candidate - value) <= Math.max(1, candidate * 0.02)) ||
      derived.some((candidate) => Math.abs(candidate - value) <= Math.max(1, candidate * 0.005));
    if (!ok) missing.push(String(value));
  }
  for (const date of found.dates) {
    if (!known.dates.includes(date)) missing.push(date);
  }
  return [...new Set(missing)];
}

function sameAnswer(a: Answer, b: Answer): boolean {
  const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  return norm(a.summary) === norm(b.summary) && norm(a.recommendation) === norm(b.recommendation);
}

export function dataPrompt(segment: string, brief: string, news: NewsItem[]): string {
  const headlines = news.map((item) => `- ${item.title}${item.description ? `: ${item.description}` : ""}`).join("\n");
  return [
    `Selected: ${segment}`,
    `Write a summary and one recommendation about ${segment}.`,
    "Customer data:",
    brief,
    headlines ? `Today's news (${news.length} headlines):\n${headlines}` : "Today's news: none available.",
  ].join("\n");
}

function answerText(answer: Answer): string {
  return `Summary: ${answer.summary}\nRecommendation: ${answer.recommendation}`;
}

export async function runDeepAnalysis(input: {
  segment: string;
  brief: string;
  news: NewsItem[];
  analyst: Agent;
  reviewer: Agent;
  emit: (event: DeepEvent) => void;
  /** The house rules for advice (the normal overview prompt). The analyst follows them; the reviewer checks them. */
  guidance?: string;
}): Promise<DeepResult | null> {
  const { segment, brief, news, emit } = input;
  const prompts = systemPrompts(input.guidance);
  const roster: Record<AgentId, Agent> = { analyst: input.analyst, reviewer: input.reviewer };
  const agents: AgentInfo[] = (
    [
      ["analyst", "Analyst"],
      ["reviewer", "Reviewer"],
    ] as const
  ).map(([id, role]) => ({
    id,
    role,
    model: roster[id].model,
    label: roster[id].label,
    state: roster[id].call ? "waiting" : "not-configured",
  }));
  const info = (id: AgentId) => agents.find((agent) => agent.id === id)!;
  const setState = (id: AgentId, state: AgentState) => {
    info(id).state = state;
    emit({ type: "agents", agents: agents.map((agent) => ({ ...agent })) });
  };
  emit({ type: "agents", agents: agents.map((agent) => ({ ...agent })) });
  emit({ type: "news", news });

  const data = dataPrompt(segment, brief, news);
  const source = `${brief}\n${news.map((item) => `${item.title} ${item.description}`).join("\n")}`;
  const turns: Turn[] = [];
  const addTurn = (turn: Turn) => {
    turns.push(turn);
    emit({ type: "turn", turn });
  };

  /** Calls one agent. On any failure the agent is marked offline and null comes back; the run goes on. */
  async function ask<T>(id: AgentId, system: string, user: string, schema: JsonSchema, read: (v: Record<string, unknown>) => T) {
    const call = roster[id].call;
    const state = info(id).state;
    if (!call || state === "offline" || state === "not-configured") return null;
    try {
      const value = read(parseObject(await call(system, user, schema)));
      if (info(id).state !== "ok") setState(id, "ok");
      return value;
    } catch (error) {
      setState(id, error instanceof AgentNotConfigured ? "not-configured" : "offline");
      return null;
    }
  }

  const finish = (answer: Answer, verdict: Verdict): DeepResult => {
    const result: DeepResult = {
      answer,
      verdict,
      agents: agents.map((agent) => ({ ...agent })),
      turns,
      news,
      unsupportedFigures: unsupportedFigures(answer, source),
    };
    emit({ type: "done", result });
    return result;
  };

  // 1. The analyst answers. If it is down, the reviewer answers alone.
  emit({ type: "stage", stage: "analysing", agent: "analyst" });
  const first = await ask("analyst", prompts.analyst, data, ANSWER_SCHEMA, readAnswer);
  if (!first) {
    emit({ type: "stage", stage: "analysing", agent: "reviewer" });
    const solo = await ask("reviewer", prompts.analyst, data, ANSWER_SCHEMA, readAnswer);
    if (!solo) {
      emit({ type: "failed", agents: agents.map((agent) => ({ ...agent })) });
      return null;
    }
    addTurn({ agent: "reviewer", kind: "answer", text: answerText(solo) });
    return finish(solo, "unchecked");
  }
  addTurn({ agent: "analyst", kind: "answer", text: answerText(first) });

  // 2. The reviewer checks it, with the figures the code could not find in the data.
  let current = first;
  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    emit({ type: "stage", stage: round === 0 ? "reviewing" : "discussing", agent: "reviewer" });
    const missing = unsupportedFigures(current, source);
    const reviewPrompt = [
      data,
      "",
      "Analyst's answer:",
      answerText(current),
      missing.length > 0
        ? `Automatic check: these figures in the answer were not found in the data: ${missing.join(", ")}.`
        : "Automatic check: every figure in the answer was found in the data.",
      round > 0 ? `This is round ${round + 1} of the discussion. Earlier turns:\n${turns.map((t) => `${t.agent}: ${t.text}`).join("\n")}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    const review = await ask("reviewer", prompts.reviewer, reviewPrompt, REVIEW_SCHEMA, (value) => readReview(value, current));
    // Reviewer down: whatever the analyst has now was not checked.
    if (!review) return finish(current, "unchecked");
    addTurn({
      agent: "reviewer",
      kind: "review",
      text: review.correct ? "Checked against the data: correct." : `Issues: ${review.issues.join(" ")}`,
    });
    if (review.correct) return finish(current, sameAnswer(current, first) ? "verified" : "corrected");

    const reviewerVersion: Answer = { summary: review.summary, recommendation: review.recommendation };
    if (round === MAX_ROUNDS - 1) {
      // No agreement: show the version the data supports better; the reviewer's on a tie.
      const pick =
        unsupportedFigures(current, source).length < unsupportedFigures(reviewerVersion, source).length
          ? current
          : reviewerVersion;
      return finish(pick, "disputed");
    }

    // 3. The analyst answers the issues: it fixes its answer or defends it with a figure.
    emit({ type: "stage", stage: "discussing", agent: "analyst" });
    const reply = await ask(
      "analyst",
      prompts.reply,
      [data, "", "Your answer:", answerText(current), "", "Reviewer's issues:", ...review.issues.map((issue) => `- ${issue}`)].join("\n"),
      REPLY_SCHEMA,
      (value) => ({ ...readAnswer(value), reply: typeof value.reply === "string" ? clip(value.reply, 240) : "" }),
    );
    if (!reply) {
      // The analyst dropped out mid-discussion: the reviewer's corrected version stands.
      return finish(reviewerVersion, "corrected");
    }
    addTurn({ agent: "analyst", kind: "reply", text: reply.reply || answerText(reply) });
    current = { summary: reply.summary, recommendation: reply.recommendation };
  }
  return finish(current, "disputed");
}
