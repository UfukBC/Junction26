import type { IncomingMessage, ServerResponse } from "node:http";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const TRAINER_SYSTEM = [
  "You are a calm personal-finance trainer in a Finnish mobile bank.",
  "Use only the figures in the user message. Do not invent transactions.",
  "Fixed means housing and utilities: do not recommend cutting them.",
  "Health may be necessary care: say to check it before calling it a leak.",
  "Everyday spending is the leak basket.",
  "Reply in exactly two lines:",
  "Summary: <one sentence, max 28 words>",
  "Recommendation: <one sentence, max 28 words>",
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

function textFromResponse(data: {
  output_text?: string;
  output?: { content?: { type?: string; text?: string }[] }[];
}) {
  if (typeof data.output_text === "string" && data.output_text.trim()) return data.output_text;
  const parts: string[] = [];
  for (const item of data.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && content.text) parts.push(content.text);
    }
  }
  return parts.join("\n");
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
    const response = await fetch("https://api.x.ai/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.7",
        store: false,
        input: [
          { role: "system", content: TRAINER_SYSTEM },
          { role: "user", content: raw.brief },
        ],
      }),
      signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) {
      sendJson(res, 502, { error: "advice failed" });
      return;
    }
    const advice = parseAdvice(textFromResponse(await response.json()));
    sendJson(res, 200, advice);
  } catch {
    if (!res.headersSent && !res.writableEnded) sendJson(res, 502, { error: "advice failed" });
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), segmentAdvicePlugin(process.env.XAI_API_KEY || env.XAI_API_KEY)],
    server: { port: 5173 },
  };
});
