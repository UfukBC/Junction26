import type { IncomingMessage, ServerResponse } from "node:http";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const TRAINER_SYSTEM = [
  "You are a calm personal-finance trainer in a Finnish mobile bank.",
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
    const raw = JSON.parse(await readBody(req)) as { month?: unknown; segment?: unknown; brief?: unknown };
    if (typeof raw.month !== "string" || typeof raw.segment !== "string" || typeof raw.brief !== "string") {
      sendJson(res, 400, { error: "bad request" });
      return;
    }
    if (raw.month.length > 48 || raw.segment.length > 48 || raw.brief.length > 2500) {
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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiKey = process.env.VERDA_INFERENCE_KEY || env.VERDA_INFERENCE_KEY;
  return {
    plugins: [react(), segmentAdvicePlugin(apiKey)],
    server: { port: 5173 },
  };
});
