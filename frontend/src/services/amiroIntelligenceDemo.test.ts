import { describe, expect, it, beforeEach } from "vitest";
import { askAmiroIntelligenceDemo, getDemoConversations } from "./amiroIntelligenceDemo";

describe("Conversation language stickiness and consistency", () => {
  beforeEach(() => {
    // Clear localStorage in mock/jsdom/browser environment
    if (typeof window !== "undefined") {
      window.localStorage.clear();
    }
  });

  it("locks the conversation language to Telugu across subsequent turns", async () => {
    // Turn 1: User asks in Telugu
    const turn1 = await askAmiroIntelligenceDemo("హాయ్, మీరు ఎవరు?", "conv-test-telugu");
    expect(turn1.conversation.language).toBe("te");
    expect(turn1.assistantMessage.content).toContain("అమీరో");

    // Turn 2: User responds with a short English word 'ok'
    const turn2 = await askAmiroIntelligenceDemo("ok", "conv-test-telugu");
    // Crucial requirement: Must NOT switch to English! Must remain in Telugu.
    expect(turn2.conversation.language).toBe("te");
    expect(turn2.assistantMessage.content).not.toMatch(/Hello!|How can I help you today/);
  });

  it("locks the conversation language to Hindi across subsequent turns", async () => {
    // Turn 1: User asks in Hindi
    const turn1 = await askAmiroIntelligenceDemo("नमस्ते, क्या हाल है?", "conv-test-hindi");
    expect(turn1.conversation.language).toBe("hi");
    expect(turn1.assistantMessage.content).toContain("नमस्ते");

    // Turn 2: User asks follow-up with short words
    const turn2 = await askAmiroIntelligenceDemo("projects", "conv-test-hindi");
    // Must remain in Hindi
    expect(turn2.conversation.language).toBe("hi");
    expect(turn2.assistantMessage.content).toContain("प्रोजेक्ट");
  });

  it("honors explicitly selected preferred language", async () => {
    // Explicitly select 'te'
    const res = await askAmiroIntelligenceDemo("show overdue invoices", "conv-test-explicit", "te");
    expect(res.conversation.language).toBe("te");
    expect(res.assistantMessage.content).toMatch(/ఇన్వాయిస్|బకాయి|శుభవార్త/);
  });

  it("answers 'what your name' in Tamil when Tamil is selected", async () => {
    // Exact user scenario from screenshot: Tamil selected, user asks 'what your name'
    const res = await askAmiroIntelligenceDemo("what your name", "conv-test-tamil-name", "ta");
    expect(res.conversation.language).toBe("ta");
    // Must contain Tamil script and NOT English
    expect(res.assistantMessage.content).toContain("அமிரோ");
    expect(res.assistantMessage.content).not.toContain("I'm here to assist with Amiro Tech Solutions operations");
  });
});

