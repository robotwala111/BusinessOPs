import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import { askAmiroIntelligenceDemo, getDemoConversations } from "./amiroIntelligenceDemo";
import { clientService } from "./clientService";
import { projectService } from "./projectService";

describe("Conversation language stickiness and consistency", () => {
  beforeEach(() => {
    // Clear localStorage in mock/jsdom/browser environment
    if (typeof window !== "undefined") {
      window.localStorage.clear();
    }
    clientService.invalidateCache();
    projectService.invalidateCache();
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

  it("replies as a warm well-wisher for 'ok', 'good', 'bye', and 'thanks' without repeating previous messages", async () => {
    const convId = "conv-test-well-wisher";

    // 1. User says "How are you"
    const turn1 = await askAmiroIntelligenceDemo("How are you", convId);
    expect(turn1.assistantMessage.content).toMatch(/I['’]m doing (great|well)|Amiro Intelligence/);

    // 2. User responds "good" -> must reply as a well-wisher praising and wishing them success
    const turn2 = await askAmiroIntelligenceDemo("good", convId);
    expect(turn2.assistantMessage.content).not.toBe(turn1.assistantMessage.content);
    expect(turn2.assistantMessage.content).toMatch(/joy to assist you|Wishing you continued inspiration|tremendous success/);

    // 3. User says "ok" -> must reply as a well-wisher wishing smooth, fruitful progress
    const turn3 = await askAmiroIntelligenceDemo("ok", convId);
    expect(turn3.assistantMessage.content).not.toBe(turn2.assistantMessage.content);
    expect(turn3.assistantMessage.content).toMatch(/Wishing you smooth and fruitful progress|productive day/);

    // 4. User says "bye" -> must reply as a well-wisher with warm farewell
    const turn4 = await askAmiroIntelligenceDemo("bye", convId);
    expect(turn4.assistantMessage.content).not.toBe(turn3.assistantMessage.content);
    expect(turn4.assistantMessage.content).toMatch(/Goodbye|Wishing you a wonderful|Take good care|See you soon/);
  });

  it("provides multilingual well-wisher replies and handles intake cancellation cleanly", async () => {
    // Tamil well-wisher farewell
    const taBye = await askAmiroIntelligenceDemo("bye", "conv-ta-bye", "ta");
    expect(taBye.assistantMessage.content).toContain("விடைபெறுகிறேன்");
    expect(taBye.assistantMessage.content).toContain("நல்வாழ்த்துகள்");

    // Telugu well-wisher agreement
    const teOk = await askAmiroIntelligenceDemo("ok", "conv-te-ok", "te");
    expect(teOk.assistantMessage.content).toContain("చాలా సంతోషం");
    expect(teOk.assistantMessage.content).toContain("విజయవంతం");

    // Intake cancellation on "bye" without repeating previous intake prompts
    const intakeConv = "conv-intake-bye-test";
    const intakeStart = await askAmiroIntelligenceDemo("fill client details", intakeConv);
    expect(intakeStart.assistantMessage.content).toContain("Step 1 of 4: Company Name");

    // User says "bye" instead of entering company name -> must NOT repeat intake prompt or save "bye" as company!
    const intakeBye = await askAmiroIntelligenceDemo("bye", intakeConv);
    expect(intakeBye.assistantMessage.content).not.toContain("Step 1 of 4");
    expect(intakeBye.assistantMessage.content).not.toContain("Company Name saved");
    expect(intakeBye.assistantMessage.content).toMatch(/Goodbye|Wishing you a wonderful/);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("answers queries about specific application projects and clients with real records", async () => {
    vi.spyOn(projectService, "getProjects").mockResolvedValue([
      {
        id: "proj-1",
        client_id: "client-1",
        project_code: "PRI-5130",
        project_name: "TUV LIMS",
        project_type: "Software",
        description: "LIMS Lab Automation",
        status: "planned",
        priority: "high",
        assigned_manager: "Rajesh Kumar",
        target_end_date: "2027-02-01",
        project_value: 150000,
        tags: [],
        created_at: new Date().toISOString()
      }
    ] as any);

    vi.spyOn(clientService, "getClients").mockResolvedValue([
      {
        id: "client-1",
        company_name: "Apex Global Technologies",
        industry: "Enterprise Cloud",
        status: "active",
        contact_person: "Rajesh Kumar",
        email: "rajesh@apex.com",
        phone: "+91 98490 12345",
        created_at: new Date().toISOString()
      }
    ] as any);

    // Project lookup
    const projRes = await askAmiroIntelligenceDemo("PRI-5130", "conv-test-project-lookup");
    expect(projRes.assistantMessage.content).toContain("PRI-5130");
    expect(projRes.assistantMessage.content).toContain("TUV LIMS");
    expect(projRes.assistantMessage.content).toContain("Assigned Manager");

    // Client lookup
    const clientRes = await askAmiroIntelligenceDemo("Apex Global Technologies", "conv-test-client-lookup");
    expect(clientRes.assistantMessage.content).toContain("Apex Global Technologies");
    expect(clientRes.assistantMessage.content).toContain("Client 360 Summary");

    // General application status returns dynamic operational metrics rather than a static string
    const generalRes = await askAmiroIntelligenceDemo("summarize system status", "conv-test-general-status");
    expect(generalRes.assistantMessage.content).not.toBe("I'm here to assist with Amiro Tech Solutions operations. Please let me know what you would like to check regarding our clients, invoices, active projects, or quotations.");
    expect(generalRes.assistantMessage.content).toMatch(/registered clients|delivery projects|realized monthly revenue/);
  });
});

