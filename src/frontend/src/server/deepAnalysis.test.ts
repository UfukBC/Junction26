import { describe, expect, it } from "vitest";
import {
  AgentNotConfigured,
  runDeepAnalysis,
  unsupportedFigures,
  type Agent,
  type AgentCall,
  type DeepEvent,
} from "./deepAnalysis";
import { moneyNewsFromRss } from "./news";

const BRIEF = [
  "This is the whole month.",
  "Summary so far: September 2026: income 2 400,00 €. Fixed bills 900,00 € (38% of income). Everyday 1 100,00 € (46%). 400,00 € left.",
].join("\n");

const GOOD = { summary: "Income was 2 400 €, fixed bills 900 € (38%).", recommendation: "Move 200 € of the 400 € left to savings." };
const WRONG = { summary: "Income was 3 100 €.", recommendation: "Move 200 € to savings." };

/** A fake agent that answers from a script, one reply per call; `throw` makes that call fail. */
function scripted(replies: (object | "throw")[], log?: string[]): AgentCall {
  let index = 0;
  return async (system) => {
    log?.push(system.slice(0, 20));
    const next = replies[index++];
    if (next === undefined || next === "throw") throw new Error("down");
    return JSON.stringify(next);
  };
}

function agent(call: AgentCall | null, label = "Test model"): Agent {
  return { model: label.toLowerCase(), label, call };
}

async function run(analyst: Agent, reviewer: Agent) {
  const events: DeepEvent[] = [];
  const result = await runDeepAnalysis({ segment: "Month overview", brief: BRIEF, news: [], analyst, reviewer, emit: (e) => events.push(e) });
  return { result, events };
}

