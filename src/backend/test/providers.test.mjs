import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { createProvider, ProviderError } from "../src/providers.mjs";

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

function stubFetch(handler) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    return handler(url, init);
  };
  return calls;
}

function config(provider, model) {
  return { provider, model, apiKey: "test-key", port: 0, timeoutMs: 1000, maxTokens: 120 };
}

test("openai adapter sends a system/user chat request and reads the message", async () => {
  const calls = stubFetch(() => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: "  hello  " } }] }),
  }));
  const provider = createProvider(config("openai", "gpt-4o-mini"));
  const text = await provider.generate({ system: "rules", prompt: "data", maxTokens: 120 });

  assert.equal(text, "hello");
  assert.equal(calls[0].url, "https://api.openai.com/v1/chat/completions");
  assert.equal(calls[0].init.headers.Authorization, "Bearer test-key");
  assert.deepEqual(calls[0].body.messages, [
    { role: "system", content: "rules" },
    { role: "user", content: "data" },
  ]);
});

test("anthropic adapter uses its own headers and joins text blocks", async () => {
  const calls = stubFetch(() => ({
    ok: true,
    json: async () => ({ content: [{ type: "text", text: "a" }, { type: "tool_use" }, { type: "text", text: "b" }] }),
  }));
  const provider = createProvider(config("anthropic", "claude-3-5-haiku-latest"));
  const text = await provider.generate({ system: "rules", prompt: "data", maxTokens: 120 });

  assert.equal(text, "a\nb");
  assert.equal(calls[0].url, "https://api.anthropic.com/v1/messages");
  assert.equal(calls[0].init.headers["x-api-key"], "test-key");
  assert.equal(calls[0].init.headers["anthropic-version"], "2023-06-01");
  assert.equal(calls[0].body.system, "rules");
});

test("xai adapter reads both output_text and output parts", async () => {
  const calls = stubFetch(() => ({ ok: true, json: async () => ({ output_text: "hi" }) }));
  const provider = createProvider(config("xai", "grok-4.7"));
  assert.equal(await provider.generate({ system: "s", prompt: "p", maxTokens: 10 }), "hi");
  assert.equal(calls[0].url, "https://api.x.ai/v1/responses");

  stubFetch(() => ({ ok: true, json: async () => ({ output: [{ content: [{ type: "output_text", text: "part" }] }] }) }));
  assert.equal(await createProvider(config("xai", "grok-4.7")).generate({ system: "s", prompt: "p", maxTokens: 10 }), "part");
});

test("mock adapter returns the supplied text and needs one", async () => {
  const provider = createProvider(config("mock", "mock"));
  assert.equal(await provider.generate({ system: "s", prompt: "p", maxTokens: 10, mock: "template" }), "template");
  await assert.rejects(() => provider.generate({ system: "s", prompt: "p", maxTokens: 10 }), ProviderError);
});

test("provider HTTP errors and timeouts become ProviderError codes", async () => {
  stubFetch(() => ({ ok: false, status: 429, text: async () => "slow down" }));
  await assert.rejects(
    () => createProvider(config("openai", "m")).generate({ system: "s", prompt: "p", maxTokens: 10 }),
    (cause) => cause instanceof ProviderError && cause.code === "provider_error" && /429/.test(cause.message),
  );

  globalThis.fetch = async () => {
    const error = new Error("timed out");
    error.name = "TimeoutError";
    throw error;
  };
  await assert.rejects(
    () => createProvider(config("anthropic", "m")).generate({ system: "s", prompt: "p", maxTokens: 10 }),
    (cause) => cause instanceof ProviderError && cause.code === "timeout",
  );
});

test("empty provider output is an error", async () => {
  stubFetch(() => ({ ok: true, json: async () => ({ choices: [{ message: { content: "   " } }] }) }));
  await assert.rejects(
    () => createProvider(config("openai", "m")).generate({ system: "s", prompt: "p", maxTokens: 10 }),
    ProviderError,
  );
});
