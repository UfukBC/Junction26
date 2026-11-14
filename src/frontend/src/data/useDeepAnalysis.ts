import { useEffect, useState } from "react";
import type { AgentId, AgentInfo, DeepEvent, DeepResult, Stage, Turn } from "../server/deepAnalysis";
import type { NewsItem } from "../server/news";

export type { AgentInfo, DeepResult, Turn } from "../server/deepAnalysis";
export type { NewsItem } from "../server/news";

export interface DeepState {
  /** idle: switched off or no data yet · running · done · failed: no agent could answer. */
  status: "idle" | "running" | "done" | "failed";
  agents: AgentInfo[];
  news: NewsItem[];
  turns: Turn[];
  stage: { stage: Stage; agent: AgentId } | null;
  result: DeepResult | null;
}

const IDLE: DeepState = { status: "idle", agents: [], news: [], turns: [], stage: null, result: null };

/** Finished runs for this page session, so switching Month ↔ Everyday back and forth does not re-run them. */
const finished = new Map<string, DeepState>();

function apply(state: DeepState, event: DeepEvent): DeepState {
  switch (event.type) {
    case "agents":
      return { ...state, agents: event.agents };
    case "news":
      return { ...state, news: event.news };
    case "stage":
      return { ...state, stage: { stage: event.stage, agent: event.agent } };
    case "turn":
      return { ...state, turns: [...state.turns, event.turn] };
    case "done":
      return { ...state, status: "done", stage: null, agents: event.result.agents, result: event.result };
    case "failed":
      return { ...state, status: "failed", stage: null, agents: event.agents.length > 0 ? event.agents : state.agents };
  }
}

/**
 * Runs the two-agent deep analysis on the same brief the normal advice uses.
 * The server streams one JSON event per line; the state updates as each agent finishes a step.
 */
export function useDeepAnalysis(enabled: boolean, segment: string, brief: string | undefined): DeepState {
  const [state, setState] = useState<DeepState>(IDLE);

  useEffect(() => {
    if (!enabled || !brief) {
      setState(IDLE);
      return;
    }
    const key = `${segment}\n${brief}`;
    const cached = finished.get(key);
    if (cached) {
      setState(cached);
      return;
    }
    const controller = new AbortController();
    let current: DeepState = { ...IDLE, status: "running" };
    setState(current);
    const run = async () => {
      const response = await fetch("/api/deep-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segment, brief }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) throw new Error("deep analysis failed");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          current = apply(current, JSON.parse(line) as DeepEvent);
          setState(current);
        }
        if (done) break;
      }
      if (current.status === "running") {
        current = { ...current, status: "failed", stage: null };
        setState(current);
      }
      // An agent that was offline may be back next time, so only keep runs where nothing failed.
      if (current.status === "done" && !current.agents.some((agent) => agent.state === "offline")) {
        finished.set(key, current);
      }
    };
    run().catch(() => {
      if (controller.signal.aborted) return;
      current = { ...current, status: "failed", stage: null };
      setState(current);
    });
    return () => controller.abort();
  }, [enabled, segment, brief]);

  return state;
}