describe("runDeepAnalysis", () => {
  it("is verified when the reviewer agrees on the first look", async () => {
    const { result } = await run(
      agent(scripted([GOOD])),
      agent(scripted([{ verdict: "correct", issues: [], ...GOOD }])),
    );
    expect(result?.verdict).toBe("verified");
    expect(result?.answer).toEqual(GOOD);
    expect(result?.agents.map((a) => a.state)).toEqual(["ok", "ok"]);
    expect(result?.unsupportedFigures).toEqual([]);
  });

  it("discusses a wrong answer and ends corrected", async () => {
    const { result } = await run(
      agent(scripted([WRONG, { reply: "You are right, income was 2 400 €.", ...GOOD }])),
      agent(
        scripted([
          { verdict: "incorrect", issues: ["Income is 2 400 €, not 3 100 €."], ...GOOD },
          { verdict: "correct", issues: [], ...GOOD },
        ]),
      ),
    );
    expect(result?.verdict).toBe("corrected");
    expect(result?.answer).toEqual(GOOD);
    expect(result?.turns.map((t) => `${t.agent}:${t.kind}`)).toEqual([
      "analyst:answer",
      "reviewer:review",
      "analyst:reply",
      "reviewer:review",
    ]);
  });

  it("tells the reviewer which figures the code could not find", async () => {
    const prompts: string[] = [];
    const reviewer: AgentCall = async (_system, user) => {
      prompts.push(user);
      return JSON.stringify({ verdict: "correct", issues: [], ...WRONG });
    };
    await run(agent(scripted([WRONG])), agent(reviewer));
    expect(prompts[0]).toContain("not found in the data: 3100");
  });

  it("when they never agree, shows the version the data supports", async () => {
    const { result } = await run(
      agent(scripted([GOOD, { reply: "My figures are right.", ...GOOD }])),
      agent(
        scripted([
          { verdict: "incorrect", issues: ["Income is 3 100 €."], ...WRONG },
          { verdict: "incorrect", issues: ["Income is 3 100 €."], ...WRONG },
        ]),
      ),
    );
    expect(result?.verdict).toBe("disputed");
    expect(result?.answer).toEqual(GOOD);
  });

  it("still answers when the reviewer is down, and says it is unchecked", async () => {
    const { result } = await run(agent(scripted([GOOD])), agent(scripted(["throw"]), "Reviewer model"));
    expect(result?.verdict).toBe("unchecked");
    expect(result?.answer).toEqual(GOOD);
    expect(result?.agents.map((a) => a.state)).toEqual(["ok", "offline"]);
  });

  it("lets the reviewer answer alone when the analyst is down", async () => {
    const { result } = await run(agent(scripted(["throw"])), agent(scripted([GOOD])));
    expect(result?.verdict).toBe("unchecked");
    expect(result?.answer).toEqual(GOOD);
    expect(result?.agents.map((a) => a.state)).toEqual(["offline", "ok"]);
  });

  it("marks an agent without a key as not configured and never calls it", async () => {
    const { result, events } = await run(agent(scripted([GOOD])), agent(null));
    expect(result?.agents.map((a) => a.state)).toEqual(["ok", "not-configured"]);
    expect(events[0]).toMatchObject({ type: "agents" });
  });

  it("keeps the reviewer's fix when the analyst drops out mid-discussion", async () => {
    const { result } = await run(
      agent(scripted([WRONG, "throw"])),
      agent(scripted([{ verdict: "incorrect", issues: ["Income is 2 400 €."], ...GOOD }])),
    );
    expect(result?.verdict).toBe("corrected");
    expect(result?.answer).toEqual(GOOD);
    expect(result?.agents.map((a) => a.state)).toEqual(["offline", "ok"]);
  });

  it("shows an agent whose call finds no credentials as not configured, not offline", async () => {
    const noCredentials: AgentCall = async () => {
      throw new AgentNotConfigured("no key");
    };
    const { result } = await run(agent(scripted([GOOD])), agent(noCredentials));
    expect(result?.agents.map((a) => a.state)).toEqual(["ok", "not-configured"]);
    expect(result?.verdict).toBe("unchecked");
  });

  it("returns null and a failed event when no agent answers", async () => {
    const { result, events } = await run(agent(scripted(["throw"])), agent(null));
    expect(result).toBeNull();
    expect(events[events.length - 1]).toMatchObject({ type: "failed" });
  });

  it("gives both agents the house rules when guidance is passed", async () => {
    const systems: string[] = [];
    const spy: AgentCall = async (system) => {
      systems.push(system);
      return JSON.stringify(systems.length === 1 ? GOOD : { verdict: "correct", issues: [], ...GOOD });
    };
    await runDeepAnalysis({
      segment: "Month overview",
      brief: BRIEF,
      news: [],
      analyst: agent(spy),
      reviewer: agent(spy),
      emit: () => {},
      guidance: "Never suggest cutting health care.",
    });
    expect(systems).toHaveLength(2);
    for (const system of systems) expect(system).toContain("Never suggest cutting health care.");
  });

  it("treats a reply that is not JSON as the agent being down", async () => {
    const { result } = await run(agent(async () => "sorry, no"), agent(scripted([GOOD])));
    expect(result?.agents[0].state).toBe("offline");
    expect(result?.verdict).toBe("unchecked");
  });
});

describe("unsupportedFigures", () => {
  it("accepts rounded figures and Finnish number formats", () => {
    expect(unsupportedFigures({ summary: "About 1 100 € on everyday, 46 %.", recommendation: "" }, BRIEF)).toEqual([]);
  });
  it("flags invented figures and dates", () => {
    expect(unsupportedFigures({ summary: "You spent 5 000 € on 2026-09-14.", recommendation: "" }, BRIEF)).toEqual([
      "5000",
      "2026-09-14",
    ]);
  });
});

describe("moneyNewsFromRss", () => {
  it("keeps money stories and drops the rest", () => {
    const xml = `<rss><channel>
      <item><title>Nato talks continue</title><description>Diplomats met.</description><category>Foreign policy</category><link>https://yle.fi/a/1?origin=rss</link></item>
      <item><title>Crypto tax gap grows</title><description>Tax &amp; revenue.</description><category>Taxation</category><link>https://yle.fi/a/2?origin=rss</link><pubDate>Fri, 13 Nov 2026</pubDate></item>
      <item><title>Electricity price spikes</title><description>Cold weather.</description><category>Weather</category><link>https://yle.fi/a/3</link></item>
    </channel></rss>`;
    const items = moneyNewsFromRss(xml);
    expect(items.map((item) => item.title)).toEqual(["Crypto tax gap grows", "Electricity price spikes"]);
    expect(items[0]).toMatchObject({ description: "Tax & revenue.", link: "https://yle.fi/a/2" });
  });
});
