type ProviderMessage = { role: "system" | "user" | "assistant"; content: string };

export type ProviderResult = {
  answer: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
};

function providerConfiguration() {
  const apiKey = process.env.AI_API_KEY?.trim() || "ollama";
  const model = process.env.AI_MODEL?.trim() || "qwen2.5:1.5b";
  const defaultBaseUrl = (apiKey && apiKey !== "ollama") ? "https://api.openai.com/v1" : "http://127.0.0.1:11434/v1";
  const baseUrl = (process.env.AI_BASE_URL?.trim() || defaultBaseUrl).replace(/\/+$/, "");

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

  return { apiKey, model, url: `${baseUrl}/chat/completions` };
}

export function assertCopilotProviderConfigured() {
  providerConfiguration();
}

const LANGUAGE_NAMES: Record<string, string> = {
  te: "Telugu (తెలుగు)",
  hi: "Hindi (हिंदी)",
  kn: "Kannada (ಕನ್ನಡ)",
  ta: "Tamil (தமிழ்)",
  ml: "Malayalam (മലയാളം)",
  mr: "Marathi (मराठी)",
  bn: "Bengali (বাংলা)",
  gu: "Gujarati (ગુજરાતી)",
  ar: "Arabic (العربية)",
  en: "English",
  es: "Spanish (español)"
};

