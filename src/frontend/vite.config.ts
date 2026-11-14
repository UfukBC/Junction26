import type { IncomingMessage, ServerResponse } from "node:http";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { ADVISOR_NAME, ADVISOR_VOICE, adviceFromPayments, type PaymentFact } from "./src/data/advisor";
import { claudeAgent, nemotronAgent } from "./src/server/agents";
import { runDeepAnalysis, type DeepEvent } from "./src/server/deepAnalysis";
import { fetchMoneyNews } from "./src/server/news";
import { VERDA_MODEL, verdaChat } from "./src/server/verda";

const TRAINER_SYSTEM = [
  ADVISOR_VOICE,
  "Use only the figures and place names in the user message. Do not invent transactions, amounts or names.",
  "Fixed means housing and utilities: do not recommend cutting them.",
  "Health may be necessary care: say to check it before calling it a leak.",
  "Everyday spending is the leak basket.",
  "Look actively for a dangerous habit: the same place or category again and again, many small payments that add up, or spending late in the evening. When one is present, name it, say how often and how many euros, and treat it as the thing to change — unless a sudden high expense is the bigger finding.",
  "Also look for a sudden high expense: a single payment or a short burst far above the customer's usual spending, such as a shopping spree or an unplanned splurge. Name the amount, the place and the date, and say whether it fits the rest of the month.",
  "Also look for a preventable cost and name the cheaper alternative with a number: many taxi rides could be the bus or train, frequent restaurant lunches could be lunch brought from home, a costly store could be replaced by a cheaper one. State what the switch would save.",
  "When the user selected one category, the whole answer is about that category only: use only its payments and places, and never describe the rest of the month.",
  "The summary is shown above two comparison blocks that the app already displays: the customer's previous months and people with a similar income. Do not repeat either comparison, its percentage or its figures in the summary; use them only to decide what is worth mentioning.",
  "The summary is one or two short, plain sentences about this month's own facts: the habit, a large payment, or the category mix. Pick the single most useful finding, not a list.",
  "Priority: when one payment or a short burst stands far above the rest of the month's spending, make that the finding. When a Standout line is present, the summary and the recommendation must be about that payment. Otherwise use the clearest repeated habit or preventable cost, and only then the category mix.",
  "Prefer a specific swap you can see in the places: taxi rides to the bus or train, fuel to a cheaper station or transit, parking to park-and-ride or transit, a restaurant lunch to lunch from home, a pricey shop to a cheaper one. Name the place and put the saving on the amounts given.",
  "For health, never suggest a cap, delay or skipping care: only say to check whether the cost was necessary or reimbursable. For commuter tickets, bus or train rides, utilities and housing, say the category looks fine and do not invent a cut.",
  "Cutting the number of payments is a safe fallback only for discretionary categories (restaurants, entertainment, lifestyle, groceries) and only when nothing more specific can be pointed at; say that it is a fallback. Do not start every recommendation the same way.",
  "For a single large discretionary purchase that has already happened, do not pretend it can be avoided or saved back. Call it a one-off and give a next-step rule with a number, such as a 24-hour wait and a cap for that kind of purchase. This does not apply to care, tickets or bills.",
  "Never give generic advice such as 'review your spending'.",
  "Reply with JSON only:",
  '{"summary": "<one or two short sentences, max 30 words>", "recommendation": "<one sentence: a specific swap with a saving, or a clear nothing-to-cut when the category is not reducible, max 28 words>"}',
].join(" ");

/** Verda's OpenAI-compatible endpoint (see the opencode provider config). */
const AI_BASE = "https://containers.datacrunch.io/nemotron-3-5-super-vl-b300/v1";
const AI_MODEL = "nemotron-3.5-super-vl";

/** The AI narration server in src/backend; only non-segment `/api` is proxied. */
const AI_SERVER = process.env.AI_SERVER_URL || "http://127.0.0.1:8787";
const proxy = {
  "/api": { target: AI_SERVER, changeOrigin: false },
};

function readBody(req: IncomingMessage, limit = 4000): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function clip(value: string) {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > 320 ? clean.slice(0, 317) + "…" : clean;
}

/**
 * Final answer only. Nemotron writes its chain of thought to `reasoning` first, which is not the
 * answer; when the token budget runs out `content` is null and the caller falls back.
 */
function textFromChatCompletion(data: { choices?: { message?: { content?: string | null } }[] }) {
  return (data.choices?.[0]?.message?.content ?? "").trim();
}

