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

  it("auto-detects Malayalam when user enters Malayalam script", async () => {
    // Auto-detect mode (no preferredLanguage or 'auto')
    const res = await askAmiroIntelligenceDemo("ക്ലയന്റുകൾ ആരൊക്കെയാണ്", "conv-test-auto-ml");
    expect(res.conversation.language).toBe("ml");
    expect(res.assistantMessage.content).toMatch(/ക്ലയന്റ്|അക്കൗണ്ടുകൾ|രജിസ്റ്റർ/);
  });

  it("auto-detects Kannada when user enters Kannada script", async () => {
    const res = await askAmiroIntelligenceDemo("ನಮಸ್ಕಾರ, ನೀವು ಯಾರು?", "conv-test-auto-kn");
    expect(res.conversation.language).toBe("kn");
    expect(res.assistantMessage.content).toContain("ಅಮಿರೋ");
  });

  it("collects client details step-by-step through interactive chat conversation", async () => {
    const convId = "conv-test-interactive-intake";

    // Turn 1: User asks to fill client details
    const turn1 = await askAmiroIntelligenceDemo("fill client details", convId);
    expect(turn1.assistantMessage.content).toContain("Step 1 of 4: Company Name");

    // Turn 2: User provides Company Name
    const turn2 = await askAmiroIntelligenceDemo("Zenith Enterprise Solutions", convId);
    expect(turn2.assistantMessage.content).toContain("Zenith Enterprise Solutions");
    expect(turn2.assistantMessage.content).toContain("Step 2 of 4: Primary Contact & Email");

    // Turn 3: User provides Contact Person & Email
    const turn3 = await askAmiroIntelligenceDemo("Vikram Sharma, vikram@zenith.com", convId);
    expect(turn3.assistantMessage.content).toContain("Vikram Sharma");
    expect(turn3.assistantMessage.content).toContain("vikram@zenith.com");
    expect(turn3.assistantMessage.content).toContain("Step 3 of 4: Phone & Industry");

    // Turn 4: User provides Phone & Industry
    const turn4 = await askAmiroIntelligenceDemo("+91 98490 55555, FinTech Software", convId);
    expect(turn4.assistantMessage.content).toContain("+91 98490 55555");
    expect(turn4.assistantMessage.content).toContain("FinTech Software");
    expect(turn4.assistantMessage.content).toContain("Step 4 of 4: Location & GSTIN");

    // Turn 5: User completes with skip / standard defaults
    const turn5 = await askAmiroIntelligenceDemo("skip", convId);
    expect(turn5.assistantMessage.content).toContain("Client Data Collected Successfully");
    expect(turn5.assistantMessage.content).toContain("Zenith Enterprise Solutions");
    expect(turn5.assistantMessage.content).toContain("/clients/new?autofill=custom");
    expect(turn5.assistantMessage.content).toContain("/clients/onboard?autofill=custom");
    expect(turn5.assistantMessage.records.length).toBeGreaterThanOrEqual(2);
  });

  it("does not accidentally treat trigger phrase 'Help me fill client details step by step.' as company name and answers questions safely", async () => {
    const convId = "conv-test-no-accidental-company";

    // Turn 1: User clicks suggestion chip with exact phrase from screenshot
    const turn1 = await askAmiroIntelligenceDemo("Help me fill client details step by step.", convId);
    expect(turn1.assistantMessage.content).toContain("Step 1 of 4: Company Name");
    expect(turn1.assistantMessage.content).not.toContain("details step by step");
    expect(turn1.assistantMessage.content).not.toContain("Step 2 of 4");

    // Turn 2: User asks "what is the company name"
    const turn2 = await askAmiroIntelligenceDemo("what is the company name", convId);
    // Must NOT treat "what is the company name" as contact person or company!
    expect(turn2.assistantMessage.content).not.toContain("Contact saved: what is the company name");
    expect(turn2.assistantMessage.content).toContain("Company Name");

    // Turn 3: User enters legitimate company name
    const turn3 = await askAmiroIntelligenceDemo("Acme Global Solutions", convId);
    expect(turn3.assistantMessage.content).toContain("Company Name saved: **Acme Global Solutions**");
    expect(turn3.assistantMessage.content).toContain("Step 2 of 4: Primary Contact & Email");

    // Turn 4: User asks "what is the company name" to verify
    const turn4 = await askAmiroIntelligenceDemo("what is the company name", convId);
    expect(turn4.assistantMessage.content).toContain("Acme Global Solutions");
    expect(turn4.assistantMessage.content).not.toContain("Contact saved: what is the company name");
  });

  it("supports instant demo auto-fill when user explicitly requests demo", async () => {
    const res = await askAmiroIntelligenceDemo("fill client form with demo", "conv-test-autofill-demo");
    expect(res.assistantMessage.content).toContain("Apex Global Technologies");
    expect(res.assistantMessage.content).toContain("/clients/new?autofill=custom");
    expect(res.assistantMessage.records.some((r) => r.href.includes("/clients/new"))).toBe(true);
  });

  it("initiates step-by-step intake in Malayalam and auto-detects language", async () => {
    const convId = "conv-test-autofill-ml";
    // Turn 1: User asks in Malayalam
    const turn1 = await askAmiroIntelligenceDemo("ക്ലയന്റ് ഫോം പൂരിപ്പിക്കുക", convId);
    expect(turn1.conversation.language).toBe("ml");
    expect(turn1.assistantMessage.content).toContain("ഘട്ടം 1/4: കമ്പനിയുടെ പേര്");

    // Turn 2: User requests demo in Malayalam
    const turn2 = await askAmiroIntelligenceDemo("ഡെമോ", convId);
    expect(turn2.conversation.language).toBe("ml");
    expect(turn2.assistantMessage.content).toContain("Apex Global Technologies");
    expect(turn2.assistantMessage.content).toContain("/clients/new?autofill=custom");
    expect(turn2.assistantMessage.records.length).toBeGreaterThanOrEqual(2);
  });
});

