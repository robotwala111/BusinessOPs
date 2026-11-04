import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

describe("Chat API endpoint (/api/chat)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("returns 400 when message is missing or invalid", async () => {
    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      })
    );

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json).toMatchObject({ error: expect.stringContaining("required") });
  });

  it("returns graceful fallback reply when AI_COPILOT_ENABLED is false", async () => {
    vi.stubEnv("AI_COPILOT_ENABLED", "false");
    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "What services do you offer?",
          conversation_id: "test-session-123",
          language: "en"
        })
      })
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.reply).toContain("Hello! Welcome to Amiro Intelligence");
    expect(json.conversation_id).toBe("test-session-123");
    expect(json.fallback).toBe(true);
  });
});