/** Accepts the requested JSON shape (also inside prose) and a plain "Summary:\nRecommendation:" reply. */
function parseAdvice(text: string) {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const candidates = [cleaned, cleaned.match(/\{[\s\S]*\}/)?.[0] ?? ""];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const parsed = JSON.parse(candidate) as { summary?: unknown; recommendation?: unknown };
      if (typeof parsed.summary === "string" && typeof parsed.recommendation === "string") {
        return { summary: clip(parsed.summary), recommendation: clip(parsed.recommendation) };
      }
    } catch {
      // try the next shape
    }
  }
  const summary = cleaned.match(/Summary:\s*([\s\S]+?)(?:\n+\s*Recommendation:|$)/i)?.[1]?.trim();
  const recommendation = cleaned.match(/Recommendation:\s*([\s\S]+)/i)?.[1]?.trim();
  if (!summary || !recommendation) {
    throw new Error(`shape: ${cleaned.slice(0, 200) || "<empty>"}`);
  }
  return { summary: clip(summary), recommendation: clip(recommendation) };
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

const SAVINGS_SYSTEM = [
  `You are ${ADVISOR_NAME}, a personal financial advisor. The reason is spoken to the customer in one calm sentence.`,
  "You choose one monthly savings transfer for a Finnish mobile bank.",
  "Use only the figures in the user message. Do not invent numbers.",
  "amountEur is an integer.",
  "It must be from 0 to the safe cap, inclusive.",
  "Never choose the full remaining amount.",
  "When the goal pace is within the safe cap, choose the goal pace.",
  "When the goal pace is above the safe cap, choose the safe cap.",
  "When the goal pace is 0, choose 0.",
  "reason is one sentence, max 30 words, and it must mention the goal pace and what remained.",
  'Reply with JSON only: {"amountEur": number, "reason": string}',
].join(" ");

function savingsCheckPlugin(apiKey: string | undefined): Plugin {
  return {
    name: "savings-check",
    configureServer(server) {
      server.middlewares.use("/api/savings-check", (req, res) => {
        void handleSavingsCheck(req, res, apiKey);
      });
    },
  };
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

async function handleSavingsCheck(req: IncomingMessage, res: ServerResponse, apiKey: string | undefined) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "post only" });
    return;
  }
  if (!apiKey) {
    sendJson(res, 503, { error: "no key" });
    return;
  }
  try {
    const raw = JSON.parse(await readBody(req, 8000)) as Record<string, unknown>;
    if (
      typeof raw.goalLabel !== "string" ||
      typeof raw.analysedMonth !== "string" ||
      !finiteNumber(raw.incomeEur) ||
      !finiteNumber(raw.expenseEur) ||
      !finiteNumber(raw.remainingEur) ||
      !finiteNumber(raw.safeCapEur) ||
      !finiteNumber(raw.monthsLeft) ||
      !finiteNumber(raw.alreadySavedEur) ||
      (raw.goalPaceEur !== null && !finiteNumber(raw.goalPaceEur)) ||
      (raw.targetAmountEur !== null && !finiteNumber(raw.targetAmountEur))
    ) {
      sendJson(res, 400, { error: "bad request" });
      return;
    }
    const safeCap = Math.max(0, Math.floor(raw.safeCapEur));
    const pace = raw.goalPaceEur === null ? "no target amount" : `${Math.round(raw.goalPaceEur)} EUR per month`;
    const target =
      raw.targetAmountEur === null
        ? "no target amount"
        : `${Math.round(raw.targetAmountEur as number)} EUR by ${typeof raw.targetMonth === "string" ? raw.targetMonth : "an open date"}`;
    const user = [
      `Goal: ${raw.goalLabel}`,
      `Target: ${target}`,
      `Analysed month: ${raw.analysedMonth}`,
      `Months left: ${Math.round(raw.monthsLeft)}`,
      `Already saved: ${Math.round(raw.alreadySavedEur)} EUR`,
      `Income: ${raw.incomeEur} EUR`,
      `Expenses: ${raw.expenseEur} EUR`,
      `Remaining: ${Math.round(raw.remainingEur)} EUR`,
      `Goal pace: ${pace}`,
      `Safe cap: ${safeCap} EUR`,
      `Income predictability: ${typeof raw.incomePredictability === "string" ? raw.incomePredictability : "unknown"}`,
    ].join("\n");
    const content = await verdaChat(apiKey, SAVINGS_SYSTEM, user, 1200);
    const parsed = JSON.parse(content) as { amountEur?: unknown; reason?: unknown };
    if (!finiteNumber(parsed.amountEur) || typeof parsed.reason !== "string") {
      sendJson(res, 502, { error: "model failed" });
      return;
    }
    const amountEur = Math.min(safeCap, Math.max(0, Math.round(parsed.amountEur)));
    sendJson(res, 200, { amountEur, reason: clip(parsed.reason), source: VERDA_MODEL });
  } catch {
    if (!res.headersSent && !res.writableEnded) sendJson(res, 502, { error: "model failed" });
  }
}

