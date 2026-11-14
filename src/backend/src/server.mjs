/* Local AI narration server. JSON in, JSON out; no dependencies beyond Node 18+ `fetch`.
 *
 *   npm run dev     # node --watch src/server.mjs, default port 8787
 *
 * The frontend calls these through the Vite proxy (`/api` -> this server), so the provider key
 * never leaves the machine.
 */

import { createServer as createHttpServer } from "node:http";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { cacheKey, createCache } from "./cache.mjs";
import { LIMITS, loadEnvFiles, resolveConfig } from "./config.mjs";
import { endpoints } from "./endpoints.mjs";
import { TASKS, systemPrompt } from "./prompts.mjs";
import { createProvider, ProviderError } from "./providers.mjs";
import { BadRequest } from "./validate.mjs";

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };

class PayloadTooLarge extends Error {
  constructor() {
    super(`request body exceeds ${LIMITS.bodyBytes} bytes`);
    this.status = 413;
    this.code = "payload_too_large";
  }
}

function sendJson(res, status, body) {
  res.writeHead(status, JSON_HEADERS);
  res.end(JSON.stringify(body));
}

function fail(res, status, code, message) {
  sendJson(res, status, { error: { code, message } });
}

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    let chunks = [];
    let size = 0;
    let oversized = false;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > LIMITS.bodyBytes) {
        // Stop buffering but keep draining, so the client can still read the 413 reply.
        oversized = true;
        chunks = [];
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => (oversized ? reject(new PayloadTooLarge()) : resolveBody(Buffer.concat(chunks).toString("utf8"))));
    req.on("error", reject);
  });
}

function parseJson(raw) {
  if (!raw.trim()) throw new BadRequest("request body must be JSON");
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
    return parsed;
  } catch {
    throw new BadRequest("request body must be a JSON object");
  }
}

/** The home pie expects { summary, recommendation }; the model is asked for two labelled lines. */
function parseAdvice(text) {
  const summary = text.match(/Summary:\s*([\s\S]+?)(?:\n+\s*Recommendation:|$)/i)?.[1]?.trim();
  const recommendation = text.match(/Recommendation:\s*([\s\S]+)/i)?.[1]?.trim();
  if (!summary || !recommendation) throw new ProviderError("provider reply did not contain Summary and Recommendation");
  return { summary, recommendation };
}

const AI_ROUTES = {
  "/api/ai/overview": { endpoint: endpoints["ai/overview"], task: "overview" },
  "/api/ai/month-summary": { endpoint: endpoints["ai/month-summary"], task: "month-summary" },
  "/api/ai/category": { endpoint: endpoints["ai/category"], task: "category" },
  "/api/ai/insight": { endpoint: endpoints["ai/insight"], task: "insight" },
  "/api/ai/what-if": { endpoint: endpoints["ai/what-if"], task: "what-if" },
  "/api/segment-advice": { endpoint: endpoints.segmentAdvice, task: "segment-advice" },
};

const ENDPOINTS = Object.keys(AI_ROUTES).map((path) => `POST ${path}`);

export function createServer(config) {
  const provider = createProvider(config);
  const cache = createCache();

  async function handle(req, res) {
    const path = new URL(req.url ?? "/", "http://localhost").pathname;

    if (path === "/api/health") {
      if (req.method !== "GET") return fail(res, 405, "method_not_allowed", "use GET");
      return sendJson(res, 200, {
        ok: true,
        provider: provider.name,
        model: provider.model,
        cacheEntries: cache.size,
        endpoints: ENDPOINTS,
      });
    }

    if (path === "/api/cache/clear") {
      if (req.method !== "POST") return fail(res, 405, "method_not_allowed", "use POST");
      return sendJson(res, 200, { cleared: cache.clear() });
    }

    const route = AI_ROUTES[path];
    if (!route) return fail(res, 404, "not_found", `no route for ${path}`);
    if (req.method !== "POST") return fail(res, 405, "method_not_allowed", "use POST");

    try {
      const body = parseJson(await readBody(req));
      const input = route.endpoint.validate(body);
      const system = route.task === "segment-advice" ? TASKS["segment-advice"] : systemPrompt(input.language);
      if (system.length > LIMITS.systemChars) throw new Error("system prompt exceeds the cap");
      const prompt = route.endpoint.prompt(input);
      if (prompt.length > LIMITS.promptChars) {
        throw new BadRequest(`request is too large once formatted (limit ${LIMITS.promptChars} characters)`);
      }

      const key = cacheKey({
        provider: provider.name,
        model: provider.model,
        system,
        prompt,
        maxTokens: config.maxTokens,
      });
      let text = cache.get(key);
      if (text === null) {
        text = await provider.generate({ system, prompt, maxTokens: config.maxTokens, mock: route.endpoint.mock(input) });
        cache.set(key, text);
      }

      return sendJson(res, 200, route.task === "segment-advice" ? parseAdvice(text) : { text });
    } catch (cause) {
      if (cause instanceof BadRequest) return fail(res, 400, "bad_request", cause.message);
      if (cause instanceof PayloadTooLarge) return fail(res, 413, cause.code, cause.message);
      if (cause instanceof ProviderError) {
        const status = cause.code === "timeout" ? 504 : 502;
        return fail(res, status, cause.code, cause.message);
      }
      console.error("[backend] unexpected error:", cause);
      return fail(res, 500, "internal_error", "the narration service failed");
    }
  }

  const server = createHttpServer((req, res) => {
    const started = Date.now();
    res.on("finish", () => {
      console.log(`[backend] ${req.method} ${req.url} -> ${res.statusCode} (${Date.now() - started} ms)`);
    });
    handle(req, res).catch((cause) => {
      console.error("[backend] unhandled:", cause);
      if (!res.headersSent) fail(res, 500, "internal_error", "the narration service failed");
    });
  });

  return { server, cache, provider };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  loadEnvFiles();
  let config;
  try {
    config = resolveConfig();
  } catch (cause) {
    console.error(`[backend] configuration error: ${cause.message}`);
    process.exit(1);
  }
  const { server } = createServer(config);
  server.listen(config.port, "127.0.0.1", () => {
    console.log(`[backend] listening on http://127.0.0.1:${config.port} (provider: ${config.provider}, model: ${config.model})`);
    if (config.provider === "mock") {
      console.log("[backend] mock provider: deterministic template text, no key needed. Set a key in src/backend/.env for real narration.");
    }
  });
}
