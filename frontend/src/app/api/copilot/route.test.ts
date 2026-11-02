import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

describe("Copilot API access controls", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("keeps AI requests disabled unless explicitly enabled", async () => {
    vi.stubEnv("AI_COPILOT_ENABLED", "false");
    const response = await POST(new Request("http://localhost/api/copilot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Show overdue invoices" })
    }));

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("disabled") });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("requires a bearer session to read conversation history", async () => {
    const response = await GET(new Request("http://localhost/api/copilot"));

    expect(response.status).toBe(401);
  });

  it("rejects oversized request bodies while streaming", async () => {
    vi.stubEnv("AI_COPILOT_ENABLED", "true");
    const response = await POST(new Request("http://localhost/api/copilot", {
      method: "POST",
      body: " ".repeat(8193)
    }));

    expect(response.status).toBe(413);
  });
});
