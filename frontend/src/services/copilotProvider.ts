type ProviderMessage = { role: "system" | "user" | "assistant"; content: string };

export type ProviderResult = {
  answer: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
};

function providerConfiguration() {
  const apiKey = process.env.AI_API_KEY?.trim() || "";
  const model = process.env.AI_MODEL?.trim();
  const baseUrl = (process.env.AI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/+$/, "");
  if (!model) {
    throw new Error("AI is not configured. Set AI_MODEL on the server.");
  }

  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error("AI_BASE_URL must be a valid URL.");
  }

  const isLocal =
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "0.0.0.0" ||
    url.hostname === "::1";

  if (url.protocol !== "https:" && !isLocal && process.env.NODE_ENV === "production") {
    throw new Error("AI_BASE_URL must use HTTPS.");
  }

  // Local Ollama, LM Studio, or local Qwen engines don't require an explicit external API key
  const effectiveApiKey = apiKey || (isLocal ? "ollama" : "");
  if (!effectiveApiKey && !isLocal) {
    throw new Error("AI is not configured. Set AI_API_KEY and AI_MODEL on the server.");
  }

  return { apiKey: effectiveApiKey, model, url: `${baseUrl}/chat/completions` };
}

export function assertCopilotProviderConfigured() {
  providerConfiguration();
}

export async function generateCopilotAnswer(
  question: string,
  facts: unknown,
  history: ProviderMessage[],
): Promise<ProviderResult> {
  const config = providerConfiguration();
  const messages: ProviderMessage[] = [
    {
      role: "system",
      content: [
        "You are Amiro Intelligence, the dedicated AI business operations copilot for Amiro Tech Solutions.",
        "CRITICAL - MULTILINGUAL TEXT-TO-TEXT: You must understand and answer in the EXACT SAME LANGUAGE as the user's question. If the user asks in Hindi (हिंदी), reply in clear Hindi. If the user asks in Telugu (తెలుగు), reply in Telugu. If the user asks in Tamil (தமிழ்), reply in Tamil. If the user asks in Spanish (español), reply in Spanish. If the user asks in English or Hinglish, reply in that natural language.",
        "CRITICAL - STRICT APPLICATION SCOPE: You are exclusively an enterprise business copilot for this application. Answer questions strictly and solely based on the authorized business facts provided in the user prompt (clients, leads, quotes, invoices, payments, projects, expenses, contracts, support tickets).",
        "REJECT UNRELATED QUESTIONS: If the user asks questions unrelated to this business application (such as general knowledge, coding tutorials, recipes, chit-chat, outside topics, or non-business queries), politely decline in the user's language, stating that you are Amiro Intelligence and are authorized only to provide insights on this company's business operations and records.",
        "NEVER HALLUCINATE: Never invent records, client names, invoices, amounts, dates, or financial totals. If the provided business facts are empty or missing, state that clearly and accurately in the user's language.",
        "FINANCIAL ACCURACY: Exact financial numbers and currency amounts (₹) are calculated by the application; repeat them with 100% precision and distinguish realized revenue from operational expenses.",
        "FORMATTING: Format your reply cleanly with markdown bullet points, bold key figures, and concise business tone.",
        'Return a JSON object with exactly one string property: {"answer":"..."}'
      ].join(" ")
    },
    ...history,
    {
      role: "user",
      content: JSON.stringify({ question, authorizedBusinessFacts: facts })
    }
  ];

  let response: Response;
  try {
    response = await fetch(config.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: 0.1,
        max_tokens: 800,
        response_format: { type: "json_object" }
      }),
      signal: AbortSignal.timeout(30_000),
      cache: "no-store"
    });
  } catch (error) {
    throw new Error(error instanceof Error && error.name === "TimeoutError"
      ? "The AI provider timed out. Please try again."
      : "Unable to reach the configured AI provider.");
  }

  if (!response.ok) {
    console.error("Copilot provider request failed", { status: response.status, model: config.model });
    throw new Error("The AI provider could not complete this request.");
  }

  const payload: unknown = await response.json();
  if (!payload || typeof payload !== "object") {
    throw new Error("The AI provider returned an invalid response.");
  }
  const data = payload as {
    choices?: Array<{ message?: { content?: unknown } }>;
    usage?: { prompt_tokens?: unknown; completion_tokens?: unknown };
  };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("The AI provider returned no answer.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    const match = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match && match[1]) {
      try {
        parsed = JSON.parse(match[1]);
      } catch {
        throw new Error("The AI provider returned an invalid structured answer.");
      }
    } else {
      throw new Error("The AI provider returned an invalid structured answer.");
    }
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    !("answer" in parsed) ||
    Object.keys(parsed).length !== 1 ||
    typeof (parsed as { answer: unknown }).answer !== "string" ||
    !(parsed as { answer: string }).answer.trim() ||
    (parsed as { answer: string }).answer.length > 8000
  ) {
    throw new Error("The AI provider returned an invalid structured answer.");
  }

  const answerString = (parsed as { answer: string }).answer.trim();
  const inputTokens = typeof data.usage?.prompt_tokens === "number" ? data.usage.prompt_tokens : 100;
  const outputTokens = typeof data.usage?.completion_tokens === "number" ? data.usage.completion_tokens : 50;

  return { answer: answerString, model: config.model, inputTokens, outputTokens };
}
