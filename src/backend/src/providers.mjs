/* Provider-agnostic text generation.
 *
 * One interface for every provider:
 *   generate({ system, prompt, maxTokens }) -> Promise<string>
 *
 * The optional `mock` field is deterministic template text built by the endpoint; the mock
 * provider returns it verbatim, the real providers ignore it. Switching provider or model is
 * env-only (`AI_PROVIDER`, `AI_MODEL`).
 */

export class ProviderError extends Error {
  constructor(message, code = "provider_error") {
    super(message);
    this.name = "ProviderError";
    this.code = code;
  }
}

function timeoutSignal(ms) {
  return AbortSignal.timeout(ms);
}

async function postJson(url, headers, body, config) {
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: timeoutSignal(config.timeoutMs),
    });
  } catch (cause) {
    if (cause?.name === "TimeoutError" || cause?.name === "AbortError") {
      throw new ProviderError(`provider timed out after ${config.timeoutMs} ms`, "timeout");
    }
    throw new ProviderError(`provider unreachable: ${cause?.message ?? String(cause)}`);
  }
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 300).replace(/\s+/g, " ");
    throw new ProviderError(`provider returned ${response.status}${detail ? `: ${detail}` : ""}`);
  }
  try {
    return await response.json();
  } catch {
    throw new ProviderError("provider returned invalid JSON");
  }
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

const adapters = {
  mock: {
    async generate({ mock }) {
      if (!mock) throw new ProviderError("mock provider has no narration for this request", "internal");
      return mock;
    },
  },

  openai: {
    async generate({ system, prompt, maxTokens }, config) {
      const data = await postJson(
        "https://api.openai.com/v1/chat/completions",
        { Authorization: `Bearer ${config.apiKey}` },
        {
          model: config.model,
          temperature: 0,
          max_tokens: maxTokens,
          messages: [
            { role: "system", content: system },
            { role: "user", content: prompt },
          ],
        },
        config,
      );
      const output = text(data?.choices?.[0]?.message?.content);
      if (!output) throw new ProviderError("provider returned an empty response");
      return output;
    },
  },

  anthropic: {
    async generate({ system, prompt, maxTokens }, config) {
      const data = await postJson(
        "https://api.anthropic.com/v1/messages",
        { "x-api-key": config.apiKey, "anthropic-version": "2023-06-01" },
        {
          model: config.model,
          temperature: 0,
          max_tokens: maxTokens,
          system,
          messages: [{ role: "user", content: prompt }],
        },
        config,
      );
      const output = (Array.isArray(data?.content) ? data.content : [])
        .map((part) => (part?.type === "text" ? text(part.text) : ""))
        .filter(Boolean)
        .join("\n");
      if (!output) throw new ProviderError("provider returned an empty response");
      return output;
    },
  },

  xai: {
    async generate({ system, prompt, maxTokens }, config) {
      const data = await postJson(
        "https://api.x.ai/v1/responses",
        { Authorization: `Bearer ${config.apiKey}` },
        {
          model: config.model,
          store: false,
          max_output_tokens: maxTokens,
          input: [
            { role: "system", content: system },
            { role: "user", content: prompt },
          ],
        },
        config,
      );
      const parts = [];
      if (typeof data?.output_text === "string") parts.push(text(data.output_text));
      for (const item of Array.isArray(data?.output) ? data.output : []) {
        for (const content of Array.isArray(item?.content) ? item.content : []) {
          if (content?.type === "output_text" && text(content.text)) parts.push(text(content.text));
        }
      }
      const output = parts.filter(Boolean).join("\n");
      if (!output) throw new ProviderError("provider returned an empty response");
      return output;
    },
  },
};

/** Builds a provider bound to the resolved config. */
export function createProvider(config) {
  const adapter = adapters[config.provider];
  if (!adapter) throw new Error(`No adapter for provider "${config.provider}".`);
  return {
    name: config.provider,
    model: config.model,
    generate: (request) => adapter.generate(request, config),
  };
}
