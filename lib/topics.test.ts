import { describe, it, expect } from "vitest";
import { AI_TOPICS, matchTopic, type Topic } from "@/lib/topics";

const gptFive = AI_TOPICS.find((t) => t.id === "gpt-5") as Topic;
const agentsTopic = AI_TOPICS.find((t) => t.id === "agents") as Topic;
const arcAgi = AI_TOPICS.find((t) => t.id === "arc-agi") as Topic;

describe("matchTopic", () => {
  it("matches substring case-insensitively", () => {
    expect(matchTopic("OpenAI just released GPT-5", gptFive)).toBe(true);
  });

  it("returns false for empty text", () => {
    expect(matchTopic("", gptFive)).toBe(false);
  });

  it("matches with word boundary", () => {
    expect(matchTopic("AI agents are great", agentsTopic)).toBe(true);
  });

  it("rejects when word boundary fails", () => {
    expect(matchTopic("agentsystem release", agentsTopic)).toBe(false);
  });

  it("matches case-insensitive multi-token aliases", () => {
    expect(matchTopic("Beating the ARC AGI benchmark", arcAgi)).toBe(true);
  });
});

describe("AI_TOPICS", () => {
  it("covers the six required ids", () => {
    const ids = AI_TOPICS.map((t) => t.id);
    for (const id of ["gpt-5", "claude", "gemini", "arc-agi", "agents", "local-llms"]) {
      expect(ids).toContain(id);
    }
  });

  it("has at least one topic with wordBoundary: true", () => {
    expect(AI_TOPICS.some((t) => t.wordBoundary === true)).toBe(true);
  });
});
