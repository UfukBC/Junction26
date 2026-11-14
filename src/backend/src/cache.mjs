/* In-memory response cache: the same request returns the same text without another provider call,
 * which keeps the demo deterministic and cheap. Cleared on restart or via POST /api/cache/clear.
 */

import { createHash } from "node:crypto";

export function cacheKey({ provider, model, system, prompt, maxTokens }) {
  return createHash("sha256").update(JSON.stringify([provider, model, system, prompt, maxTokens])).digest("hex");
}

export function createCache() {
  const entries = new Map();
  return {
    get size() {
      return entries.size;
    },
    get(key) {
      return entries.has(key) ? entries.get(key) : null;
    },
    set(key, value) {
      entries.set(key, value);
    },
    clear() {
      const cleared = entries.size;
      entries.clear();
      return cleared;
    },
  };
}
