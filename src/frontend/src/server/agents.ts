/**
 * The two deep-analysis agents. Dev-server only (keys never reach the browser).
 * Analyst: Nemotron 3.5 Super on DataCrunch. Reviewer: Claude Opus 5.5 on the Anthropic API.
 * A missing key gives an agent with `call: null`, shown as "not configured"; a failed call marks it offline.
 */
import Anthropic from "@anthropic-ai/sdk";
import { AgentNotConfigured, type Agent } from "./deepAnalysis";
import { VERDA_MODEL, verdaChat } from "./verda";

export const REVIEWER_MODEL = "claude-opus-5-5";

/** Per call; matches the segment-advice timeout, since Nemotron's reasoning can take a while. */
const CALL_TIMEOUT_MS = 120000;

export function nemotronAgent(apiKey: string | undefined): Agent {
  return {
    model: VERDA_MODEL,
    label: "Nemotron 3.5 Super",
    // Nemotron reasons before it answers; a small budget is spent entirely on reasoning (same as segment-advice).
    call: apiKey ? (system, user) => verdaChat(apiKey, system, user, 12000, CALL_TIMEOUT_MS) : null,
  };
}

export function claudeAgent(apiKey: string | undefined): Agent {
  let client: Anthropic | null = null;
  try {
    // Without a key the SDK can still find an `ant auth login` profile; if it finds nothing it throws here.
    client = new Anthropic({ ...(apiKey ? { apiKey } : {}), timeout: CALL_TIMEOUT_MS, maxRetries: 1 });
  } catch {
    client = null;
  }
  const ready = client;
  return {
    model: REVIEWER_MODEL,
    label: "Claude Opus 5.5",
    call: ready
      ? async (system, user, schema) => {
          let response: Anthropic.Beta.BetaMessage;
          try {
            response = await ready.beta.messages.create({
              model: REVIEWER_MODEL,
              max_tokens: 16000,
              // A safety decline is re-run on Anthropic's recommended fallback model instead of failing the review.
              betas: ["server-side-fallback-2026-07-01"],
              fallbacks: "default",
              output_config: { effort: "medium", format: { type: "json_schema", schema } },
              system,
              messages: [{ role: "user", content: user }],
            });
          } catch (error) {
            // No key and no `ant auth login` profile: the SDK fails before sending anything.
            if (!(error instanceof Anthropic.APIError) && /resolve authentication/i.test(String(error))) {
              throw new AgentNotConfigured("no Anthropic credentials");
            }
            throw error;
          }
          if (response.stop_reason === "refusal") throw new Error("refused");
          const text = response.content
            .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
            .map((block) => block.text)
            .join("");
          if (!text.trim()) throw new Error("empty");
          return text;
        }
      : null,
  };
}
