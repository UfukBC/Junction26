/* Server configuration: .env loading, provider selection, limits.
 *
 * The key never reaches the browser: only this server reads it.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SRC_DIR = dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = resolve(SRC_DIR, "..");
const REPO_ROOT = resolve(BACKEND_DIR, "..", "..");

export const LIMITS = {
  /** Raw request body cap. */
  bodyBytes: 32 * 1024,
  /** Built prompt cap, checked before a provider call. */
  promptChars: 12_000,
  /** System prompt is small and fixed; cap anyway. */
  systemChars: 2_000,
};

export const PROVIDERS = {
  openai: { keyEnv: "OPENAI_API_KEY", defaultModel: "gpt-4o-mini" },
  anthropic: { keyEnv: "ANTHROPIC_API_KEY", defaultModel: "claude-3-5-haiku-latest" },
  xai: { keyEnv: "XAI_API_KEY", defaultModel: "grok-4.7" },
  mock: { keyEnv: null, defaultModel: "mock" },
};

/** Reads KEY=value lines without overwriting variables already in the environment. */
export function loadEnvFiles() {
  for (const file of [resolve(BACKEND_DIR, ".env"), resolve(REPO_ROOT, ".env")]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (!match) continue;
      const [, key, raw] = match;
      if (process.env[key] !== undefined) continue;
      process.env[key] = raw.replace(/^(["\'])(.*)\1$/, "$2");
    }
  }
}

function positiveInt(raw, fallback) {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
}

/**
 * Resolves the provider from the environment. `AI_PROVIDER` wins; otherwise the first
 * provider with a key is used, and with no key at all the server falls back to mock.
 */
export function resolveConfig(env = process.env) {
  const requested = (env.AI_PROVIDER || "").trim().toLowerCase();
  let name = requested;
  if (!name) {
    name =
      Object.keys(PROVIDERS).find((candidate) => candidate !== "mock" && env[PROVIDERS[candidate].keyEnv]) ?? "mock";
  }
  if (!(name in PROVIDERS)) {
    throw new Error(`Unknown AI_PROVIDER "${name}". Use one of: ${Object.keys(PROVIDERS).join(", ")}.`);
  }
  const spec = PROVIDERS[name];
  const apiKey = spec.keyEnv ? (env[spec.keyEnv] || "").trim() : "";
  if (spec.keyEnv && !apiKey) {
    throw new Error(`AI_PROVIDER=${name} needs ${spec.keyEnv}. Set it in src/backend/.env or use AI_PROVIDER=mock.`);
  }
  return {
    provider: name,
    model: (env.AI_MODEL || "").trim() || spec.defaultModel,
    apiKey,
    port: positiveInt(env.PORT, 8787),
    timeoutMs: positiveInt(env.AI_TIMEOUT_MS, 25_000),
    maxTokens: positiveInt(env.AI_MAX_TOKENS, 400),
  };
}
