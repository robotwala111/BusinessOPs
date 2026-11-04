import { afterEach, describe, expect, it, vi } from "vitest";
import { generateCopilotAnswer } from "./copilotProvider";

describe("Copilot provider boundary", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("parses structured answers and records provider usage without exposing keys", async () => {
    vi.stubEnv("AI_API_KEY", "server-test-key");
    vi.stubEnv("AI_MODEL", "test-model");
    vi.stubEnv("AI_BASE_URL", "https://provider.example/v1");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ answer: "There are no overdue invoices." }) } }],
      usage: { prompt_tokens: 120, completion_tokens: 12 }
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateCopilotAnswer("Show overdue invoices", { count: 0 }, []))
      .resolves.toMatchObject({ answer: "There are no overdue invoices.", model: "test-model", inputTokens: 120, outputTokens: 12 });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      headers: { Authorization: "Bearer server-test-key" },
      cache: "no-store"
    });
  });

  it("rejects provider output that does not match the structured schema", async () => {
    vi.stubEnv("AI_API_KEY", "server-test-key");
    vi.stubEnv("AI_MODEL", "test-model");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ answer: "Unsupported claim", records: [] }) } }],
      usage: { prompt_tokens: 10, completion_tokens: 5 }
    }), { status: 200 })));

    await expect(generateCopilotAnswer("Show overdue invoices", {}, []))
      .rejects.toThrow("invalid structured answer");
  });

  it("accepts direct text/markdown responses from Qwen and open-weight models", async () => {
    vi.stubEnv("AI_API_KEY", "ollama");
    vi.stubEnv("AI_MODEL", "qwen2.5:1.5b");
    vi.stubEnv("AI_BASE_URL", "http://localhost:11434/v1");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: "नमस्ते! वर्तमान में कोई भी इनवॉइस ओवरड्यू नहीं है।" } }],
      usage: { prompt_tokens: 80, completion_tokens: 25 }
    }), { status: 200 })));

    const res = await generateCopilotAnswer("ओवरड्यू इनवॉइस दिखाओ", {}, []);
    expect(res.answer).toBe("नमस्ते! वर्तमान में कोई भी इनवॉइस ओवरड्यू नहीं है।");
    expect(res.model).toBe("qwen2.5:1.5b");
  });
});