function selectedAmount(brief: string): string {
  return brief.match(/Selected slice:[^\n]*amount\s+([^\n]+)/)?.[1]?.replace(/\.$/, "").trim() ?? "";
}

/** Used when the model talks about a different slice. Each slice gets its own sentence. */
function directedRecommendation(segment: string, amount: string, brief: string): string {
  const money = amount || "this amount";
  if (segment === "Income") return `Budget the month from this pay of ${money}. What remains after the bills is what you can save.`;
  if (segment === "Fixed") return `Leave the housing and utilities of ${money}. These are regular bills, not a leak.`;
  if (segment === "Left") {
    if (/spent past|shortfall|past the/i.test(brief)) {
      return `Spending passed the pay by ${money}. Next month, keep the bills plus everyday spending under the pay.`;
    }
    return `Part of the ${money} still in the account can be saved. Do not move all of it.`;
  }
  if (segment === "Health") return `Health spending is ${money}. Check whether this was needed care before cutting it.`;
  return `Review your ${segment} spending of ${money} to see if it can be reduced without affecting essential needs.`;
}

function aboutThisSlice(recommendation: string, segment: string): boolean {
  return recommendation.toLowerCase().includes(segment.toLowerCase());
}

function listedPayments(brief: string): { date: string; shop: string; amount: string }[] {
  const block = brief.split("Payments:\n")[1] ?? "";
  return block
    .split("\n")
    .map((line) => {
      const match = line.match(/^(\d{4}-\d{2}-\d{2}) · (.+) · (.+)$/);
      if (!match || line.startsWith("more payments")) return null;
      return { date: match[1], shop: match[2], amount: match[3] };
    })
    .filter((row): row is { date: string; shop: string; amount: string } => row !== null);
}

function euros(amount: string): number {
  const digits = amount.replace(/[^\d,.-]/g, "").replace(/\s/g, "").replace(",", ".");
  const value = Number(digits);
  return Number.isFinite(value) ? value : 0;
}

function asFacts(payments: { date: string; shop: string; amount: string }[]): PaymentFact[] {
  return payments.map((row) => ({ date: row.date, place: row.shop, amountEur: euros(row.amount) }));
}

function isSpecific(recommendation: string, payments: { date: string; shop: string; amount: string }[]): boolean {
  if (/review your|see if|without affecting essential/i.test(recommendation)) return false;
  const text = recommendation.toLowerCase().replace(/\s/g, "");
  return payments.some((row) => text.includes(row.amount.toLowerCase().replace(/\s/g, "")) || text.includes(row.date));
}

function adviceFromModel(content: string) {
  try {
    const parsed = JSON.parse(content) as { summary?: unknown; recommendation?: unknown };
    if (typeof parsed.summary === "string" && typeof parsed.recommendation === "string") {
      return { summary: clip(parsed.summary), recommendation: clip(parsed.recommendation) };
    }
  } catch {
    // The model sometimes answers in the two-line form instead of JSON.
  }
  return parseAdvice(content);
}

function segmentAdvicePlugin(apiKey: string | undefined): Plugin {
  return {
    name: "segment-advice",
    configureServer(server) {
      server.middlewares.use("/api/segment-advice", (req, res) => {
        void handleSegmentAdvice(req, res, apiKey);
      });
    },
  };
}

