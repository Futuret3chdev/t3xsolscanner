export type AiModel = {
  id: string;
  label: string;
  hint: string;
  /** Higher output budget. Some of these spend tokens on reasoning before the answer. */
  reasoning?: boolean;
};

export type AiFamily = {
  id: string;
  label: string;
  models: AiModel[];
};

/** Chat models confirmed on the HostGator AI Gateway. Ids match the live /v1/models list. */
export const AI_FAMILIES: AiFamily[] = [
  {
    id: "claude",
    label: "Claude",
    models: [
      { id: "claude-haiku-4-5", label: "Haiku 4.5", hint: "Fast" },
      { id: "claude-sonnet-5", label: "Sonnet 5", hint: "Balanced" },
      { id: "claude-opus-5", label: "Opus 5", hint: "Strong" },
    ],
  },
  {
    id: "gemini",
    label: "Gemini",
    models: [
      { id: "gemini-3.1-flash-lite", label: "Flash Lite", hint: "Fast" },
      { id: "gemini-3.5-flash", label: "3.5 Flash", hint: "Balanced" },
      { id: "gemini-3.1-pro", label: "3.1 Pro", hint: "Strong" },
    ],
  },
  {
    id: "grok",
    label: "Grok",
    models: [
      { id: "grok-4.3", label: "Grok 4.3", hint: "Fast" },
      { id: "grok-4.6", label: "Grok 4.6", hint: "Long" },
      { id: "grok-4-20-reasoning", label: "Reasoning", hint: "Thinks first", reasoning: true },
    ],
  },
  {
    id: "gpt",
    label: "GPT",
    models: [
      { id: "gpt-5.4-nano", label: "5.4 Nano", hint: "Fast" },
      { id: "gpt-5.4", label: "GPT 5.4", hint: "Balanced" },
      { id: "gpt-5.6", label: "GPT 5.6", hint: "Strong" },
    ],
  },
  {
    id: "more",
    label: "More",
    models: [
      { id: "DeepSeek-V4-Flash", label: "DeepSeek", hint: "Flash" },
      { id: "Kimi-K2.6", label: "Kimi K2.6", hint: "Long" },
      { id: "Mistral-Large-3", label: "Mistral", hint: "Large 3" },
      { id: "GLM-5.2", label: "GLM 5.2", hint: "Strong" },
      { id: "MiniMax-M2.5", label: "MiniMax", hint: "Light" },
    ],
  },
];

export const AI_MODELS: AiModel[] = AI_FAMILIES.flatMap((family) => family.models);

export const DEFAULT_AI_MODEL = "gemini-3.1-flash-lite";

export function aiModel(id: string): AiModel | undefined {
  return AI_MODELS.find((model) => model.id === id);
}

export function familyForModel(id: string): string {
  return AI_FAMILIES.find((family) => family.models.some((model) => model.id === id))?.id ?? "gemini";
}
