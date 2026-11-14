import type { IncomingMessage, ServerResponse } from "node:http";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { ADVISOR_NAME, ADVISOR_VOICE, adviceFromPayments, type PaymentFact } from "./src/data/advisor";

const VERDA_BASE = "https://containers.datacrunch.io/nemotron-3-5-super-vl-b300/v1";
const VERDA_MODEL = "nemotron-3.5-super-vl";

const TRAINER_SYSTEM = [
  ADVISOR_VOICE,
  "summary states the facts in one or two sentences. Use only the figures given.",
  "recommendation is one next step that uses a figure from the summary. Do not say only \"review your spending\".",
  'Reply with JSON only: {"summary": string, "recommendation": string}',
].join(" ");

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

function parseAdvice(text: string) {
  const summary = text.match(/Summary:\s*([\s\S]+?)(?:\n+\s*Recommendation:|$)/i)?.[1]?.trim();
  const recommendation = text.match(/Recommendation:\s*([\s\S]+)/i)?.[1]?.trim();
  if (!summary || !recommendation) throw new Error("shape");
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

async function verdaChat(apiKey: string, system: string, user: string, maxTokens: number): Promise<string> {
  const response = await fetch(`${VERDA_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: VERDA_MODEL,
      temperature: 0.2,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(120000),
  });
  if (!response.ok) throw new Error("model failed");
  const data = (await response.json()) as {
    choices?: { message?: { content?: string; reasoning_content?: string } }[];
  };
  const message = data.choices?.[0]?.message;
  const content = (message?.content || "").trim();
  const reasoning = (message?.reasoning || message?.reasoning_content || "").trim();
  const raw = (content || reasoning).replace(/```json|```/g, "");
  const json = raw.match(/\{[\s\S]*\}/)?.[0]?.trim() ?? "";
  if (!json) throw new Error("empty");
  return json;
}

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
    const content = await verdaChat(
      apiKey,
      TRAINER_SYSTEM,
      `Selected: ${raw.segment}\nWrite a summary and one recommendation about ${raw.segment}.\n${raw.brief}`,
      1200,
    );
    let summary = "";
    let recommendation = "";
    try {
      const parsed = JSON.parse(content) as { summary?: unknown; recommendation?: unknown };
      if (typeof parsed.summary === "string") summary = clip(parsed.summary);
      if (typeof parsed.recommendation === "string") recommendation = clip(parsed.recommendation);
    } catch {
      summary = clip(content);
    }
    const payments = listedPayments(raw.brief);
    if (!summary || /review your|see if|without affecting essential/i.test(summary)) {
      summary = payments.length > 0 ? adviceFromPayments(raw.segment, asFacts(payments)) : "";
    }
    if (!summary) {
      sendJson(res, 502, { error: "advice failed" });
      return;
    }
    sendJson(res, 200, { summary, recommendation, source: VERDA_MODEL });
  } catch {
    if (!res.headersSent && !res.writableEnded) sendJson(res, 502, { error: "advice failed" });
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiKey = process.env.VERDA_INFERENCE_KEY || env.VERDA_INFERENCE_KEY;
  return {
    plugins: [react(), segmentAdvicePlugin(apiKey), savingsCheckPlugin(apiKey)],
    server: { port: 5173 },
  };
});