async function handleSegmentAdvice(req: IncomingMessage, res: ServerResponse, apiKey: string | undefined) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "post only" });
    return;
  }
  if (!apiKey) {
    sendJson(res, 503, { error: "no key" });
    return;
  }
  try {
    const raw = JSON.parse(await readBody(req, 12000)) as { month?: unknown; segment?: unknown; brief?: unknown };
    if (typeof raw.month !== "string" || typeof raw.segment !== "string" || typeof raw.brief !== "string") {
      sendJson(res, 400, { error: "bad request" });
      return;
    }
    if (raw.month.length > 48 || raw.segment.length > 48 || raw.brief.length > 8000) {
      sendJson(res, 400, { error: "bad request" });
      return;
    }
    const response = await fetch(`${AI_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: AI_MODEL,
        temperature: 0.2,
        // The model reasons before answering; a small budget is spent entirely on reasoning.
        max_tokens: 12000,
        messages: [
          { role: "system", content: TRAINER_SYSTEM },
          { role: "user", content: raw.brief },
        ],
      }),
      signal: AbortSignal.timeout(120000),
    });
    if (!response.ok) {
      const detail = (await response.text().catch(() => "")).slice(0, 200);
      console.error(`[segment-advice] Verda returned ${response.status}: ${detail}`);
      sendJson(res, 502, { error: "advice failed" });
      return;
    }
    const advice = parseAdvice(textFromChatCompletion(await response.json()));
    sendJson(res, 200, advice);
  } catch (cause) {
    console.error(`[segment-advice] ${cause instanceof Error ? cause.message : String(cause)}`);
    if (!res.headersSent && !res.writableEnded) sendJson(res, 502, { error: "advice failed" });
  }
}

/** Finished two-agent runs, so the same month and view replays the same answer during a demo. */
const deepCache = new Map<string, { at: number; events: DeepEvent[] }>();
const DEEP_CACHE_MS = 30 * 60 * 1000;

function deepAnalysisPlugin(verdaKey: string | undefined, anthropicKey: string | undefined): Plugin {
  return {
    name: "deep-analysis",
    configureServer(server) {
      server.middlewares.use("/api/deep-analysis", (req, res) => {
        void handleDeepAnalysis(req, res, verdaKey, anthropicKey);
      });
    },
  };
}

/**
 * POST {segment, brief} → NDJSON stream of DeepEvent lines (agents, news, stage, turn, done | failed).
 * Always 200 once started: a missing agent shows up as an event, not as an HTTP error.
 */
async function handleDeepAnalysis(
  req: IncomingMessage,
  res: ServerResponse,
  verdaKey: string | undefined,
  anthropicKey: string | undefined,
) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "post only" });
    return;
  }
  let segment: string;
  let brief: string;
  try {
    const raw = JSON.parse(await readBody(req, 12000)) as { segment?: unknown; brief?: unknown };
    if (typeof raw.segment !== "string" || typeof raw.brief !== "string" || raw.segment.length > 48 || raw.brief.length > 8000) {
      sendJson(res, 400, { error: "bad request" });
      return;
    }
    segment = raw.segment;
    brief = raw.brief;
  } catch {
    sendJson(res, 400, { error: "bad request" });
    return;
  }
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/x-ndjson");
  res.setHeader("Cache-Control", "no-cache");
  const send = (event: DeepEvent) => {
    if (!res.writableEnded) res.write(JSON.stringify(event) + "\n");
  };
  const news = await fetchMoneyNews();
  const key = JSON.stringify([segment, brief, news.map((item) => item.title)]);
  const hit = deepCache.get(key);
  if (hit && Date.now() - hit.at < DEEP_CACHE_MS) {
    hit.events.forEach(send);
    res.end();
    return;
  }
  const events: DeepEvent[] = [];
  try {
    const result = await runDeepAnalysis({
      segment,
      brief,
      news,
      analyst: nemotronAgent(verdaKey),
      reviewer: claudeAgent(anthropicKey),
      // Same rules as the normal overview, so the deep answer is never less careful than it.
      guidance: TRAINER_SYSTEM,
      emit: (event) => {
        events.push(event);
        send(event);
      },
    });
    // Only cache runs where both agents answered; a run with one agent down should retry next time.
    if (result && result.agents.every((agent) => agent.state === "ok")) {
      deepCache.set(key, { at: Date.now(), events: events.filter((e) => e.type !== "stage") });
    }
  } catch {
    send({ type: "failed", agents: [] });
  }
  res.end();
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiKey = process.env.VERDA_INFERENCE_KEY || env.VERDA_INFERENCE_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY || env.ANTHROPIC_API_KEY;
  return {
    // configureServer middlewares run before Vite's proxy, so the three local /api routes are not proxied.
    plugins: [react(), segmentAdvicePlugin(apiKey), savingsCheckPlugin(apiKey), deepAnalysisPlugin(apiKey, anthropicKey)],
    server: { port: 5173, proxy },
    preview: { port: 4173, proxy },
  };
});
