export type Topic = {
  id: string;
  label: string;
  aliases: string[];
  wordBoundary?: boolean;
};

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const AI_TOPICS: Topic[] = [
  {
    id: "gpt-5",
    label: "GPT-5",
    aliases: ["GPT-5", "gpt5"],
  },
  {
    id: "gpt-4",
    label: "GPT-4",
    aliases: ["GPT-4", "gpt4"],
  },
  {
    id: "claude",
    label: "Claude",
    aliases: ["Claude", "Claude 3", "Claude 4", "Claude Opus", "Claude Sonnet", "Claude Haiku"],
  },
  {
    id: "gemini",
    label: "Gemini",
    aliases: ["Gemini", "Gemini Pro", "Gemini Ultra", "Gemini Flash"],
  },
  {
    id: "arc-agi",
    label: "ARC-AGI",
    aliases: ["ARC-AGI", "ARC AGI"],
  },
  {
    id: "agents",
    label: "Agents",
    aliases: ["agents", "agent", "agentic"],
    wordBoundary: true,
  },
  {
    id: "local-llms",
    label: "Local LLMs",
    aliases: ["local LLM", "local LLMs", "local llm", "local llms", "llama.cpp", "ollama"],
  },
  {
    id: "llama",
    label: "Llama",
    aliases: ["Llama", "LLaMA"],
    wordBoundary: true,
  },
  {
    id: "mistral",
    label: "Mistral",
    aliases: ["Mistral"],
  },
  {
    id: "openai",
    label: "OpenAI",
    aliases: ["OpenAI"],
  },
  {
    id: "anthropic",
    label: "Anthropic",
    aliases: ["Anthropic"],
  },
  {
    id: "deepmind",
    label: "Google DeepMind",
    aliases: ["Google DeepMind", "DeepMind"],
  },
  {
    id: "agi",
    label: "AGI",
    aliases: ["AGI"],
    wordBoundary: true,
  },
  {
    id: "rag",
    label: "RAG",
    aliases: ["RAG"],
    wordBoundary: true,
  },
  {
    id: "transformer",
    label: "Transformer",
    aliases: ["transformer", "transformers"],
  },
  {
    id: "diffusion",
    label: "Diffusion",
    aliases: ["diffusion", "stable diffusion"],
  },
  {
    id: "multimodal",
    label: "Multimodal",
    aliases: ["multimodal", "multi-modal"],
  },
  {
    id: "reasoning",
    label: "Reasoning",
    aliases: ["reasoning", "chain of thought", "chain-of-thought"],
  },
  {
    id: "mcp",
    label: "MCP",
    aliases: ["MCP", "Model Context Protocol"],
    wordBoundary: true,
  },
  {
    id: "sora",
    label: "Sora",
    aliases: ["Sora"],
    wordBoundary: true,
  },
];

export function matchTopic(text: string, topic: Topic): boolean {
  if (!text) return false;

  if (topic.wordBoundary) {
    for (const alias of topic.aliases) {
      const re = new RegExp(`\\b${escapeRegex(alias)}\\b`, "i");
      if (re.test(text)) return true;
    }
    return false;
  }

  const lower = text.toLowerCase();
  for (const alias of topic.aliases) {
    if (lower.includes(alias.toLowerCase())) return true;
  }
  return false;
}
