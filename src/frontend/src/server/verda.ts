/**
 * Nemotron on DataCrunch (Verda). Dev-server only: imported by vite.config.ts and the deep-analysis agents,
 * never by browser code, so the key stays on the server.
 */
export const VERDA_BASE = "https://containers.datacrunch.io/nemotron-3-5-super-vl-b300/v1";
export const VERDA_MODEL = "nemotron-3.5-super-vl";

/**
 * One chat call. Returns the JSON object text from the reply.
 * The model spends tokens on a reasoning field first, then puts JSON in `content`; `content` wins when present.
 */
export async function verdaChat(
  apiKey: string,
  system: string,
  user: string,
  maxTokens: number,
  timeoutMs = 120000,
): Promise<string> {
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
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error("model failed");
  const data = (await response.json()) as {
    choices?: { message?: { content?: string; reasoning?: string; reasoning_content?: string } }[];
  };
  const message = data.choices?.[0]?.message;
  const content = (message?.content || "").trim();
  const reasoning = (message?.reasoning || message?.reasoning_content || "").trim();
  const raw = (content || reasoning).replace(/```json|```/g, "");
  const json = raw.match(/\{[\s\S]*\}/)?.[0]?.trim() ?? "";
  if (!json) throw new Error("empty");
  return json;
}
