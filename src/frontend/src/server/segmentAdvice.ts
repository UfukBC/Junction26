/**
 * The one-model overview prompt, shared by the dev server (`vite.config.ts`) and the static
 * precache script (`scripts/precache-advice.ts`), so a precached answer is produced by exactly the
 * same code path as one generated live. Dev/build-time only: it talks to Verda with the server key.
 */
import { VERDA_BASE, VERDA_MODEL } from "./verda";

export const TRAINER_SYSTEM = [
  "You are Aino, a personal financial advisor in a Finnish mobile bank. You speak to this one customer, in plain English, about their own figures only. Do not invent payments or amounts.",
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

function clip(value: string) {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > 320 ? clean.slice(0, 317) + "…" : clean;
}

/** Accepts the requested JSON shape (also inside prose) and a plain "Summary:\nRecommendation:" reply. */
export function parseAdvice(text: string): { summary: string; recommendation: string } {
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

/** One overview call. Throws on a transport error or an unparseable answer. */
export async function requestSegmentAdvice(
  apiKey: string,
  brief: string,
  timeoutMs = 120000,
): Promise<{ summary: string; recommendation: string }> {
  const response = await fetch(`${VERDA_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: VERDA_MODEL,
      temperature: 0.2,
      // The model reasons before answering; a small budget is spent entirely on reasoning.
      max_tokens: 12000,
      messages: [
        { role: "system", content: TRAINER_SYSTEM },
        { role: "user", content: brief },
      ],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 200);
    throw new Error(`Verda returned ${response.status}: ${detail}`);
  }
  const data = (await response.json()) as { choices?: { message?: { content?: string | null } }[] };
  return parseAdvice((data.choices?.[0]?.message?.content ?? "").trim());
}