export async function generateCopilotAnswer(
  question: string,
  facts: unknown,
  history: ProviderMessage[],
  preferredLanguage?: string
): Promise<ProviderResult> {
  const config = providerConfiguration();
  const isQwenOrLocal = config.model.toLowerCase().includes("qwen") || config.url.includes("localhost") || config.url.includes("127.0.0.1");

  const langInstruction = preferredLanguage && preferredLanguage !== "auto" && LANGUAGE_NAMES[preferredLanguage]
    ? `CRITICAL - MANDATORY LANGUAGE LOCK: The user has selected ${LANGUAGE_NAMES[preferredLanguage]} for this session. You MUST reply exclusively and entirely in ${LANGUAGE_NAMES[preferredLanguage]}. Even if the user asks their question in English (for example 'what your name', 'hello', 'how are you', 'who are you', 'ok', 'good', 'bye', or 'show invoices'), you must reply ONLY in ${LANGUAGE_NAMES[preferredLanguage]}. Under no circumstances should you revert to English.`
    : "CRITICAL - MULTILINGUAL TEXT-TO-TEXT: You must understand and answer in the EXACT SAME LANGUAGE as the user's question. If the user asks in Hindi (हिंदी), reply in clear Hindi. If the user asks in Telugu (తెలుగు), reply in Telugu. If the user asks in Tamil (தமிழ்), reply in Tamil. If the user asks in Malayalam (മലയാളം), reply in Malayalam. If the user asks in Kannada (ಕನ್ನಡ), reply in Kannada. If the user asks in Marathi (मराठी), reply in Marathi. If the user asks in Bengali (বাংলা), reply in Bengali. If the user asks in Gujarati (ગુજરાતી), reply in Gujarati. If the user asks in Arabic (العربية), reply in Arabic. If the user asks in English or Hinglish, reply in that natural language.";

  const formatInstruction = isQwenOrLocal
    ? "Answer directly, accurately, and concisely in natural markdown. Do not wrap your response in JSON unless specifically requested."
    : 'Return a JSON object with exactly one string property: {"answer":"..."}';

  const messages: ProviderMessage[] = [
    {
      role: "system",
      content: [
        "You are Amiro Intelligence, the dedicated AI business operations assistant and copilot for Amiro Tech Solutions.",
        langInstruction,
        "ROLE & APPLICATION SCOPE: You are an enterprise business copilot for this application. Answer questions accurately and directly based on the authorized business facts provided in the prompt (clients, leads, quotes, invoices, payments, projects, expenses, contracts, support tickets).",
        "STRICT RELEVANCE RULE: Answer the user's latest message and nothing they did not ask for. For greetings, small talk, identity questions, or general conversation, respond naturally and briefly. Do not volunteer client names, project or invoice data, financial metrics, counts, summaries, or suggestions to inspect records unless the user explicitly asks for that business information. Treat authorizedBusinessFacts as unavailable unless they directly answer an explicit business-data request. Never infer that a greeting or casual question is a request for records.",
        "CONVERSATIONAL COURTESY & WELL-WISHER: If the user greets you ('hi', 'hello', 'how are you'), asks your name or identity ('what is your name', 'who are you'), or says 'ok', 'good', 'bye', 'see you', 'take care', 'thanks', reply warmly as a caring well-wisher. Wish them happiness, great success, safety, and a productive day, while remaining their dedicated Amiro Intelligence assistant.",
        "REJECT UNRELATED TOPICS: If the user asks questions completely outside this business application (such as cooking recipes, movie trivia, politics, general coding tutorials), politely decline in the active conversation language and offer to assist with Amiro Tech Solutions records.",
        "NEVER HALLUCINATE: Never invent fake records, client names, invoices, amounts, or dates. Use the verified business facts with 100% precision.",
        "FINANCIAL ACCURACY: Exact financial numbers and currency amounts (₹) are calculated by the application; repeat them with precision.",
        "FORMATTING: Format your reply cleanly with markdown bullet points and bold key figures.",
        formatInstruction
      ].join(" ")
    },
    ...history,
    {
      role: "user",
      content: JSON.stringify({ question, authorizedBusinessFacts: facts, lockedLanguage: preferredLanguage })
    }
  ];

  let response: Response;
  try {
    const requestPayload: Record<string, unknown> = {
      model: config.model,
      messages,
      temperature: 0.2,
      max_tokens: isQwenOrLocal ? 160 : 800,
    };
    if (isQwenOrLocal) {
      // Optimize CPU inference speed and latency for local Ollama/Qwen
      requestPayload.options = {
        num_predict: 160,
        temperature: 0.2,
        top_p: 0.9,
      };
    } else {
      requestPayload.response_format = { type: "json_object" };
    }

    response = await fetch(config.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestPayload),
      // Local CPU inference can stall for tens of seconds on oversized prompts.
      // Keep the UI responsive and let the app's grounded fallback take over.
      signal: AbortSignal.timeout(isQwenOrLocal ? 12_000 : 45_000),
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
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("The AI provider returned no answer.");
  }

  let answerString = "";

  if (isQwenOrLocal) {
    // For local open-weight models, accept direct markdown or flexible JSON without fragile schema rejections
    let raw = content.trim();
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const val = (parsed as Record<string, unknown>).answer ||
          (parsed as Record<string, unknown>).reply ||
          (parsed as Record<string, unknown>).response ||
          (parsed as Record<string, unknown>).text ||
          (parsed as Record<string, unknown>).message;
        if (typeof val === "string" && val.trim()) {
          raw = val.trim();
        }
      }
    } catch {
      const match = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match && match[1]) {
        try {
          const parsed = JSON.parse(match[1]);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            const val = (parsed as Record<string, unknown>).answer ||
              (parsed as Record<string, unknown>).reply ||
              (parsed as Record<string, unknown>).response ||
              (parsed as Record<string, unknown>).text ||
              (parsed as Record<string, unknown>).message;
            if (typeof val === "string" && val.trim()) {
              raw = val.trim();
            }
          }
        } catch {
          // keep raw text
        }
      }
    }
    answerString = raw;
  } else {
    // Cloud structured JSON parsing for external providers
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(content);
    } catch {
      const match = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match && match[1]) {
        try {
          parsed = JSON.parse(match[1]);
        } catch {
          parsed = null;
        }
      }
    }

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      if (
        !("answer" in parsed) ||
        Object.keys(parsed).length !== 1 ||
        typeof (parsed as { answer: unknown }).answer !== "string" ||
        !(parsed as { answer: string }).answer.trim() ||
        (parsed as { answer: string }).answer.length > 8000
      ) {
        throw new Error("The AI provider returned an invalid structured answer.");
      }
      answerString = (parsed as { answer: string }).answer.trim();
    } else {
      throw new Error("The AI provider returned an invalid structured answer.");
    }
  }

  const inputTokens = typeof data.usage?.prompt_tokens === "number" ? data.usage.prompt_tokens : 100;
  const outputTokens = typeof data.usage?.completion_tokens === "number" ? data.usage.completion_tokens : 50;

  return { answer: answerString, model: config.model, inputTokens, outputTokens };
}
