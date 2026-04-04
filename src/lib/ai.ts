export type AiModuleName =
  | "Dashboard"
  | "LeetCode"
  | "Reading"
  | "Calendar"
  | "Notes"
  | "Groups";

export type AiProvider = "free_default" | "byok";
export type AiModel = "gemma-3" | "llama-4-scout" | "gpt-4.1-mini";

export type AiStreamRequest = {
  prompt: string;
  moduleName: AiModuleName;
  provider: AiProvider;
  model: AiModel;
  apiKey?: string;
  context?: {
    problemsCount?: number;
    knowledgePointsCount?: number;
    eventsCount?: number;
    notesCount?: number;
  };
};

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildReadingFlashcardResponse(prompt: string, modelTag: string, contextLine?: string): string {
  const marker = "[FLASHCARDS]";
  const payload = prompt.includes(marker) ? prompt.split(marker)[1]?.trim() ?? "" : "";
  const entries = payload
    .split("||")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [id, title, concept] = item.split("::");
      return {
        id: (id ?? "").trim(),
        title: (title ?? "Concept").trim(),
        concept: (concept ?? "").trim(),
      };
    })
    .filter((item) => item.id && item.title);

  if (entries.length === 0) {
    return [
      "No flashcard seeds were provided.",
      contextLine,
      `Model: ${modelTag}`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  const cardLines: string[] = ["Generated flashcard drafts:"];
  entries.slice(0, 10).forEach((entry, index) => {
    cardLines.push(`Card ${index + 1}`);
    cardLines.push(`SOURCE_ID: ${entry.id}`);
    cardLines.push(`Q: What is ${entry.title} and when should you use it?`);
    cardLines.push(
      `A: ${entry.concept || `${entry.title} is a key CS concept. Explain definition, constraints, and one example.`}`
    );
  });
  cardLines.push(contextLine ?? "");
  cardLines.push(`Model: ${modelTag}`);
  return cardLines.filter(Boolean).join("\n");
}

function buildCalendarPlanResponse(prompt: string, modelTag: string, contextLine?: string): string {
  const marker = "[CAL_PLAN]";
  const payload = prompt.includes(marker) ? prompt.split(marker)[1]?.trim() ?? "" : "";
  const baseDateRaw = payload.split("::")[0]?.trim();
  const baseDate = /^\d{4}-\d{2}-\d{2}$/.test(baseDateRaw) ? baseDateRaw : new Date().toISOString().slice(0, 10);
  const base = new Date(`${baseDate}T00:00:00`);
  const addDays = (days: number) => {
    const dt = new Date(base);
    dt.setDate(dt.getDate() + days);
    return dt.toISOString().slice(0, 10);
  };
  return [
    "Structured plan draft:",
    `PLAN_ITEM|Algorithms Deep Work|${addDays(1)}|09:00|90|study`,
    `PLAN_ITEM|LeetCode Pattern Practice|${addDays(1)}|14:00|60|leetcode`,
    `PLAN_ITEM|Reading Concept Review|${addDays(2)}|10:30|45|study`,
    `PLAN_ITEM|Mock Interview Prep|${addDays(2)}|16:00|60|meeting`,
    `PLAN_ITEM|Spaced Review Sprint|${addDays(3)}|19:00|45|study`,
    contextLine ?? "",
    `Model: ${modelTag}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildContextAwareResponse(request: AiStreamRequest): string {
  const modelTag = `${request.provider === "byok" ? "BYOK" : "Free Default"} / ${request.model}`;
  const prompt = request.prompt.trim();
  const contextLine =
    request.context &&
    `Context: ${request.context.problemsCount ?? 0} problems, ${request.context.knowledgePointsCount ?? 0} knowledge points, ${request.context.eventsCount ?? 0} events, ${request.context.notesCount ?? 0} notes.`;

  if (request.moduleName === "LeetCode") {
    return [
      "Try this hint ladder:",
      "1) Rephrase constraints and target complexity.",
      "2) Write brute-force with 2 edge-case tests.",
      "3) Identify reusable pattern (two pointers / hash map / DP / graph).",
      "4) Validate with one counterexample.",
      contextLine,
      `Prompt: "${prompt}"`,
      `Model: ${modelTag}`,
    ]
      .filter(Boolean)
      .join("\n");
  }
  if (request.moduleName === "Reading") {
    if (prompt.includes("[FLASHCARDS]")) {
      return buildReadingFlashcardResponse(prompt, modelTag, contextLine);
    }
    return [
      "Use this study loop:",
      "1) Distill core concept into one sentence.",
      "2) Add one concrete example and one anti-example.",
      "3) Create one retrieval question for tomorrow review.",
      contextLine,
      `Prompt: "${prompt}"`,
      `Model: ${modelTag}`,
    ]
      .filter(Boolean)
      .join("\n");
  }
  if (request.moduleName === "Calendar") {
    if (prompt.includes("[CAL_PLAN]")) {
      return buildCalendarPlanResponse(prompt, modelTag, contextLine);
    }
    return [
      "Schedule suggestion:",
      "- Put deep work first when energy is highest.",
      "- Keep 10-15 minute buffers between sessions.",
      "- Batch shallow tasks together.",
      contextLine,
      `Prompt: "${prompt}"`,
      `Model: ${modelTag}`,
    ]
      .filter(Boolean)
      .join("\n");
  }
  return [
    "Suggested next step:",
    "- Break this into one immediate action and one follow-up checkpoint.",
    "- Write acceptance criteria before execution.",
    contextLine,
    `Prompt: "${prompt}"`,
    `Model: ${modelTag}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function* streamAiResponse(
  request: AiStreamRequest
): AsyncGenerator<string> {
  const text = buildContextAwareResponse(request);
  const tokens = text.split(/(\s+)/).filter(Boolean);
  for (const token of tokens) {
    yield token;
    await wait(22);
  }
}
