import { detectCopilotIntent, calculateMonthlyFinancials } from "@/lib/copilotTools";
import { invoiceService } from "@/services/invoiceService";
import { clientService } from "@/services/clientService";
import { projectService } from "@/services/projectService";
import { quotationService } from "@/services/quotationService";
import { paymentService } from "@/services/paymentService";
import { expenseService } from "@/services/expenseService";
import { maintenanceService } from "@/services/maintenanceService";
import { contractService } from "@/services/contractService";
import { activityService } from "@/services/activityService";
import type { CopilotRecord, CopilotMessage, CopilotConversation } from "@/types/copilot";
import {
  handleClientIntakeTurn,
  getClientIntakeSession,
  saveClientIntakeSession,
  clearClientIntakeSession,
  DEMO_CLIENT_INTAKE_PREFILL_KEY,
  type ClientIntakeStep,
  type ClientIntakeData,
  type ClientIntakeSession
} from "./clientIntake";

export {
  handleClientIntakeTurn,
  getClientIntakeSession,
  saveClientIntakeSession,
  clearClientIntakeSession,
  DEMO_CLIENT_INTAKE_PREFILL_KEY,
  type ClientIntakeStep,
  type ClientIntakeData,
  type ClientIntakeSession
};

const DEMO_COPILOT_CONVERSATIONS_KEY = "business-ops-demo-copilot-conversations";
const DEMO_COPILOT_MESSAGES_KEY = "business-ops-demo-copilot-messages";

// Resilient memory cache to persist conversations across SSR, tests, and client sessions
const inMemoryConversations: Map<string, CopilotConversation> = new Map();
const inMemoryMessages: Map<string, CopilotMessage[]> = new Map();

export function getDemoConversations(): CopilotConversation[] {
  if (typeof window === "undefined") {
    return Array.from(inMemoryConversations.values());
  }
  const raw = window.localStorage.getItem(DEMO_COPILOT_CONVERSATIONS_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        parsed.forEach((c: CopilotConversation) => inMemoryConversations.set(c.id, c));
        return parsed;
      }
    } catch {
      // Fall through to in-memory
    }
  }
  return Array.from(inMemoryConversations.values());
}

export function saveDemoConversation(conv: CopilotConversation) {
  inMemoryConversations.set(conv.id, conv);
  if (typeof window === "undefined") return;
  const list = getDemoConversations();
  const existingIdx = list.findIndex((c) => c.id === conv.id);
  if (existingIdx >= 0) {
    list[existingIdx] = conv;
  } else {
    list.unshift(conv);
  }
  window.localStorage.setItem(DEMO_COPILOT_CONVERSATIONS_KEY, JSON.stringify(list));
}

export function getDemoMessages(conversationId: string): CopilotMessage[] {
  if (typeof window === "undefined") {
    return inMemoryMessages.get(conversationId) || [];
  }
  const raw = window.localStorage.getItem(`${DEMO_COPILOT_MESSAGES_KEY}-${conversationId}`);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      // Fall through
    }
  }
  return inMemoryMessages.get(conversationId) || [];
}

export function saveDemoMessages(conversationId: string, messages: CopilotMessage[]) {
  inMemoryMessages.set(conversationId, messages);
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`${DEMO_COPILOT_MESSAGES_KEY}-${conversationId}`, JSON.stringify(messages));
}

export type SupportedLanguage = "en" | "hi" | "te" | "kn" | "ta" | "ml" | "mr" | "bn" | "gu" | "ar" | "es" | "hinglish";

export function detectQuestionLanguage(text: string, preferred?: string): SupportedLanguage {
  if (preferred && preferred !== "auto") {
    return preferred as SupportedLanguage;
  }
  // Malayalam script: \u0D00-\u0D7F
  if (/[\u0D00-\u0D7F]/.test(text)) return "ml";
  // Tamil script: \u0B80-\u0BFF
  if (/[\u0B80-\u0BFF]/.test(text)) return "ta";
  // Telugu script: \u0C00-\u0C7F
  if (/[\u0C00-\u0C7F]/.test(text)) return "te";
  // Kannada script: \u0C80-\u0CFF
  if (/[\u0C80-\u0CFF]/.test(text)) return "kn";
  // Bengali script: \u0980-\u09FF
  if (/[\u0980-\u09FF]/.test(text)) return "bn";
  // Gujarati script: \u0A80-\u0AFF
  if (/[\u0A80-\u0AFF]/.test(text)) return "gu";
  // Arabic script: \u0600-\u06FF
  if (/[\u0600-\u06FF]/.test(text)) return "ar";
  // Devanagari script: \u0900-\u097F
  if (/[\u0900-\u097F]/.test(text)) {
    if (/\b(aahe|kiti|sang|dakhav|kasa|kay|aamhi)\b/i.test(text) || /(आहे|किती|सांगा|दाखवा|कसा|काय|आम्ही|नमस्कार)/.test(text)) return "mr";
    return "hi";
  }

  // Transliteration checks for regional conversational phrases
  if (/\b(namaskaram|enthoke|vishesham|parayoo|sahayikamo|aaraanu|engane|enthaanu)\b/i.test(text)) return "ml";
  if (/\b(vanakkam|eppadi|irukkinga|sollunga|solunga|ungal|peyar|enna)\b/i.test(text)) return "ta";
  if (/\b(namaskaram|ela\s+unnav|cheppandi|kavalanukuntunna|meeru|peru|evaru)\b/i.test(text)) return "te";
  if (/\b(namaskara|hegiddira|heli|beku|nimma|hesaru|yaaru)\b/i.test(text)) return "kn";
  if (/\b(namaskar|kasa\s+kay|sangaa|mahit|ahe)\b/i.test(text)) return "mr";
  if (/\b(marhaba|shukran|kayfa\s+haluk|ahlan)\b/i.test(text)) return "ar";
  if (/\b(hola|gracias|facturas?|proyectos?|cotizaciones?|cuanto|por favor)\b/i.test(text)) return "es";
  if (/\b(dikhao|batao|karo|kitna|kaun|hai|hoga|baki|paisa|kuch|naam)\b/i.test(text)) return "hinglish";
  return "en";
}

export async function askAmiroIntelligenceDemo(
  question: string,
  currentConvId?: string,
  preferredLanguage?: string
): Promise<{
  conversation: CopilotConversation;
  userMessage: CopilotMessage;
  assistantMessage: CopilotMessage;
}> {
  const convId = currentConvId || `conv-${Date.now()}`;
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  const userMessage: CopilotMessage = {
    id: `msg-${Date.now()}-u`,
    role: "user",
    content: question,
    records: [],
    created_at: now
  };

  // Analyze records from all demo stores
  const [
    clients,
    invoices,
    projects,
    quotations,
    payments,
    expenses,
    tickets,
    contracts,
    activities
  ] = await Promise.all([
    clientService.getClients().catch(() => []),
    invoiceService.getInvoices().catch(() => []),
    projectService.getProjects().catch(() => []),
    quotationService.getQuotations().catch(() => []),
    paymentService.getAllPayments().catch(() => []),
    expenseService.getExpenses().catch(() => []),
    maintenanceService.getSupportTickets().catch(() => []),
    contractService.getContracts().catch(() => []),
    activityService.getActivities().catch(() => [])
  ]);

  // Determine language:
  // 1. Explicitly selected language from the UI dropdown strictly dictates response language
  // 2. In auto-detect mode, always detect the language directly from the current question first
  // 3. If question is neutral/English, retain active non-English conversation language unless explicitly English query
  const existingConv = getDemoConversations().find((c) => c.id === convId);
  const existingLanguage = existingConv?.language;

  let lang: SupportedLanguage = "en";
  if (preferredLanguage && preferredLanguage !== "auto") {
    lang = preferredLanguage as SupportedLanguage;
  } else {
    const detected = detectQuestionLanguage(question);
    if (detected !== "en") {
      lang = detected;
    } else if (existingLanguage && existingLanguage !== "auto" && existingLanguage !== "en") {
      const isEnglishQuery = /\b(what|who|which|how|where|show|list|tell|give|fill|create|help|is|are|the|can|name)\b/i.test(question);
      if (isEnglishQuery) {
        lang = "en";
      } else {
        lang = existingLanguage as SupportedLanguage;
      }
    } else {
      lang = "en";
    }
  }

  const clientMap = new Map(clients.map((c) => [c.id, c.company_name]));
  const intent = detectCopilotIntent(question);

  let answer = "";
  const records: CopilotRecord[] = [];

  // 1. Process conversational client intake steps if active or triggered
  const intakeResult = handleClientIntakeTurn(question, convId, lang, intent || "");
  if (intakeResult) {
    answer = intakeResult.answer;
    records.push(...intakeResult.records);

    const assistantMessage: CopilotMessage = {
      id: `msg-${Date.now()}-a`,
      role: "assistant",
      content: answer,
      records,
      created_at: new Date().toISOString()
    };
    const title = existingConv?.title || (question.length > 28 ? `${question.slice(0, 28)}...` : question);
    const updatedConv: CopilotConversation = {
      id: convId,
      title,
      updated_at: now,
      language: lang
    };
    saveDemoConversation(updatedConv);
    saveDemoMessages(convId, [...getDemoMessages(convId), userMessage, assistantMessage]);
    return {
      conversation: updatedConv,
      userMessage,
      assistantMessage
    };
  }

  // Compile business facts package for the LLM
  const overdueInvoices = invoices.filter(
    (inv) =>
      inv.status === "overdue" ||
      (Number(inv.balance_due) > 0 && inv.due_date && inv.due_date < today && inv.status !== "cancelled")
  );
  const totalOverdue = overdueInvoices.reduce((sum, inv) => sum + Number(inv.balance_due || 0), 0);
  const monthlyFin = calculateMonthlyFinancials(payments, expenses);
  const pendingQuotes = quotations.filter((q) => ["draft", "sent", "under_review"].includes(q.status));
  const delayedProjects = projects.filter(
    (p) => !["completed", "closed", "cancelled"].includes(p.status) && p.target_end_date && p.target_end_date < today
  );
  const openTickets = tickets.filter((t) => ["new", "assigned", "in_progress"].includes(t.status));
  const expiringContracts = contracts.filter((c) => c.end_date && c.end_date < today);

  const businessFacts = {
    asOf: today,
    company: "Amiro Tech Solutions",
    currency: "INR (₹)",
    metrics: {
      totalClients: clients.length,
      activeClients: clients.filter((c) => c.status === "active").length,
      totalInvoices: invoices.length,
      overdueInvoicesCount: overdueInvoices.length,
      overdueTotalAmount: totalOverdue,
      monthlyRevenue: monthlyFin.revenue,
      monthlyExpenses: monthlyFin.approvedExpenses,
      netProfit: monthlyFin.revenue - monthlyFin.approvedExpenses,
      pendingQuotationsCount: pendingQuotes.length,
      delayedProjectsCount: delayedProjects.length,
      openTicketsCount: openTickets.length,
      expiringContractsCount: expiringContracts.length
    },
    overdueInvoices: overdueInvoices.map((inv) => ({
      invoiceNumber: inv.invoice_number,
      client: clientMap.get(inv.client_id) || "Client",
      balanceDue: inv.balance_due,
      dueDate: inv.due_date
    })),
    pendingQuotations: pendingQuotes.map((q) => ({
      quoteNumber: q.quotation_number,
      client: clientMap.get(q.client_id) || "Client",
      amount: q.total_amount,
      status: q.status
    })),
    delayedProjects: delayedProjects.map((p) => ({
      code: p.project_code,
      name: p.project_name,
      targetEndDate: p.target_end_date,
      manager: p.assigned_manager
    }))
  };

  const isGreeting = /^(hi|hello|hey|greetings|namaste|vanakkam|namaskar|hola)\b/i.test(question.trim()) ||
    /^(नमस्ते|నమస్కారం|నమస్తే|నమస్కారాలు|ನಮಸ್ಕಾರ|வணக்கம்|നമസ്കാരം|नमस्कार|নমস্কার|નમસ્તે|مرحبا)/i.test(question.trim()) ||
    /^(hi|hello|hey|नमस्ते|నమస్కారం|నమస్తే|ನಮಸ್ಕಾರ|வணக்கம்|നമസ്കാരം)$/i.test(question.trim());
  const isIdentity = /\b(who are you|what('s| is| are)? your name|what your name|your name|name please|what can you do|who made you|tum kaun ho|tera naam|naam kya hai|nuvvu evaru|neeku emi telusu|nee peru|un peyar|unga peru|tell me what you do)\b/i.test(question) ||
    /^(who are you|what your name|what is your name|your name)$/i.test(question.trim()) ||
    /(உன் பெயர்|உங்கள் பெயர்|நீ பெயர்|నీ పేరు|మీరు ఎవరు|तुम्हारा नाम|आप कौन हैं|ನಿಮ್ಮ ಹೆಸರು|ನೀವು ಯಾರು|ಯಾರು ನೀವು|നിങ്ങളുടെ പേര്|നിങ്ങൾ ആരാണ്|ആരാണ് നിങ്ങൾ|नाव काय)/.test(question);
  const isLocation = /\b(where are you|where r u|kahan ho|ekkada unnav|enga irukinga|evideyanu)\b/i.test(question);
  const isConversationalHelp = /\b(let me know|tell me|what do you want|kya chahiye|em kavali|how can you help)\b/i.test(question);
  const isOffTopic = /\b(joke|story|capital of|weather|recipe|sing|movie|president|prime minister|cricket|football|who is the president)\b/i.test(question);
  const isQuickConversational = isGreeting || isIdentity || isLocation || isConversationalHelp || isOffTopic;

  // Attempt live LLM inference (e.g. Qwen 2.5 via Ollama/OpenRouter/API) if configured on server and query is business-oriented
  let llmAnswer: string | null = null;
  if (!isQuickConversational) {
    try {
      const prior = getDemoMessages(convId).slice(-2).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content
      }));

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 9000);

      const response = await fetch("/api/copilot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: question,
          facts: businessFacts,
          history: prior,
          language: lang
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const payload = await response.json();
        if (payload && typeof payload.answer === "string" && !payload.fallback) {
          llmAnswer = payload.answer;
        }
      }
    } catch {
      // If backend LLM endpoint unreachable or slow, seamlessly fall back to local multilingual synthesis
      llmAnswer = null;
    }
  }

  // Populate records shortcut cards based on identified intent
  if (intent === "fill_client_form" || /\b(fill|auto.?fill|populate|register|create)\b.*\b(client|form|portal|onboard|wizard)\b/i.test(question) || /(ഫോം\s*പൂരിപ്പിക്കുക|ഫారం\s*నింపండి|फॉर्म\s*भर|படிவம்\s*நிரப்பு|ಫಾರ್ಮ್\s*ಭರ್ತಿ)/i.test(question)) {
    records.push(
      {
        id: "rec-fill-client",
        entity: "client",
        label: "✨ Auto-Fill Client Form (/clients/new?autofill=true)",
        href: "/clients/new?autofill=true",
        detail: "Apex Global Technologies Pvt Ltd · 100% Pre-Populated Corporate Data"
      },
      {
        id: "rec-fill-wizard",
        entity: "client",
        label: "⚡ Auto-Fill 6-Step Onboarding Wizard (/clients/onboard?autofill=true)",
        href: "/clients/onboard?autofill=true",
        detail: "Auto-Populates KYC, Stakeholders, Scope, Commercials & Project Setup"
      },
      {
        id: "rec-fill-quote",
        entity: "quotation",
        label: "📄 Auto-Fill Quotation Proposal (/quotations/new?autofill=true)",
        href: "/quotations/new?autofill=true",
        detail: "Enterprise Cloud ERP Scope, Milestones & Itemized Pricing"
      }
    );
  } else if (intent === "company_brief" || /amiro/i.test(question)) {
    records.push({
      id: "dash-brief",
      entity: "client",
      label: "Amiro Tech Solutions – Executive Dashboard",
      href: "/dashboard",
      detail: `${clients.length} accounts · ₹${payments.reduce((s, p) => s + Number(p.amount), 0).toLocaleString("en-IN")} realized`
    });
  } else if (intent === "clients_overview" || /client|ग्राहक|క్లయింట్|ക്ലയന്|ಗ್ರಾಹಕ|வாடிக்கையாளர்/i.test(question)) {
    clients.slice(0, 3).forEach((c) => {
      records.push({
        id: c.id,
        entity: "client",
        label: c.company_name,
        href: `/clients/${c.id}`,
        detail: `${c.industry || "Enterprise"} · Status: ${c.status}`
      });
    });
  } else if (intent === "active_projects" || /project|प्रोजेक्ट|ప్రాజెక్ట్/i.test(question)) {
    projects.slice(0, 3).forEach((p) => {
      records.push({
        id: p.id,
        entity: "project",
        label: `${p.project_code} – ${p.project_name}`,
        href: `/projects`,
        detail: `Target: ${p.target_end_date || "N/A"} · Status: ${p.status}`
      });
    });
  } else if (intent === "overdue_invoices" || /invoice|बिल|चालान/i.test(question)) {
    overdueInvoices.forEach((inv) => {
      records.push({
        id: inv.id,
        entity: "invoice",
        label: `${inv.invoice_number} – ${clientMap.get(inv.client_id) || "Client"}`,
        href: `/invoices`,
        detail: `₹${Number(inv.balance_due).toLocaleString("en-IN")} due (${inv.due_date})`
      });
    });
  } else if (intent === "pending_quotations" || /quotation|quote|कोटेशन/i.test(question)) {
    pendingQuotes.forEach((q) => {
      records.push({
        id: q.id,
        entity: "quotation",
        label: `${q.quotation_number} – ${clientMap.get(q.client_id) || "Client"}`,
        href: `/quotations`,
        detail: `₹${Number(q.total_amount).toLocaleString("en-IN")} · Status: ${q.status}`
      });
    });
  } else if (intent === "delayed_projects" || /project|प्रोजेक्ट|ప్రాజెక్ట్/i.test(question)) {
    delayedProjects.forEach((p) => {
      records.push({
        id: p.id,
        entity: "project",
        label: `${p.project_code} – ${p.project_name}`,
        href: `/projects`,
        detail: `Target: ${p.target_end_date} · Status: ${p.status}`
      });
    });
  } else if (intent === "monthly_financials" || /revenue|कमाई|खर्च/i.test(question)) {
    payments.slice(0, 3).forEach((p) => {
      records.push({
        id: p.id,
        entity: "invoice",
        label: `Receipt #${p.id.slice(-6).toUpperCase()} – ₹${Number(p.amount).toLocaleString("en-IN")}`,
        href: "/payments",
        detail: `Settlement on ${p.payment_date}`
      });
    });
  }

  // If LLM returned answer, use it directly!
  if (llmAnswer) {
    answer = llmAnswer;
  } else {
    // Built-in Multilingual Grounded Synthesis Engine (Hindi, Telugu, Tamil, Spanish, Hinglish, English)
    switch (intent) {
      case "fill_client_form": {
        if (lang === "ml") {
          answer = `### ✨ എന്റർപ്രൈസ് പ്രൊഫൈൽ തയ്യാറാക്കി — ഓട്ടോ-ഫിൽ ലഭ്യമാണ്!\n\n` +
            `**Apex Global Technologies Pvt Ltd**-നായുള്ള പൂർണ്ണമായ കോർപ്പറേറ്റ് വിവരങ്ങൾ സിസ്റ്റം ഓട്ടോമാറ്റിക്കായി തയ്യാറാക്കിയിട്ടുണ്ട്. നിങ്ങൾ സ്വമേധയാ ഒന്നും ടൈപ്പ് ചെയ്യേണ്ടതില്ല!\n\n` +
            `• **കമ്പനി:** Apex Global Technologies Pvt Ltd\n` +
            `• **ബന്ധപ്പെടേണ്ട വ്യക്തി:** Rajesh Kumar (CTO) · rajesh.kumar@apextech.com\n` +
            `• **ഫോൺ:** +91 98490 12345\n` +
            `• **GSTIN:** 36AAACA1234A1Z5 | **PAN:** AAACA1234A\n` +
            `• **മേൽവിലാസം:** Plot 42, Hitech City, Madhapur, Hyderabad, Telangana\n` +
            `• **മേഖല:** Enterprise Cloud & Software Services\n\n` +
            `👉 **[ക്ലയന്റ് ഫോം ഓട്ടോ-ഫിൽ ചെയ്യാൻ ഇവിടെ ക്ലിക്ക് ചെയ്യുക](/clients/new?autofill=true)**\n` +
            `👉 **[6-ഘട്ട ഓൺബോർഡിംഗ് വിസാർഡ് ഓട്ടോ-ഫിൽ ചെയ്യാൻ ഇവിടെ ക്ലിക്ക് ചെയ്യുക](/clients/onboard?autofill=true)**\n` +
            `👉 **[കൊട്ടേഷൻ പ്രൊപ്പോസൽ ഓട്ടോ-ഫിൽ ചെയ്യാൻ ഇവിടെ ക്ലിക്ക് ചെയ്യുക](/quotations/new?autofill=true)**`;
        } else if (lang === "ta") {
          answer = `### ✨ நிறுவன சுயவிவரம் தயாராக உள்ளது — படிவம் தானாக நிரப்பப்பட்டது!\n\n` +
            `**Apex Global Technologies Pvt Ltd** நிறுவனத்திற்கான முழுமையான கார்ப்பரேட் விவரங்களை AI தயார் செய்துள்ளது. நீங்கள் எந்த விவரத்தையும் கைமுறையாக உள்ளிட தேவையில்லை!\n\n` +
            `• **நிறுவனம்:** Apex Global Technologies Pvt Ltd\n` +
            `• **தொடர்பு நபர்:** Rajesh Kumar (CTO) · rajesh.kumar@apextech.com\n` +
            `• **தொலைபேசி:** +91 98490 12345\n` +
            `• **GSTIN:** 36AAACA1234A1Z5 | **PAN:** AAACA1234A\n` +
            `• **முகவரி:** Plot 42, Hitech City, Madhapur, Hyderabad, Telangana\n\n` +
            `👉 **[வாடிக்கையாளர் படிவத்தை தானாக நிரப்ப இங்கே கிளிக் செய்க](/clients/new?autofill=true)**\n` +
            `👉 **[6-படி ஆன் போர்டிங் வழிகாட்டியை தானாக நிரப்புக](/clients/onboard?autofill=true)**\n` +
            `👉 **[விலை மேற்கோள் படிவத்தை தானாக நிரப்புக](/quotations/new?autofill=true)**`;
        } else if (lang === "te") {
          answer = `### ✨ ఎంటర్‌ప్రైజ్ ప్రొఫైల్ సిద్ధమైంది — ఆటో-ఫిల్ సిద్ధంగా ఉంది!\n\n` +
            `**Apex Global Technologies Pvt Ltd** కోసం పూర్తి కార్పొరేట్ వివరాలను సిస్టమ్ సిద్ధం చేసింది. మీరు మాన్యువల్‌గా ఏమీ నమోదు చేయవలసిన అవసరం లేదు!\n\n` +
            `• **కంపెనీ:** Apex Global Technologies Pvt Ltd\n` +
            `• **సంప్రదింపు వ్యక్తి:** Rajesh Kumar (CTO) · rajesh.kumar@apextech.com\n` +
            `• **ఫోన్:** +91 98490 12345\n` +
            `• **GSTIN:** 36AAACA1234A1Z5 | **PAN:** AAACA1234A\n` +
            `• **చిరునామా:** Plot 42, Hitech City, Madhapur, Hyderabad, Telangana\n\n` +
            `👉 **[క్లయింట్ ఫారమ్‌ను ఆటో-ఫిల్ చేయడానికి ఇక్కడ క్లిక్ చేయండి](/clients/new?autofill=true)**\n` +
            `👉 **[6-దశల ఆన్‌బోర్డింగ్ విజార్డ్‌ను ఆటో-ఫిల్ చేయండి](/clients/onboard?autofill=true)**\n` +
            `👉 **[కొటేషన్ ప్రతిపాదనను ఆటో-ఫిల్ చేయండి](/quotations/new?autofill=true)**`;
        } else if (lang === "hi") {
          answer = `### ✨ एंटरप्राइज प्रोफाइल तैयार है — ऑटो-फिल सक्रिय!\n\n` +
            `**Apex Global Technologies Pvt Ltd** के लिए संपूर्ण कॉर्पोरेट विवरण स्वचालित रूप से तैयार कर दिया गया है। आपको मैन्युअल रूप से कुछ भी टाइप करने की आवश्यकता नहीं है!\n\n` +
            `• **कंपनी:** Apex Global Technologies Pvt Ltd\n` +
            `• **संपर्क व्यक्ति:** Rajesh Kumar (CTO) · rajesh.kumar@apextech.com\n` +
            `• **फोन:** +91 98490 12345\n` +
            `• **GSTIN:** 36AAACA1234A1Z5 | **PAN:** AAACA1234A\n` +
            `• **पता:** Plot 42, Hitech City, Madhapur, Hyderabad, Telangana\n\n` +
            `👉 **[क्लाइंट फॉर्म को ऑटो-फिल करने के लिए यहाँ क्लिक करें](/clients/new?autofill=true)**\n` +
            `👉 **[6-चरणीय ऑनबोर्डिंग विज़ार्ड को ऑटो-फिल करें](/clients/onboard?autofill=true)**\n` +
            `👉 **[कोटेशन प्रस्ताव को ऑटो-फिल करें](/quotations/new?autofill=true)**`;
        } else if (lang === "kn") {
          answer = `### ✨ ಎಂಟರ್‌ಪ್ರೈಸ್ ಪ್ರೊಫೈಲ್ ಸಿದ್ಧವಾಗಿದೆ — ಆಟೋ-ಫಿಲ್ ಲಭ್ಯವಿದೆ!\n\n` +
            `**Apex Global Technologies Pvt Ltd** ಗಾಗಿ ಸಂಪೂರ್ಣ ಕಾರ್ಪೊರೇಟ್ ವಿವರಗಳನ್ನು ಸಿಸ್ಟಮ್ ಸ್ವಯಂಚಾಲಿತವಾಗಿ ಸಿದ್ಧಪಡಿಸಿದೆ. ನೀವು ಹಸ್ತಚಾಲಿತವಾಗಿ ಏನನ್ನೂ ಟೈಪ್ ಮಾಡುವ ಅಗತ್ಯವಿಲ್ಲ!\n\n` +
            `• **ಕಂಪನಿ:** Apex Global Technologies Pvt Ltd\n` +
            `• **ಸಂಪರ್ಕ ವ್ಯಕ್ತಿ:** Rajesh Kumar (CTO) · rajesh.kumar@apextech.com\n` +
            `• **GSTIN:** 36AAACA1234A1Z5 | **PAN:** AAACA1234A\n\n` +
            `👉 **[ಕ್ಲೈಂಟ್ ಫಾರ್ಮ್ ಅನ್ನು ಆಟೋ-ಫಿಲ್ ಮಾಡಲು ಇಲ್ಲಿ ಕ್ಲಿಕ್ ಮಾಡಿ](/clients/new?autofill=true)**\n` +
            `👉 **[6-ಹಂತದ ಆನ್‌ಬೋರ್ಡಿಂಗ್ ವಿಝಾರ್ಡ್ ತೆರೆಯಿರಿ](/clients/onboard?autofill=true)**`;
        } else if (lang === "mr") {
          answer = `### ✨ एंटरप्राइझ प्रोफाइल तयार आहे — ऑटो-फिल उपलब्ध!\n\n` +
            `**Apex Global Technologies Pvt Ltd** साठी संपूर्ण कॉर्पोरेट तपशील आपोआप तयार केला आहे. मॅन्युअली काहीही टाईप करण्याची गरज नाही!\n\n` +
            `• **कंपनी:** Apex Global Technologies Pvt Ltd\n` +
            `• **संपर्क व्यक्ती:** Rajesh Kumar (CTO) · rajesh.kumar@apextech.com\n` +
            `• **GSTIN:** 36AAACA1234A1Z5 | **PAN:** AAACA1234A\n\n` +
            `👉 **[क्लायंट फॉर्म ऑटो-फिल करण्यासाठी येथे क्लिक करा](/clients/new?autofill=true)**\n` +
            `👉 **[६-टप्प्यांची ऑनबोर्डिंग विझार्ड उघडा](/clients/onboard?autofill=true)**`;
        } else if (lang === "bn") {
          answer = `### ✨ এন্টারপ্রাইজ প্রোফাইল প্রস্তুত — অটো-ফিল উপলব্ধ!\n\n` +
            `**Apex Global Technologies Pvt Ltd**-এর জন্য সম্পূর্ণ তথ্য স্বয়ংক্রিয়ভাবে প্রস্তুত করা হয়েছে। ম্যানুয়ালি কিছু টাইপ করার প্রয়োজন নেই!\n\n` +
            `• **কোম্পানি:** Apex Global Technologies Pvt Ltd\n` +
            `• **যোগাযোগ ব্যক্তি:** Rajesh Kumar (CTO) · rajesh.kumar@apextech.com\n` +
            `• **GSTIN:** 36AAACA1234A1Z5 | **PAN:** AAACA1234A\n\n` +
            `👉 **[ক্লায়েন্ট ফর্ম অটো-ফিল করতে এখানে ক্লিক করুন](/clients/new?autofill=true)**\n` +
            `👉 **[৬-ধাপের অনবোর্ডিং উইজার্ড খুলুন](/clients/onboard?autofill=true)**`;
        } else if (lang === "gu") {
          answer = `### ✨ એન્ટરપ્રાઇઝ પ્રોફાઇલ તૈયાર છે — ઑટો-ફિલ ઉપલબ્ધ!\n\n` +
            `**Apex Global Technologies Pvt Ltd** માટે તમામ વિગતો સિસ્ટમે આપમેળે તૈયાર કરી છે. કોઈ મેન્યુઅલ એન્ટ્રીની જરૂર નથી!\n\n` +
            `• **કંપની:** Apex Global Technologies Pvt Ltd\n` +
            `• **સંપર્ક વ્યક્તિ:** Rajesh Kumar (CTO) · rajesh.kumar@apextech.com\n` +
            `• **GSTIN:** 36AAACA1234A1Z5 | **PAN:** AAACA1234A\n\n` +
            `👉 **[ક્લાયન્ટ ફોર્મ ઑટો-ફિલ કરવા અહીં ક્લિક કરો](/clients/new?autofill=true)**\n` +
            `👉 **[૬-પગલાંનું ઑનબોર્ડિંગ વિઝાર્ડ ખોલો](/clients/onboard?autofill=true)**`;
        } else if (lang === "ar") {
          answer = `### ✨ تم تجهيز ملف تعريف المؤسسة — التعبئة التلقائية جاهزة!\n\n` +
            `تم إعداد السجلات المؤسسية الكاملة لشركة **Apex Global Technologies Pvt Ltd** تلقائياً. لا يلزمك إدخال أي بيانات يدوياً!\n\n` +
            `• **الشركة:** Apex Global Technologies Pvt Ltd\n` +
            `• **مسؤول التواصل:** Rajesh Kumar (CTO) · rajesh.kumar@apextech.com\n` +
            `• **الرقم الضريبي:** 36AAACA1234A1Z5 | **PAN:** AAACA1234A\n\n` +
            `👉 **[انقر هنا لتعبئة نموذج العميل تلقائياً](/clients/new?autofill=true)**\n` +
            `👉 **[فتح معالج الإعداد المكون من 6 خطوات](/clients/onboard?autofill=true)**`;
        } else {
          answer = `### ✨ Enterprise Profile Generated & Ready for Auto-Fill!\n\n` +
            `I have synthesized complete verified enterprise credentials for **Apex Global Technologies Pvt Ltd**. You don't need to type anything manually!\n\n` +
            `• **Company:** Apex Global Technologies Pvt Ltd\n` +
            `• **Contact Person:** Rajesh Kumar (Chief Technology Officer) · rajesh.kumar@apextech.com\n` +
            `• **Phone:** +91 98490 12345\n` +
            `• **GSTIN:** 36AAACA1234A1Z5 | **PAN:** AAACA1234A\n` +
            `• **Address:** Plot 42, Hitech City, Madhapur, Hyderabad, Telangana\n` +
            `• **Industry:** Enterprise Cloud & Software Services\n\n` +
            `👉 **[Open Pre-Filled Client Form](/clients/new?autofill=true)**\n` +
            `👉 **[Open 6-Step Onboarding Wizard](/clients/onboard?autofill=true)**\n` +
            `👉 **[Open Pre-Filled Quotation Proposal](/quotations/new?autofill=true)**`;
        }
        break;
      }

      case "company_brief": {
        const activeClients = clients.filter((c) => c.status === "active");
        const realizedRev = payments.reduce((s, p) => s + Number(p.amount), 0);
        const activeProjs = projects.filter((p) => p.status === "active");

        if (/services|offer|what do you do/i.test(question)) {
          if (lang === "ml") {
            answer = `### അമിറോ ടെക് സൊല്യൂഷൻസ് (Amiro Tech Solutions) — ഞങ്ങളുടെ സേവനങ്ങൾ\n\n` +
              `ഞങ്ങൾ നൽകുന്ന പ്രമുഖ എന്റർപ്രൈസ് സാങ്കേതിക സേവനങ്ങൾ:\n` +
              `• **കസ്റ്റം സോഫ്റ്റ്‌വെയർ വികസനം:** ബിസിനസ്സ് ആവശ്യങ്ങൾക്കനുസരിച്ചുള്ള വെബ് & മൊബൈൽ ആപ്ലിക്കേഷനുകൾ\n` +
              `• **ക്ലൗഡ് & ഡെവോപ്സ്:** സുരക്ഷിതമായ ക്ലൗഡ് ഇൻഫ്രാസ്ട്രക്ചറും ഓട്ടോമേഷനും\n` +
              `• **ബിസിനസ്സ് ഓപ്പറേഷൻസ് പ്ലാറ്റ്‌ഫോമുകൾ:** CRM, ഇൻവോയ്സിംഗ്, പ്രോജക്റ്റ് മാനേജ്‌മെന്റ്\n` +
              `• **മെയിന്റനൻസും SLA പിന്തുണയും:** 24/7 സിസ്റ്റം നിരീക്ഷണവും പരിപാലനവും\n` +
              `• **AI & ബിസിനസ്സ് ഇന്റലിജൻസ്:** തത്സമയ ഡാറ്റ വിശകലനവും സ്മാർട്ട് അസിസ്റ്റന്റും`;
          } else if (lang === "ta") {
            answer = `### அமிரோ டெக் சொல்யூஷன்ஸ் (Amiro Tech Solutions) — எங்கள் சேவைகள்\n\n` +
              `நாங்கள் வழங்கும் முன்னணி நிறுவன தொழில்நுட்ப சேவைகள்:\n` +
              `• **தனிப்பயன் மென்பொருள் மேம்பாடு:** வலை மற்றும் மொபைல் பயன்பாடுகள்\n` +
              `• **கிளவுட் & டெவ்ஆப்ஸ்:** பாதுகாப்பான கிளவுட் உள்கட்டமைப்பு மற்றும் ஆட்டோமேஷன்\n` +
              `• **வணிக செயல்பாட்டு தளங்கள்:** CRM, பில்லிங் மற்றும் திட்ட மேலாண்மை\n` +
              `• **பராமரிப்பு மற்றும் SLA ஆதரவு:** 24/7 கணினி கண்காணிப்பு\n` +
              `• **AI & வணிக நுண்ணறிவு:** நேரலை பகுப்பாய்வு மற்றும் AI உதவியாளர்`;
          } else if (lang === "te") {
            answer = `### అమీరో టెక్ సొల్యూషన్స్ (Amiro Tech Solutions) — మా సేవలు\n\n` +
              `మేము అత్యాధునిక ఎంటర్‌ప్రైజ్ టెక్నాలజీ సేవలను అందిస్తున్నాము:\n` +
              `• **కస్టమ్ సాఫ్ట్‌వేర్ అభివృద్ధి:** వ్యాపార అవసరాలకు అనుగుణంగా వెబ్ మరియు మొబైల్ అప్లికేషన్లు\n` +
              `• **క్లౌడ్ మరియు డెవ్‌ఆప్స్:** సెక్యూర్ క్లౌడ్ ఇన్‌ఫ్రాస్ట్రక్చర్ మరియు ఆటోమేషన్\n` +
              `• **బిజినెస్ ఆపరేషన్స్ ప్లాట్‌ఫారమ్‌లు:** CRM, ఇన్వాయిసింగ్ మరియు ప్రాజెక్ట్ మేనేజ్‌మెంట్ పరిష్కారాలు\n` +
              `• **నిర్వహణ మరియు SLA సపోర్ట్:** 24/7 సిస్టమ్ పర్యవేక్షణ మరియు మెయింటెనెన్స్\n` +
              `• **AI & బిజినెస్ ఇంటెలిజెన్స్:** లైవ్ డేటా అనలిటిక్స్ మరియు స్మార్ట్ కోపైలట్ అసిస్టెంట్లు`;
          } else if (lang === "hi") {
            answer = `### अमीरू टेक सॉल्यूशंस (Amiro Tech Solutions) — हमारी सेवाएं\n\n` +
              `हम प्रमुख एंटरप्राइज टेक्नोलॉजी समाधान प्रदान करते हैं:\n` +
              `• **कस्टम सॉफ्टवेयर विकास:** आधुनिक क्लाउड-रेडी वेब व मोबाइल एंटरप्राइज समाधान\n` +
              `• **क्लाउड एवं डेवऑप्स इन्फ्रास्ट्रक्चर:** सुरक्षित और उच्च-प्रदर्शन सर्वर प्रबंधन\n` +
              `• **बिज़नेस ऑपरेशन्स सिस्टम्स:** CRM, बिलिंग, इनवॉइसिंग और वर्कफ़्लो ऑटोमेशन\n` +
              `• **वार्षिक रखरखाव एवं SLA समर्थन:** 24/7 तकनीकी सहायता और सिस्टम स्थिरता\n` +
              `• **AI एवं बिज़नेस इंटेलिजेंस:** वास्तविक समय में वित्तीय और परिचालन डेटा विश्लेषण`;
          } else if (lang === "kn") {
            answer = `### ಅಮಿರೋ ಟೆಕ್ ಸೊಲ್ಯೂಷನ್ಸ್ (Amiro Tech Solutions) — ನಮ್ಮ ಸೇವೆಗಳು\n\n` +
              `• **ಕಸ್ಟಮ್ ಸಾಫ್ಟ್‌ವೇರ್ ಅಭಿವೃದ್ಧಿ:** ವೆಬ್ ಮತ್ತು ಮೊಬೈಲ್ ಅಪ್ಲಿಕೇಶನ್‌ಗಳು\n` +
              `• **ಕ್ಲೌಡ್ ಮತ್ತು ಡೆವ್‌ಆಪ್ಸ್:** ಕ್ಲೌಡ್ ಮೂಲಸೌಕರ್ಯ ಮತ್ತು ಆಟೋಮೇಷನ್\n` +
              `• **ವ್ಯಾಪಾರ ಕಾರ್ಯಾಚರಣೆ ವೇದಿಕೆಗಳು:** CRM, ಇನ್‌ವಾಯ್ಸಿಂಗ್ ಮತ್ತು ಪ್ರಾಜೆಕ್ಟ್ ಮ್ಯಾನೇಜ್‌ಮೆಂಟ್\n` +
              `• **ನಿರ್ವಹಣೆ ಮತ್ತು SLA ಬೆಂಬಲ:** 24/7 ಸಿಸ್ಟಮ್ ಮಾನಿಟರಿಂಗ್\n` +
              `• **AI & ಬಿಸಿನೆಸ್ ಇಂಟೆಲಿಜೆನ್ಸ್:** ಲೈವ್ ಡೇಟಾ ವಿಶ್ಲೇಷಣೆ ಮತ್ತು AI ಸಹಾಯಕ`;
          } else {
            answer = `### Amiro Tech Solutions — Enterprise Services & Capabilities\n\n` +
              `We provide comprehensive enterprise digital operations and software engineering services:\n` +
              `• **Custom Enterprise Engineering:** High-performance web applications, portals, and workflow engines.\n` +
              `• **Cloud Architecture & DevOps:** Resilient cloud hosting, CI/CD pipelines, and infrastructure automation.\n` +
              `• **Business Operations Platforms:** CRM pipelines, commercial quotations, billing, and project tracking.\n` +
              `• **SLA & Maintenance Contracts:** Dedicated 24/7 technical support, incident resolution, and preventative updates.\n` +
              `• **AI & Operational Intelligence:** Real-time metrics calculation, financial modeling, and conversational business copilot.`;
          }
        } else if (/get started|getting started|how to start/i.test(question)) {
          answer = `### Getting Started with Amiro Business Operations\n\n` +
            `Welcome to the enterprise platform! Here is how to navigate and get the most out of your operations:\n` +
            `1. **Executive Dashboard:** Access top-line KPIs, realized revenue, and delivery velocity from the main screen.\n` +
            `2. **CRM & Clients:** Onboard client accounts, track leads, and log communication activities.\n` +
            `3. **Quotations & Estimates:** Issue commercial quotes, manage tax line items, and request client approvals.\n` +
            `4. **Projects:** Plan delivery milestones, track completion status, and monitor team deadlines.\n` +
            `5. **Invoices & Finance:** Generate invoices, record payments, and audit overdue accounts.\n` +
            `6. **Amiro Intelligence:** Click this floating AI widget anytime to ask questions in any language!`;
        } else if (lang === "ml") {
          answer = `### അമിറോ ടെക് സൊല്യൂഷൻസ് (Amiro Tech Solutions) — കമ്പനി സംഗ്രഹം\n\n` +
            `**അമിറോ ടെക് സൊല്യൂഷൻസ്** അത്യാധുനിക എന്റർപ്രൈസ് സോഫ്റ്റ്‌വെയർ, ക്ലൗഡ് ഇന്റഗ്രേഷൻ, ബിസിനസ്സ് പ്രവർത്തന പരിഹാരങ്ങൾ നൽകുന്ന പ്രമുഖ സ്ഥാപനമാണ്.\n\n` +
            `**തത്സമയ പ്രവർത്തന വിവരങ്ങൾ:**\n` +
            `• **ക്ലയന്റുകൾ:** ആകെ **${clients.length} ക്ലയന്റ് അക്കൗണ്ടുകൾ** (${activeClients.length} സജീവം)\n` +
            `• **ലഭിച്ച ആകെ വരുമാനം:** **₹${realizedRev.toLocaleString("en-IN", { minimumFractionDigits: 2 })}**\n` +
            `• **സജീവ പ്രോജക്റ്റുകൾ:** **${activeProjs.length} പ്രോജക്റ്റുകൾ** പുരോഗമിക്കുന്നു\n` +
            `• **പെൻഡിംഗ് കൊട്ടേഷനുകൾ:** **${pendingQuotes.length} എണ്ണം**\n` +
            `• **കുടിശ്ശികയുള്ള ഇൻവോയ്സുകൾ:** **${overdueInvoices.length} എണ്ണം** (ആകെ ₹${totalOverdue.toLocaleString("en-IN", { minimumFractionDigits: 2 })})\n` +
            `• **കരാറുകളും ടിക്കറ്റുകളും:** **${contracts.length} സജീവ കരാറുകൾ**, **${openTickets.length} ഓപ്പൺ ടിക്കറ്റുകൾ**`;
        } else if (lang === "ta") {
          answer = `### அமிரோ டெக் சொல்யூஷன்ஸ் (Amiro Tech Solutions) — வணிகச் சுருக்கம்\n\n` +
            `**அமிரோ டெக் சொல்யூஷன்ஸ்** நிறுவன தொழில்நுட்ப தீர்வுகள் மற்றும் வணிக செயல்பாட்டு தளங்களை வழங்கும் முதன்மை நிறுவனம்.\n\n` +
            `**நேரலை வணிக நிலை:**\n` +
            `• **வாடிக்கையாளர்கள்:** மொத்தம் **${clients.length} கணக்குகள்** (${activeClients.length} செயலில்)\n` +
            `• **பெறப்பட்ட மொத்த வருவாய்:** **₹${realizedRev.toLocaleString("en-IN", { minimumFractionDigits: 2 })}**\n` +
            `• **செயலில் உள்ள திட்டப்பணிகள்:** **${activeProjs.length} திட்டங்கள்** இலக்கு தேதியை நோக்கி நகர்கின்றன\n` +
            `• **நிலுவை மேற்கோள்கள்:** **${pendingQuotes.length} மேற்கோள்கள்**\n` +
            `• **நிலுவை இன்வாய்ஸ்கள்:** **${overdueInvoices.length} இன்வாய்ஸ்கள்** (₹${totalOverdue.toLocaleString("en-IN", { minimumFractionDigits: 2 })})\n` +
            `• **ஒப்பந்தங்கள்:** **${contracts.length} ஒப்பந்தங்கள்**, **${openTickets.length} ஆதரவு டிக்கெட்டுகள்**`;
        } else if (lang === "hi") {
          answer = `### अमीरू टेक सॉल्यूशंस (Amiro Tech Solutions) — कंपनी परिचय एवं बिज़नेस सारांश\n\n` +
            `**अमीरू टेक सॉल्यूशंस** एक प्रमुख एंटरप्राइज टेक्नोलॉजी सॉल्यूशंस एवं बिज़नेस ऑपरेशन्स प्रदाता है। हम आधुनिक डिजिटल इन्फ्रास्ट्रक्चर, कस्टम सॉफ्टवेयर और क्लाउड समाधान प्रदान करते हैं।\n\n` +
            `**लाइव ऑपरेशन्स स्थिति:**\n` +
            `• **क्लाइंट पोर्टफोलियो:** कुल **${clients.length} क्लाइंट खाते** (${activeClients.length} सक्रिय खाते)\n` +
            `• **प्राप्त कुल राजस्व:** **₹${realizedRev.toLocaleString("en-IN", { minimumFractionDigits: 2 })}** प्राप्त भुगतान\n` +
            `• **सक्रिय डिलीवरी:** **${activeProjs.length} चालू प्रोजेक्ट्स**\n` +
            `• **पाइपलाइन कोटेशन:** **${pendingQuotes.length} कोटेशन** समीक्षा और अनुमोदन में\n` +
            `• **बकाया इनवॉइस:** **${overdueInvoices.length} ओवरड्यू इनवॉइस** (कुल बकाया ₹${totalOverdue.toLocaleString("en-IN", { minimumFractionDigits: 2 })})\n` +
            `• **सपोर्ट व अनुबंध:** **${contracts.length} सेवा अनुबंध** और **${openTickets.length}** खुले सपोर्ट टिकट`;
        } else if (lang === "te") {
          answer = `### అమీరో టెక్ సొల్యూషన్స్ (Amiro Tech Solutions) — కంపెనీ వివరాలు\n\n` +
            `**అమీరో టెక్ సొల్యూషన్స్** అత్యాధునిక ఎంటర్‌ప్రైజ్ సాఫ్ట్‌వేర్ మరియు వ్యాపార నిర్వహణ పరిష్కారాలను అందించే ప్రముఖ సంస్థ.\n\n` +
            `**ప్రస్తుత వ్యాపార స్థితి:**\n` +
            `• **మొత్తం క్లయింట్లు:** **${clients.length} క్లయింట్ ఖాతాలు** (${activeClients.length} యాక్టివ్)\n` +
            `• **వచ్చిన రాబడి:** **₹${realizedRev.toLocaleString("en-IN", { minimumFractionDigits: 2 })}**\n` +
            `• **ప్రస్తుత ప్రాజెక్టులు:** **${activeProjs.length} ప్రాజెక్ట్‌లు** నిర్మాణంలో ఉన్నాయి\n` +
            `• **కొటేషన్లు:** **${pendingQuotes.length} కొటేషన్లు** పెండింగ్‌లో ఉన్నాయి\n` +
            `• **బకాయిలు:** **${overdueInvoices.length} బకాయి బిల్లులు** (మొత్తం ₹${totalOverdue.toLocaleString("en-IN", { minimumFractionDigits: 2 })})`;
        } else if (lang === "kn") {
          answer = `### ಅಮಿರೋ ಟೆಕ್ ಸೊಲ್ಯೂಷನ್ಸ್ (Amiro Tech Solutions) — ಕಂಪನಿ ಸಾರಾಂಶ\n\n` +
            `• **ಗ್ರಾಹಕರ ಪೋರ್ಟ್‌ಫೋಲಿಯೊ:** ಒಟ್ಟು **${clients.length} ಖಾತೆಗಳು** (${activeClients.length} ಸಕ್ರಿಯ)\n` +
            `• **ಗಳಿಸಿದ ಒಟ್ಟು ಆದಾಯ:** **₹${realizedRev.toLocaleString("en-IN", { minimumFractionDigits: 2 })}**\n` +
            `• **ಸಕ್ರಿಯ ಪ್ರಾಜೆಕ್ಟ್‌ಗಳು:** **${activeProjs.length} ಪ್ರಾಜೆಕ್ಟ್‌ಗಳು** ಚಾಲ್ತಿಯಲ್ಲಿವೆ\n` +
            `• **ಬಾಕಿ ಉಳಿದ ಇನ್‌ವಾಯ್ಸ್‌ಗಳು:** **${overdueInvoices.length}** (₹${totalOverdue.toLocaleString("en-IN", { minimumFractionDigits: 2 })})`;
        } else {
          answer = `### Amiro Tech Solutions — Enterprise Operations Briefing\n\n` +
            `**Amiro Tech Solutions** is a premier technology services and enterprise business operations firm specializing in mission-critical business platforms, digital operations management, and secure cloud integrations.\n\n` +
            `**Live Operational Footprint:**\n` +
            `• **Client Portfolio:** **${clients.length} registered accounts** (${activeClients.length} actively engaged)\n` +
            `• **Realized Gross Revenue:** **₹${realizedRev.toLocaleString("en-IN", { minimumFractionDigits: 2 })}** in verified collections\n` +
            `• **Delivery Pipeline:** **${activeProjs.length} active delivery projects** tracking milestones on schedule\n` +
            `• **Commercial Pipeline:** **${pendingQuotes.length} quotations** currently awaiting conversion\n` +
            `• **Credit Standing:** **${overdueInvoices.length} overdue invoices** (₹${totalOverdue.toLocaleString("en-IN", { minimumFractionDigits: 2 })} balance due)\n` +
            `• **SLA Commitments:** **${contracts.length} active maintenance contracts** with **${openTickets.length} open tickets**`;
        }
        break;
      }

      case "assistant_status": {
        if (lang === "ml") {
          answer = "അമിറോ ടെക് സൊല്യൂഷൻസ് പ്രവർത്തനങ്ങളിൽ നിങ്ങളെ സഹായിക്കാൻ ഞാൻ സദാ സന്നദ്ധനാണ്. ക്ലയന്റുകൾ, ഇൻവോയ്സുകൾ, പ്രോജക്റ്റുകൾ അല്ലെങ്കിൽ ഫോം ഓട്ടോ-ഫിൽ എന്നിവയെക്കുറിച്ചുള്ള വിവരങ്ങൾ ചോദിക്കൂ!";
        } else if (lang === "ta") {
          answer = "அமிரோ டெக் சொல்யூஷன்ஸ் செயல்பாடுகளில் உங்களுக்கு உதவ நான் தயாராக உள்ளேன். வாடிக்கையாளர்கள், இன்வாய்ஸ்கள், திட்டப்பணிகள் அல்லது படிவ ஆட்டோ-ஃபில் பற்றி எப்போது வேண்டுமானாலும் கேளுங்கள்!";
        } else if (lang === "hi") {
          answer = "मैं आपकी सहायता के लिए तैयार हूँ। जब भी आप हमारे क्लाइंट्स, इनवॉइस, प्रोजेक्ट्स, कोटेशन या फॉर्म ऑटो-फिल से संबंधित कोई डेटा देखना चाहें, बस मुझे बताएं!";
        } else if (lang === "te") {
          answer = "నేను మీకు సహాయం చేయడానికి సిద్ధంగా ఉన్నాను. మన క్లయింట్లు, ఇన్వాయిస్‌లు, ప్రాజెక్ట్‌లు, కొటేషన్లు లేదా ఫారం ఆటో-ఫిల్ వివరాలు కావాలంటే నన్ను అడగండి!";
        } else if (lang === "kn") {
          answer = "ಅಮಿರೋ ಟೆಕ್ ಸೊಲ್ಯೂಷನ್ಸ್ ಕಾರ್ಯಾಚರಣೆಗಳಲ್ಲಿ ನಿಮಗೆ ಸಹಾಯ ಮಾಡಲು ನಾನು ಸದಾ ಸಿದ್ಧನಾಗಿದ್ದೇನೆ. ಗ್ರಾಹಕರು, ಇನ್‌ವಾಯ್ಸ್‌ಗಳು, ಪ್ರಾಜೆಕ್ಟ್‌ಗಳು ಅಥವಾ ಫಾರ್ಮ್ ಆಟೋ-ಫಿಲ್ ಬಗ್ಗೆ ಕೇಳಿ!";
        } else {
          answer = "I am ready and standing by to assist you. Whenever you would like to inspect our clients, invoices, active projects, quotations, or auto-fill forms, just ask!";
        }
        break;
      }

      case "clients_overview": {
        const activeCount = clients.filter((c) => c.status === "active").length;
        if (clients.length === 0) {
          answer = lang === "ml"
            ? "സിസ്റ്റത്തിൽ നിലവിൽ ക്ലയന്റുകൾ ആരും രജിസ്റ്റർ ചെയ്തിട്ടില്ല."
            : (lang === "ta"
              ? "கணினியில் தற்போது வாடிக்கையாளர்கள் யாரும் பதிவு செய்யப்படவில்லை."
              : (lang === "te"
                ? "ప్రస్తుతం సిస్టమ్‌లో క్లయింట్లు ఎవరూ నమోదు కాలేదు."
                : (lang === "hi"
                  ? "सिस्टम में वर्तमान में कोई ग्राहक पंजीकृत नहीं है।"
                  : (lang === "kn"
                    ? "ವ್ಯವಸ್ಥೆಯಲ್ಲಿ ಪ್ರಸ್ತುತ ಯಾವುದೇ ಗ್ರಾಹಕರು ನೋಂದಾಯಿಸಲ್ಪಟ್ಟಿಲ್ಲ."
                    : "There are currently no clients registered in the system."))));
        } else {
          if (lang === "ml") {
            answer = `സിസ്റ്റത്തിൽ ആകെ **${clients.length} ക്ലയന്റ് അക്കൗണ്ടുകൾ** രജിസ്റ്റർ ചെയ്തിട്ടുണ്ട് (**${activeCount} സജീവം**):\n\n` +
              clients.map((c) => `• **${c.company_name}** (${c.industry || "General"}): സ്റ്റാറ്റസ് ${c.status}`).join("\n");
          } else if (lang === "ta") {
            answer = `கணினியில் மொத்தம் **${clients.length} வாடிக்கையாளர் கணக்குகள்** உள்ளன (**${activeCount} செயலில்**):\n\n` +
              clients.map((c) => `• **${c.company_name}** (${c.industry || "General"}): நிலை ${c.status}`).join("\n");
          } else if (lang === "te") {
            answer = `సిస్టమ్‌లో మొత్తం **${clients.length} క్లయింట్లు** ఉన్నారు (**${activeCount} యాక్టివ్**):\n\n` +
              clients.map((c) => `• **${c.company_name}** (${c.industry || "General"}): స్థితి ${c.status}`).join("\n");
          } else if (lang === "hi") {
            answer = `सिस्टम में कुल **${clients.length} क्लाइंट्स** दर्ज हैं (**${activeCount} सक्रिय**):\n\n` +
              clients.map((c) => `• **${c.company_name}** (${c.industry || "General"}): स्थिति ${c.status.toUpperCase()}`).join("\n");
          } else if (lang === "kn") {
            answer = `ವ್ಯವಸ್ಥೆಯಲ್ಲಿ ಒಟ್ಟು **${clients.length} ಗ್ರಾಹಕರ ಖಾತೆಗಳು** ಇವೆ (**${activeCount} ಸಕ್ರಿಯ**):\n\n` +
              clients.map((c) => `• **${c.company_name}** (${c.industry || "General"}): ಸ್ಥಿತಿ ${c.status}`).join("\n");
          } else if (lang === "mr") {
            answer = `सिस्टममध्ये एकूण **${clients.length} क्लायंट खाती** आहेत (**${activeCount} सक्रिय**):\n\n` +
              clients.map((c) => `• **${c.company_name}** (${c.industry || "General"}): स्थिती ${c.status}`).join("\n");
          } else if (lang === "bn") {
            answer = `সিস্টেমে মোট **${clients.length} টি ক্লায়েন্ট অ্যাকাউন্ট** আছে (**${activeCount} সক্রিয়**):\n\n` +
              clients.map((c) => `• **${c.company_name}** (${c.industry || "General"}): স্থিতি ${c.status}`).join("\n");
          } else if (lang === "gu") {
            answer = `સિસ્ટમમાં કુલ **${clients.length} ક્લાયન્ટ એકાઉન્ટ્સ** છે (**${activeCount} સક્રિય**):\n\n` +
              clients.map((c) => `• **${c.company_name}** (${c.industry || "General"}): સ્થિતિ ${c.status}`).join("\n");
          } else if (lang === "ar") {
            answer = `يوجد إجمالي **${clients.length} حساب عميل** مسجل في النظام (**${activeCount} نشط**):\n\n` +
              clients.map((c) => `• **${c.company_name}** (${c.industry || "General"}): الحالة ${c.status}`).join("\n");
          } else {
            answer = `There are **${clients.length} client account(s)** registered in the platform (**${activeCount} active**):\n\n` +
              clients.map((c) => `• **${c.company_name}** [${c.industry || "Enterprise"} · Status: ${c.status.toUpperCase()}]`).join("\n");
          }
        }
        break;
      }

      case "active_projects": {
        if (projects.length === 0) {
          answer = lang === "ml"
            ? "സിസ്റ്റത്തിൽ നിലവിൽ പ്രോജക്റ്റുകൾ ഒന്നും രേഖപ്പെടുത്തിയിട്ടില്ല."
            : (lang === "ta"
              ? "கணினியில் செயலில் உள்ள திட்டப்பணிகள் எதுவும் பதிவு செய்யப்படவில்லை."
              : (lang === "te"
                ? "ప్రస్తుతం సిస్టమ్‌లో యాక్టివ్ ప్రాజెక్ట్‌లు ఏవీ లేవు."
                : (lang === "hi"
                  ? "वर्तमान में कोई सक्रिय प्रोजेक्ट दर्ज नहीं है।"
                  : (lang === "kn"
                    ? "ವ್ಯವಸ್ಥೆಯಲ್ಲಿ ಪ್ರಸ್ತುತ ಯಾವುದೇ ಸಕ್ರಿಯ ಪ್ರಾಜೆಕ್ಟ್‌ಗಳಿಲ್ಲ."
                    : "There are currently no active projects recorded."))));
        } else {
          const inFlight = projects.filter((p) => p.status === "active" || p.status === "planned");
          if (lang === "ml") {
            answer = `സിസ്റ്റത്തിൽ ആകെ **${projects.length} പ്രോജക്റ്റുകൾ** ഉണ്ട് (${inFlight.length} സജീവം/നടപ്പിലാക്കുന്നത്):\n\n` +
              projects.map((p) => `• **${p.project_name}** (${p.project_code}): സ്റ്റാറ്റസ് ${p.status} · ലക്ഷ്യ തീയതി: ${p.target_end_date || "N/A"}`).join("\n");
          } else if (lang === "ta") {
            answer = `கணினியில் மொத்தம் **${projects.length} திட்டப்பணிகள்** உள்ளன (${inFlight.length} செயலில்/திட்டமிடப்பட்டவை):\n\n` +
              projects.map((p) => `• **${p.project_name}** (${p.project_code}): நிலை ${p.status.toUpperCase()} · இலக்கு தேதி: ${p.target_end_date || "N/A"}`).join("\n");
          } else if (lang === "te") {
            answer = `సిస్టమ్‌లో మొత్తం **${projects.length} ప్రాజెక్ట్‌లు** ఉన్నాయి (${inFlight.length} యాక్టివ్/ప్లాన్ చేసినవి):\n\n` +
              projects.map((p) => `• **${p.project_name}** (${p.project_code}): స్థితి ${p.status.toUpperCase()} · ముగింపు తేదీ: ${p.target_end_date || "N/A"}`).join("\n");
          } else if (lang === "hi") {
            answer = `कुल **${projects.length} प्रोजेक्ट्स** हैं (${inFlight.length} सक्रिय/नियोजित):\n\n` +
              projects.map((p) => `• **${p.project_name}** (${p.project_code}): स्थिति ${p.status.toUpperCase()} · लक्ष्य तिथि: ${p.target_end_date || "N/A"}`).join("\n");
          } else if (lang === "kn") {
            answer = `ವ್ಯವಸ್ಥೆಯಲ್ಲಿ ಒಟ್ಟು **${projects.length} ಪ್ರಾಜೆಕ್ಟ್‌ಗಳು** ಇವೆ (${inFlight.length} ಸಕ್ರಿಯ/ಯೋಜಿತ):\n\n` +
              projects.map((p) => `• **${p.project_name}** (${p.project_code}): ಸ್ಥಿತಿ ${p.status} · ಅಂತಿಮ ದಿನಾಂಕ: ${p.target_end_date || "N/A"}`).join("\n");
          } else if (lang === "mr") {
            answer = `सिस्टममध्ये एकूण **${projects.length} प्रोजेक्ट्स** आहेत (${inFlight.length} सक्रिय/नियोजित):\n\n` +
              projects.map((p) => `• **${p.project_name}** (${p.project_code}): स्थिती ${p.status} · अंतिम तारीख: ${p.target_end_date || "N/A"}`).join("\n");
          } else if (lang === "bn") {
            answer = `সিস্টেমে মোট **${projects.length} টি প্রকল্প** রয়েছে (${inFlight.length} সক্রিয়/পরিকল্পিত):\n\n` +
              projects.map((p) => `• **${p.project_name}** (${p.project_code}): স্থিতি ${p.status} · সমাপ্তির তারিখ: ${p.target_end_date || "N/A"}`).join("\n");
          } else if (lang === "gu") {
            answer = `સિસ્ટમમાં કુલ **${projects.length} પ્રોજેક્ટ્સ** છે (${inFlight.length} સક્રિય/આયોજિત):\n\n` +
              projects.map((p) => `• **${p.project_name}** (${p.project_code}): સ્થિતિ ${p.status} · લક્ષ્ય તારીખ: ${p.target_end_date || "N/A"}`).join("\n");
          } else if (lang === "ar") {
            answer = `يوجد في النظام **${projects.length} مشروع** (${inFlight.length} نشط/مخطط له):\n\n` +
              projects.map((p) => `• **${p.project_name}** (${p.project_code}): الحالة ${p.status} · الموعد النهائي: ${p.target_end_date || "N/A"}`).join("\n");
          } else {
            answer = `There are **${projects.length} project engagement(s)** in the system (${inFlight.length} active/planned):\n\n` +
              projects.map((p) => `• **${p.project_name}** (${p.project_code}): Status [${p.status.toUpperCase()}] · Target End: ${p.target_end_date || "N/A"}`).join("\n");
          }
        }
        break;
      }

      case "invoices_overview": {
        const totalBilled = invoices.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);
        const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
        if (lang === "ml") {
          answer = `### ഇൻവോയ്സുകളും ബില്ലിംഗും\n\n` +
            `• **ആകെ നൽകിയ ഇൻവോയ്സുകൾ:** ${invoices.length} (ആകെ തുക: ₹${totalBilled.toLocaleString("en-IN", { minimumFractionDigits: 2 })})\n` +
            `• **ലഭിച്ച പണം:** ₹${totalPaid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}\n` +
            `• **കുടിശ്ശികയുള്ള ഇൻവോയ്സുകൾ:** ${overdueInvoices.length} (₹${totalOverdue.toLocaleString("en-IN", { minimumFractionDigits: 2 })})\n\n` +
            invoices.map((inv) => `• **${inv.invoice_number}** (${clientMap.get(inv.client_id) || "ക്ലയന്റ്"}): ₹${Number(inv.total_amount).toLocaleString("en-IN")} [${inv.status}]`).join("\n");
        } else if (lang === "ta") {
          answer = `### இன்வாய்ஸ்கள் & பில்லிங் கண்ணோட்டம்\n\n` +
            `• **மொத்தம் வழங்கப்பட்ட இன்வாய்ஸ்கள்:** ${invoices.length} (மொத்த மதிப்பு: ₹${totalBilled.toLocaleString("en-IN", { minimumFractionDigits: 2 })})\n` +
            `• **பெறப்பட்ட வசூல்:** ₹${totalPaid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}\n` +
            `• **நிலுவையில் உள்ள இன்வாய்ஸ்கள்:** ${overdueInvoices.length} (₹${totalOverdue.toLocaleString("en-IN", { minimumFractionDigits: 2 })})\n\n` +
            invoices.map((inv) => `• **${inv.invoice_number}** (${clientMap.get(inv.client_id) || "வாடிக்கையாளர்"}): ₹${Number(inv.total_amount).toLocaleString("en-IN")} [${inv.status.toUpperCase()}]`).join("\n");
        } else if (lang === "te") {
          answer = `### ఇన్వాయిస్‌లు & బిల్లింగ్ సమాచారం\n\n` +
            `• **మొత్తం జారీ చేసిన ఇన్వాయిస్‌లు:** ${invoices.length} (మొత్తం విలువ: ₹${totalBilled.toLocaleString("en-IN", { minimumFractionDigits: 2 })})\n` +
            `• **వచ్చిన వసూళ్లు:** ₹${totalPaid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}\n` +
            `• **బకాయి ఉన్న ఇన్వాయిస్‌లు:** ${overdueInvoices.length} (₹${totalOverdue.toLocaleString("en-IN", { minimumFractionDigits: 2 })})\n\n` +
            invoices.map((inv) => `• **${inv.invoice_number}** (${clientMap.get(inv.client_id) || "క్లయింట్"}): ₹${Number(inv.total_amount).toLocaleString("en-IN")} [${inv.status.toUpperCase()}]`).join("\n");
        } else if (lang === "hi") {
          answer = `### इनवॉइस एवं बिलिंग अवलोकन\n\n` +
            `• **कुल जारी इनवॉइस:** ${invoices.length} (कुल मूल्य: ₹${totalBilled.toLocaleString("en-IN", { minimumFractionDigits: 2 })})\n` +
            `• **प्राप्त कुल भुगतान:** ₹${totalPaid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}\n` +
            `• **बकाया इनवॉइस:** ${overdueInvoices.length} (₹${totalOverdue.toLocaleString("en-IN", { minimumFractionDigits: 2 })})\n\n` +
            invoices.map((inv) => `• **${inv.invoice_number}** (${clientMap.get(inv.client_id) || "क्लाइंट"}): ₹${Number(inv.total_amount).toLocaleString("en-IN")} [${inv.status.toUpperCase()}]`).join("\n");
        } else if (lang === "kn") {
          answer = `### ಇನ್‌ವಾಯ್ಸ್‌ಗಳು ಮತ್ತು ಬಿಲ್ಲಿಂಗ್ ಅವಲೋಕನ\n\n` +
            `• **ಒಟ್ಟು ನೀಡಲಾದ ಇನ್‌ವಾಯ್ಸ್‌ಗಳು:** ${invoices.length} (ಒಟ್ಟು ಮೌಲ್ಯ: ₹${totalBilled.toLocaleString("en-IN", { minimumFractionDigits: 2 })})\n` +
            `• **ಸ್ವೀಕರಿಸಿದ ಪಾವತಿಗಳು:** ₹${totalPaid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}\n` +
            `• **ಬಾಕಿ ಇರುವ ಇನ್‌ವಾಯ್ಸ್‌ಗಳು:** ${overdueInvoices.length} (₹${totalOverdue.toLocaleString("en-IN", { minimumFractionDigits: 2 })})\n\n` +
            invoices.map((inv) => `• **${inv.invoice_number}** (${clientMap.get(inv.client_id) || "ಗ್ರಾಹಕ"}): ₹${Number(inv.total_amount).toLocaleString("en-IN")} [${inv.status}]`).join("\n");
        } else {
          answer = `### Invoices & Billing Overview\n\n` +
            `• **Total Invoices Issued:** ${invoices.length} (Total Value: ₹${totalBilled.toLocaleString("en-IN", { minimumFractionDigits: 2 })})\n` +
            `• **Total Realized Collections:** ₹${totalPaid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}\n` +
            `• **Overdue Invoices:** ${overdueInvoices.length} (₹${totalOverdue.toLocaleString("en-IN", { minimumFractionDigits: 2 })})\n\n` +
            invoices.map((inv) => `• **${inv.invoice_number}** (${clientMap.get(inv.client_id) || "Client"}): ₹${Number(inv.total_amount).toLocaleString("en-IN")} [${inv.status.toUpperCase()}]`).join("\n");
        }
        break;
      }

      case "quotations_overview": {
        const totalVal = quotations.reduce((s, q) => s + Number(q.total_amount || 0), 0);
        if (lang === "ml") {
          answer = `### കൊട്ടേഷനുകൾ & പ്രൊപ്പോസലുകൾ\n\n` +
            `• **ആകെ കൊട്ടേഷനുകൾ:** ${quotations.length} (ആകെ മൂല്യം: ₹${totalVal.toLocaleString("en-IN", { minimumFractionDigits: 2 })})\n` +
            `• **അംഗീകാരത്തിനായി കാത്തിരിക്കുന്നത്:** ${pendingQuotes.length}\n\n` +
            quotations.map((q) => `• **${q.quotation_number}** (${clientMap.get(q.client_id) || "ക്ലയന്റ്"}): ₹${Number(q.total_amount).toLocaleString("en-IN")} [${q.status}]`).join("\n");
        } else if (lang === "ta") {
          answer = `### விலை மேற்கோள்கள் கண்ணோட்டம்\n\n` +
            `• **மொத்த மேற்கோள்கள்:** ${quotations.length} (மதிப்பு: ₹${totalVal.toLocaleString("en-IN", { minimumFractionDigits: 2 })})\n` +
            `• **நிலுவையில் உள்ளவை:** ${pendingQuotes.length}\n\n` +
            quotations.map((q) => `• **${q.quotation_number}** (${clientMap.get(q.client_id) || "வாடிக்கையாளர்"}): ₹${Number(q.total_amount).toLocaleString("en-IN")} [${q.status}]`).join("\n");
        } else if (lang === "te") {
          answer = `### కొటేషన్ల పైప్‌లైన్ సమాచారం\n\n` +
            `• **మొత్తం కొటేషన్లు:** ${quotations.length} (మొత్తం విలువ: ₹${totalVal.toLocaleString("en-IN", { minimumFractionDigits: 2 })})\n` +
            `• **ఆమోదం కోసం పెండింగ్‌లో ఉన్నవి:** ${pendingQuotes.length}\n\n` +
            quotations.map((q) => `• **${q.quotation_number}** (${clientMap.get(q.client_id) || "క్లయింట్"}): ₹${Number(q.total_amount).toLocaleString("en-IN")} [${q.status.toUpperCase()}]`).join("\n");
        } else if (lang === "hi") {
          answer = `### कोटेशन पाइपलाइन अवलोकन\n\n` +
            `• **कुल कोटेशन:** ${quotations.length} (कुल मूल्य: ₹${totalVal.toLocaleString("en-IN", { minimumFractionDigits: 2 })})\n` +
            `• **लंबित कोटेशन:** ${pendingQuotes.length}\n\n` +
            quotations.map((q) => `• **${q.quotation_number}** (${clientMap.get(q.client_id) || "क्लाइंट"}): ₹${Number(q.total_amount).toLocaleString("en-IN")} [${q.status.toUpperCase()}]`).join("\n");
        } else if (lang === "kn") {
          answer = `### ಕೊಟೇಶನ್ ಪೈಪ್‌ಲೈನ್ ಅವಲೋಕನ\n\n` +
            `• **ಒಟ್ಟು ಕೊಟೇಶನ್‌ಗಳು:** ${quotations.length} (ಒಟ್ಟು ಮೌಲ್ಯ: ₹${totalVal.toLocaleString("en-IN", { minimumFractionDigits: 2 })})\n` +
            `• **ಬಾಕಿ ಉಳಿದಿರುವ ಅನುಮೋದನೆಗಳು:** ${pendingQuotes.length}\n\n` +
            quotations.map((q) => `• **${q.quotation_number}** (${clientMap.get(q.client_id) || "ಗ್ರಾಹಕ"}): ₹${Number(q.total_amount).toLocaleString("en-IN")} [${q.status}]`).join("\n");
        } else {
          answer = `### Quotations Pipeline Overview\n\n` +
            `• **Total Quotations:** ${quotations.length} (Total Value: ₹${totalVal.toLocaleString("en-IN", { minimumFractionDigits: 2 })})\n` +
            `• **Pending Approvals:** ${pendingQuotes.length}\n\n` +
            quotations.map((q) => `• **${q.quotation_number}** for ${clientMap.get(q.client_id) || "Client"}: ₹${Number(q.total_amount).toLocaleString("en-IN")} [${q.status.toUpperCase()}]`).join("\n");
        }
        break;
      }

      case "contracts_overview": {
        if (contracts.length === 0) {
          answer = lang === "ml"
            ? "സിസ്റ്റത്തിൽ നിലവിൽ സജീവ കരാറുകൾ ഒന്നും രേഖപ്പെടുത്തിയിട്ടില്ല."
            : (lang === "ta"
              ? "கணினியில் தற்போது செயலில் உள்ள ஒப்பந்தங்கள் எதுவும் பதிவு செய்யப்படவில்லை."
              : (lang === "te"
                ? "ప్రస్తుతం సిస్టమ్‌లో క్రియాశీల ఒప్పందాలు ఏవీ లేవు."
                : (lang === "hi"
                  ? "वर्तमान में कोई सक्रिय अनुबंध दर्ज नहीं है।"
                  : (lang === "kn"
                    ? "ವ್ಯವಸ್ಥೆಯಲ್ಲಿ ಪ್ರಸ್ತುತ ಯಾವುದೇ ಸಕ್ರಿಯ ಒಪ್ಪಂದಗಳಿಲ್ಲ."
                    : "There are currently no active contracts recorded."))));
        } else {
          if (lang === "ml") {
            answer = `### സർവീസ് കരാറുകൾ (Contracts & SLAs)\n\n` +
              `• **ആകെ കരാറുകൾ:** ${contracts.length} സജീവം\n` +
              `• **കാലഹരണപ്പെടുന്ന കരാറുകൾ:** ${expiringContracts.length}\n\n` +
              contracts.map((c) => `• കരാർ **${c.contract_number}** (${clientMap.get(c.client_id) || "ക്ലയന്റ്"}): അവസാന തീയതി ${c.end_date || "N/A"}`).join("\n");
          } else if (lang === "ta") {
            answer = `### சேவை ஒப்பந்தங்கள் (Contracts & SLAs)\n\n` +
              `• **மொத்த ஒப்பந்தங்கள்:** ${contracts.length} செயலில்\n` +
              `• **காலாவதியாகும் ஒப்பந்தங்கள்:** ${expiringContracts.length}\n\n` +
              contracts.map((c) => `• ஒப்பந்தம் **${c.contract_number}** (${clientMap.get(c.client_id) || "வாடிக்கையாளர்"}): செல்லுபடியாகும் தேதி ${c.end_date || "N/A"}`).join("\n");
          } else if (lang === "te") {
            answer = `### సేవా ఒప్పందాలు (Contracts & SLAs)\n\n` +
              `• **మొత్తం ఒప్పందాలు:** ${contracts.length} యాక్టివ్\n` +
              `• **ముగియనున్న ఒప్పందాలు:** ${expiringContracts.length}\n\n` +
              contracts.map((c) => `• ఒప్పందం **${c.contract_number}** (${clientMap.get(c.client_id) || "క్లయింట్"}): గడువు ${c.end_date || "N/A"}`).join("\n");
          } else if (lang === "hi") {
            answer = `### सेवा अनुबंध (Contracts & SLAs)\n\n` +
              `• **कुल अनुबंध:** ${contracts.length} सक्रिय\n` +
              `• **समाप्त होने वाले अनुबंध:** ${expiringContracts.length}\n\n` +
              contracts.map((c) => `• अनुबंध **${c.contract_number}** (${clientMap.get(c.client_id) || "क्लाइंट"}): वैधता ${c.end_date || "N/A"}`).join("\n");
          } else if (lang === "kn") {
            answer = `### ಸೇವಾ ಒಪ್ಪಂದಗಳು (Contracts & SLAs)\n\n` +
              `• **ಒಟ್ಟು ಒಪ್ಪಂದಗಳು:** ${contracts.length} ಸಕ್ರಿಯ\n` +
              `• **ಅಂತ್ಯಗೊಳ್ಳಲಿರುವ ಒಪ್ಪಂದಗಳು:** ${expiringContracts.length}\n\n` +
              contracts.map((c) => `• ಒಪ್ಪಂದ **${c.contract_number}** (${clientMap.get(c.client_id) || "ಗ್ರಾಹಕ"}): ಅಂತಿಮ ದಿನಾಂಕ ${c.end_date || "N/A"}`).join("\n");
          } else {
            answer = `### Service Contracts & Agreements\n\n` +
              `• **Total Contracts:** ${contracts.length} active\n` +
              `• **Expiring Contracts:** ${expiringContracts.length}\n\n` +
              contracts.map((c) => `• Contract **${c.contract_number}** (${clientMap.get(c.client_id) || "Client"}): Valid until ${c.end_date || "N/A"}`).join("\n");
          }
        }
        break;
      }

      case "today_activities": {
        if (activities.length === 0) {
          answer = lang === "ml"
            ? "ഇന്നത്തേക്ക് ഷെഡ്യൂൾ ചെയ്ത പുതിയ പ്രവർത്തനങ്ങൾ ഒന്നും രേഖപ്പെടുത്തിയിട്ടില്ല."
            : (lang === "ta"
              ? "இன்றைக்கு திட்டமிடப்பட்ட செயல்பாடுகள் அல்லது அழைப்புகள் எதுவும் இல்லை."
              : (lang === "te"
                ? "ఈరోజు ఎలాంటి షెడ్యూల్ చేసిన సమావేశాలు లేదా కాల్స్ లేవు."
                : (lang === "hi"
                  ? "आज के लिए कोई गतिविधि या मीटिंग निर्धारित नहीं है।"
                  : (lang === "kn"
                    ? "ಇಂದಿಗೆ ಯಾವುದೇ ನಿಗದಿತ ಚಟುವಟಿಕೆಗಳು ಅಥವಾ ಕರೆಗಳಿಲ್ಲ."
                    : "No activities or calls scheduled for today."))));
        } else {
          if (lang === "ml") {
            answer = `### ഇന്നത്തെ പ്രവർത്തനങ്ങൾ\n\n• **ആകെ രേഖകൾ:** ${activities.length}\n\n` +
              activities.slice(0, 5).map((a) => `• [${a.activity_type.toUpperCase()}] ${a.subject || "പ്രവർത്തനം"} (${a.activity_date || "ഇന്ന്"})`).join("\n");
          } else if (lang === "ta") {
            answer = `### இன்றைய செயல்பாடுகள் பதிவு\n\n• **மொத்த பதிவுகள்:** ${activities.length}\n\n` +
              activities.slice(0, 5).map((a) => `• [${a.activity_type.toUpperCase()}] ${a.subject || "செயல்பாடு"} (${a.activity_date || "இன்று"})`).join("\n");
          } else if (lang === "te") {
            answer = `### ఈరోజు కార్యకలాపాల లాగ్\n\n• **మొత్తం రికార్డులు:** ${activities.length}\n\n` +
              activities.slice(0, 5).map((a) => `• [${a.activity_type.toUpperCase()}] ${a.subject || "కార్యకలాపం"} (${a.activity_date || "ఈరోజు"})`).join("\n");
          } else if (lang === "hi") {
            answer = `### आज की गतिविधियां एवं संचार लॉग\n\n• **कुल रिकॉर्ड्स:** ${activities.length}\n\n` +
              activities.slice(0, 5).map((a) => `• [${a.activity_type.toUpperCase()}] ${a.subject || "गतिविधि"} (${a.activity_date || "आज"})`).join("\n");
          } else if (lang === "kn") {
            answer = `### ಇಂದಿನ ಚಟುವಟಿಕೆಗಳು\n\n• **ಒಟ್ಟು ದಾಖಲೆಗಳು:** ${activities.length}\n\n` +
              activities.slice(0, 5).map((a) => `• [${a.activity_type.toUpperCase()}] ${a.subject || "ಚಟುವಟಿಕೆ"} (${a.activity_date || "ಇಂದು"})`).join("\n");
          } else {
            answer = `### Today's Activities & Communication Log\n\n` +
              `• **Total Scheduled/Logged:** ${activities.length} activity record(s)\n\n` +
              activities.slice(0, 5).map((a) => `• [${a.activity_type.toUpperCase()}] ${a.subject || "Activity"} (${a.activity_date || "Today"})`).join("\n");
          }
        }
        break;
      }

      case "client_followups": {
        const followups = clients.filter((c) => c.status === "lead" || c.status === "proposal_sent");
        if (followups.length === 0) {
          answer = lang === "ml"
            ? "എല്ലാ ക്ലയന്റ് അക്കൗണ്ടുകളും സജീവമാണ്. അടിയന്തര ഫോളോ-അപ്പുകൾ ആവശ്യമില്ല."
            : (lang === "ta"
              ? "அனைத்து வாடிக்கையாளர் கணக்குகளும் செயலில் உள்ளன. உடனடி பின்தொடர்தல் எதுவும் தேவையில்லை."
              : (lang === "te"
                ? "అన్ని క్లయింట్ ఖాతాల సంబంధాలు క్రియాశీలంగా ఉన్నాయి. ఎలాంటి అత్యవసర ఫాలోఅప్‌లు లేవు."
                : (lang === "hi"
                  ? "सभी ग्राहक खाते सक्रिय हैं। कोई तत्काल फॉलो-अप आवश्यक नहीं है।"
                  : "All client relationships are active and healthy. No urgent follow-up flags recorded.")));
        } else {
          if (lang === "ml") {
            answer = `ഫോളോ-അപ്പ് ആവശ്യമുള്ള **${followups.length} ക്ലയന്റ് അക്കൗണ്ടുകൾ** കണ്ടെത്തി:\n\n` +
              followups.map((c) => `• **${c.company_name}** (${c.status.toUpperCase()})`).join("\n");
          } else if (lang === "ta") {
            answer = `பின்தொடர்தல் தேவைப்படும் **${followups.length} வாடிக்கையாளர் கணக்குகள்** கண்டறியப்பட்டன:\n\n` +
              followups.map((c) => `• **${c.company_name}** (${c.status.toUpperCase()})`).join("\n");
          } else if (lang === "te") {
            answer = `ఫాలోఅప్ అవసరమైన **${followups.length} క్లయింట్ ఖాతాలు** గుర్తించబడ్డాయి:\n\n` +
              followups.map((c) => `• **${c.company_name}** (${c.status.toUpperCase()})`).join("\n");
          } else if (lang === "hi") {
            answer = `फॉलो-अप आवश्यक **${followups.length} क्लाइंट खाते** पाए गए:\n\n` +
              followups.map((c) => `• **${c.company_name}** (${c.status.toUpperCase()})`).join("\n");
          } else {
            answer = `Found **${followups.length} client account(s)** requiring commercial follow-up:\n\n` +
              followups.map((c) => `• **${c.company_name}** (${c.status.toUpperCase()})`).join("\n");
          }
        }
        break;
      }

      case "overdue_invoices": {
        if (overdueInvoices.length === 0) {
          if (lang === "ml") {
            answer = "ശുഭവാർത്ത! നിലവിൽ ഒരു ക്ലയന്റ് അക്കൗണ്ടിലും കുടിശ്ശികയുള്ള ഇൻവോയ്സുകൾ ഒന്നുമില്ല. എല്ലാ പേയ്‌മെന്റുകളും കൃത്യസമയത്താണ്.";
          } else if (lang === "ta") {
            answer = "நல்ல செய்தி! தற்போது எந்த வாடிக்கையாளர் கணக்கிலும் நிலுவையில் உள்ள இன்வாய்ஸ்கள் இல்லை. அனைத்து கொடுப்பனவுகளும் சரியான நேரத்தில் உள்ளன.";
          } else if (lang === "hi") {
            answer = "अच्छी खबर है! वर्तमान में किसी भी ग्राहक खाते पर कोई बकाया (overdue) इनवॉइस नहीं है। सभी भुगतान समय पर हैं।";
          } else if (lang === "te") {
            answer = "శుభవార్త! ప్రస్తుతం ఏ క్లయింట్ ఖాతాలోనూ బకాయి ఉన్న ఇన్వాయిస్‌లు లేవు. అన్నీ సమయానికి చెల్లించబడ్డాయి.";
          } else if (lang === "kn") {
            answer = "ಶುಭ ಸುದ್ದಿ! ಪ್ರಸ್ತುತ ಯಾವುದೇ ಗ್ರಾಹಕರ ಖಾತೆಯಲ್ಲಿ ಬಾಕಿ ಉಳಿದಿರುವ ಇನ್‌ವಾಯ್ಸ್‌ಗಳಿಲ್ಲ. ಎಲ್ಲಾ ಪಾವತಿಗಳು ಸರಿಯಾದ ಸಮಯದಲ್ಲಿದೆ.";
          } else {
            answer = "Great news! There are currently no overdue invoices across all client accounts. Outstanding balances are within normal payment terms.";
          }
        } else {
          if (lang === "ml") {
            answer = `ആകെ **${overdueInvoices.length} കുടിശ്ശികയുള്ള ഇൻവോയ്സുകൾ** ഉണ്ട്, ആകെ കുടിശ്ശിക തുക: **₹${totalOverdue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}**:\n\n` +
              overdueInvoices.map((inv) => `• ഇൻവോയ്സ് **${inv.invoice_number}** (${clientMap.get(inv.client_id) || "ക്ലയന്റ്"}): ബാക്കി ₹${Number(inv.balance_due).toLocaleString("en-IN")} (അവസാന തീയതി: ${inv.due_date || "N/A"})`).join("\n");
          } else if (lang === "ta") {
            answer = `மொத்தம் **${overdueInvoices.length} நிலுவை இன்வாய்ஸ்கள்** உள்ளன, மொத்த தொகை: **₹${totalOverdue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}**:\n\n` +
              overdueInvoices.map((inv) => `• இன்வாய்ஸ் **${inv.invoice_number}** (${clientMap.get(inv.client_id) || "வாடிக்கையாளர்"}): ₹${Number(inv.balance_due).toLocaleString("en-IN")} (கடைசி தேதி: ${inv.due_date || "N/A"})`).join("\n");
          } else if (lang === "hi") {
            answer = `कुल **${overdueInvoices.length} बकाया इनवॉइस** हैं, जिनकी कुल राशि **₹${totalOverdue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}** है:\n\n` +
              overdueInvoices.map((inv) => `• इनवॉइस **${inv.invoice_number}** (${clientMap.get(inv.client_id) || "क्लाइंट"}): ₹${Number(inv.balance_due).toLocaleString("en-IN")} (अंतिम तिथि: ${inv.due_date || "N/A"})`).join("\n");
          } else if (lang === "te") {
            answer = `మొత్తం **${overdueInvoices.length} బకాయి ఇన్వాయిస్‌లు** ఉన్నాయి, మొత్తం మొత్తం **₹${totalOverdue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}**:\n\n` +
              overdueInvoices.map((inv) => `• ఇన్వాయిస్ **${inv.invoice_number}** (${clientMap.get(inv.client_id) || "క్లయింట్"}): ₹${Number(inv.balance_due).toLocaleString("en-IN")} (గడువు: ${inv.due_date || "N/A"})`).join("\n");
          } else if (lang === "kn") {
            answer = `ಒಟ್ಟು **${overdueInvoices.length} ಬಾಕಿ ಇರುವ ಇನ್‌ವಾಯ್ಸ್‌ಗಳು** ಇವೆ, ಒಟ್ಟು ಬಾಕಿ ಮೊತ್ತ: **₹${totalOverdue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}**:\n\n` +
              overdueInvoices.map((inv) => `• ಇನ್‌ವಾಯ್ಸ್ **${inv.invoice_number}** (${clientMap.get(inv.client_id) || "ಗ್ರಾಹಕ"}): ಬಾಕಿ ₹${Number(inv.balance_due).toLocaleString("en-IN")} (ಅಂತಿಮ ದಿನಾಂಕ: ${inv.due_date || "N/A"})`).join("\n");
          } else {
            answer = `Found ${overdueInvoices.length} overdue invoice(s) totaling ₹${totalOverdue.toLocaleString("en-IN", { minimumFractionDigits: 2 })} awaiting collection:\n\n` +
              overdueInvoices.map((inv) => `• Invoice **${inv.invoice_number}** (${clientMap.get(inv.client_id) || "Client"}): ₹${Number(inv.balance_due).toLocaleString("en-IN")} due since ${inv.due_date || "N/A"}`).join("\n");
          }
        }
        break;
      }

      case "monthly_financials": {
        const netMargin = monthlyFin.revenue - monthlyFin.approvedExpenses;
        const marginPct = monthlyFin.revenue > 0 ? ((netMargin / monthlyFin.revenue) * 100).toFixed(1) : "0.0";
        if (lang === "ml") {
          answer = `### പ്രതിമാസ സാമ്പത്തിക പ്രകടന സംഗ്രഹം\n\n` +
            `• **ലഭിച്ച ആകെ വരുമാനം (Revenue):** ₹${monthlyFin.revenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}\n` +
            `• **പ്രവർത്തന ചെലവുകൾ (Expenses):** ₹${monthlyFin.approvedExpenses.toLocaleString("en-IN", { minimumFractionDigits: 2 })}\n` +
            `• **അറ്റാദായം (Net Profit):** ₹${netMargin.toLocaleString("en-IN", { minimumFractionDigits: 2 })} (${marginPct}% മാർജിൻ)\n\n` +
            `എല്ലാ കണക്കുകളും സിസ്റ്റത്തിൽ രേഖപ്പെടുത്തിയ ആധികാരിക ഇടപാടുകളെ അടിസ്ഥാനമാക്കിയുള്ളതാണ്.`;
        } else if (lang === "ta") {
          answer = `### மாதாந்திர நிதிச் சுருக்கம்\n\n` +
            `• **ஈட்டப்பட்ட மொத்த வருவாய் (Revenue):** ₹${monthlyFin.revenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}\n` +
            `• **செயல்பாட்டுச் செலவுகள் (Expenses):** ₹${monthlyFin.approvedExpenses.toLocaleString("en-IN", { minimumFractionDigits: 2 })}\n` +
            `• **நிகர லாபம் (Net Profit):** ₹${netMargin.toLocaleString("en-IN", { minimumFractionDigits: 2 })} (${marginPct}% விளிம்பு)`;
        } else if (lang === "hi") {
          answer = `### मासिक वित्तीय प्रदर्शन सारांश\n\n` +
            `• **प्राप्त कुल राजस्व (Revenue):** ₹${monthlyFin.revenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}\n` +
            `• **संचालन व्यय (Expenses):** ₹${monthlyFin.approvedExpenses.toLocaleString("en-IN", { minimumFractionDigits: 2 })}\n` +
            `• **शुद्ध लाभ (Net Profit):** ₹${netMargin.toLocaleString("en-IN", { minimumFractionDigits: 2 })} (${marginPct}% मार्जिन)\n\n` +
            `सभी आंकड़े कंपनी के सत्यापित वित्तीय रिकॉर्ड पर आधारित हैं।`;
        } else if (lang === "te") {
          answer = `### నెలవారీ ఆర్థిక పనితీరు సారాంశం\n\n` +
            `• **మొత్తం రాబడి (Revenue):** ₹${monthlyFin.revenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}\n` +
            `• **ఖర్చులు (Expenses):** ₹${monthlyFin.approvedExpenses.toLocaleString("en-IN", { minimumFractionDigits: 2 })}\n` +
            `• **నికర లాభం (Net Profit):** ₹${netMargin.toLocaleString("en-IN", { minimumFractionDigits: 2 })} (${marginPct}% మార్జిన్)`;
        } else if (lang === "kn") {
          answer = `### ಮಾಸಿಕ ಆರ್ಥಿಕ ಕಾರ್ಯಕ್ಷಮತೆಯ ಸಾರಾಂಶ\n\n` +
            `• **ಗಳಿಸಿದ ಒಟ್ಟು ಆದಾಯ (Revenue):** ₹${monthlyFin.revenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}\n` +
            `• **ಕಾರ್ಯಾಚರಣೆಯ ವೆಚ್ಚಗಳು (Expenses):** ₹${monthlyFin.approvedExpenses.toLocaleString("en-IN", { minimumFractionDigits: 2 })}\n` +
            `• **ನಿವ್ವಳ ಲಾಭ (Net Profit):** ₹${netMargin.toLocaleString("en-IN", { minimumFractionDigits: 2 })} (${marginPct}% ಮಾರ್ಜಿನ್)`;
        } else {
          answer = `### Monthly Financial Performance Summary\n\n` +
            `• **Realized Gross Revenue:** ₹${monthlyFin.revenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}\n` +
            `• **Operational Expenses:** ₹${monthlyFin.approvedExpenses.toLocaleString("en-IN", { minimumFractionDigits: 2 })}\n` +
            `• **Net Operating Margin:** ₹${netMargin.toLocaleString("en-IN", { minimumFractionDigits: 2 })} (${marginPct}% margin)\n\n` +
            `Cashflow is balanced with recorded collections and verified operational outlays.`;
        }
        break;
      }

      case "pending_quotations": {
        const pipeVal = pendingQuotes.reduce((s, q) => s + Number(q.total_amount || 0), 0);
        if (lang === "ml") {
          answer = `പൈപ്പ്‌ലൈനിൽ ആകെ **${pendingQuotes.length} പെൻഡിംഗ് കൊട്ടേഷനുകൾ** ഉണ്ട്, ആകെ മൂല്യം **₹${pipeVal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}**:\n\n` +
            pendingQuotes.map((q) => `• **${q.quotation_number}**: ₹${Number(q.total_amount).toLocaleString("en-IN")} (${clientMap.get(q.client_id) || "ക്ലയന്റ്"})`).join("\n");
        } else if (lang === "ta") {
          answer = `பைப்லைனில் **${pendingQuotes.length} நிலுவை மேற்கோள்கள்** உள்ளன, மொத்த மதிப்பு **₹${pipeVal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}**:\n\n` +
            pendingQuotes.map((q) => `• **${q.quotation_number}**: ₹${Number(q.total_amount).toLocaleString("en-IN")} (${clientMap.get(q.client_id) || "வாடிக்கையாளர்"})`).join("\n");
        } else if (lang === "te") {
          answer = `పైప్‌లైన్‌లో **${pendingQuotes.length} పెండింగ్ కొటేషన్లు** ఉన్నాయి, మొత్తం విలువ **₹${pipeVal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}**:\n\n` +
            pendingQuotes.map((q) => `• **${q.quotation_number}**: ₹${Number(q.total_amount).toLocaleString("en-IN")} (${clientMap.get(q.client_id) || "క్లయింట్"})`).join("\n");
        } else if (lang === "hi") {
          answer = `पाइपलाइन में **${pendingQuotes.length} लंबित कोटेशन** हैं, जिनका कुल मूल्य **₹${pipeVal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}** है:\n\n` +
            pendingQuotes.map((q) => `• **${q.quotation_number}**: ₹${Number(q.total_amount).toLocaleString("en-IN")} (${clientMap.get(q.client_id) || "क्लाइंट"})`).join("\n");
        } else if (lang === "kn") {
          answer = `ಪೈಪ್‌ಲೈನ್‌ನಲ್ಲಿ ಒಟ್ಟು **${pendingQuotes.length} ಬಾಕಿ ಇರುವ ಕೊಟೇಶನ್‌ಗಳು** ಇವೆ, ಒಟ್ಟು ಮೌಲ್ಯ **₹${pipeVal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}**:\n\n` +
            pendingQuotes.map((q) => `• **${q.quotation_number}**: ₹${Number(q.total_amount).toLocaleString("en-IN")} (${clientMap.get(q.client_id) || "ಗ್ರಾಹಕ"})`).join("\n");
        } else {
          answer = `There are **${pendingQuotes.length} pending quotation(s)** in the pipeline totaling **₹${pipeVal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}**:\n\n` +
            pendingQuotes.map((q) => `• **${q.quotation_number}**: ₹${Number(q.total_amount).toLocaleString("en-IN")} for ${clientMap.get(q.client_id) || "Client"} [${q.status.toUpperCase()}]`).join("\n");
        }
        break;
      }

      case "delayed_projects": {
        if (delayedProjects.length === 0) {
          answer = lang === "ml"
            ? "എല്ലാ സജീവ പ്രോജക്റ്റുകളും കൃത്യസമയത്താണ് നടക്കുന്നത്. കാലതാമസം നേരിട്ട പ്രോജക്റ്റുകൾ ഒന്നുമില്ല."
            : (lang === "ta"
              ? "அனைத்து செயலில் உள்ள திட்டங்களும் அட்டவணைப்படி இயங்குகின்றன. தாமதமான திட்டங்கள் எதுவும் இல்லை."
              : (lang === "te"
                ? "అన్ని క్రియాశీల ప్రాజెక్ట్‌లు సమయానికి నడుస్తున్నాయి. ఆలస్యమైన ప్రాజెక్ట్‌లు ఏవీ లేవు."
                : (lang === "hi"
                  ? "सभी सक्रिय प्रोजेक्ट्स समय पर चल रहे हैं। कोई भी प्रोजेक्ट विलंबित नहीं है।"
                  : (lang === "kn"
                    ? "ಎಲ್ಲಾ ಸಕ್ರಿಯ ಪ್ರಾಜೆಕ್ಟ್‌ಗಳು ಸಮಯಕ್ಕೆ ಸರಿಯಾಗಿ ನಡೆಯುತ್ತಿವೆ. ಯಾವುದೇ ವಿಳಂಬವಾದ ಪ್ರಾಜೆಕ್ಟ್‌ಗಳಿಲ್ಲ."
                    : "All active delivery engagements are tracking on schedule. No overdue deadlines identified."))));
        } else {
          if (lang === "ml") {
            answer = `ആകെ **${delayedProjects.length} കാലതാമസം നേരിട്ട പ്രോജക്റ്റുകൾ** ഉണ്ട്:\n\n` +
              delayedProjects.map((p) => `• **${p.project_name}** (${p.project_code}): അവസാന തീയതി ${p.target_end_date}`).join("\n");
          } else if (lang === "ta") {
            answer = `மொத்தம் **${delayedProjects.length} தாமதமான திட்டப்பணிகள்** உள்ளன:\n\n` +
              delayedProjects.map((p) => `• **${p.project_name}** (${p.project_code}): காலக்கெடு ${p.target_end_date}`).join("\n");
          } else if (lang === "te") {
            answer = `మొత్తం **${delayedProjects.length} ఆలస్యమైన ప్రాజెక్ట్‌లు** ఉన్నాయి:\n\n` +
              delayedProjects.map((p) => `• **${p.project_name}** (${p.project_code}): చివరి తేదీ ${p.target_end_date}`).join("\n");
          } else if (lang === "hi") {
            answer = `**${delayedProjects.length} विलंबित प्रोजेक्ट्स** हैं:\n\n` +
              delayedProjects.map((p) => `• **${p.project_name}** (${p.project_code}): अंतिम तिथि थी ${p.target_end_date}`).join("\n");
          } else if (lang === "kn") {
            answer = `ಒಟ್ಟು **${delayedProjects.length} ವಿಳಂಬವಾದ ಪ್ರಾಜೆಕ್ಟ್‌ಗಳು** ಇವೆ:\n\n` +
              delayedProjects.map((p) => `• **${p.project_name}** (${p.project_code}): ಅಂತಿಮ ದಿನಾಂಕ ${p.target_end_date}`).join("\n");
          } else {
            answer = `Found **${delayedProjects.length} delayed project(s)**:\n\n` +
              delayedProjects.map((p) => `• **${p.project_name}** (${p.project_code}): Target was ${p.target_end_date}`).join("\n");
          }
        }
        break;
      }

      case "unresolved_tickets": {
        if (openTickets.length === 0) {
          answer = lang === "ml"
            ? "സപ്പോർട്ട് ക്യൂ പൂർണ്ണമായും ക്ലിയറാണ്! പരിഹരിക്കപ്പെടാത്ത ടിക്കറ്റുകൾ ഒന്നുമില്ല."
            : (lang === "ta"
              ? "ஆதரவு வரிசை முற்றிலும் தெளிவாக உள்ளது! தீர்க்கப்படாத டிக்கெட்டுகள் எதுவும் இல்லை."
              : (lang === "te"
                ? "సపోర్ట్ క్యూ పూర్తిగా క్లియర్‌గా ఉంది! ఎలాంటి ఓపెన్ టిక్కెట్లు లేవు."
                : (lang === "hi"
                  ? "सपोर्ट कतार पूरी तरह स्पष्ट है! कोई अनसुलझा टिकट नहीं है।"
                  : (lang === "kn"
                    ? "ಬೆಂಬಲ ಕ್ಯೂ ಸಂಪೂರ್ಣವಾಗಿ ಸ್ಪಷ್ಟವಾಗಿದೆ! ಯಾವುದೇ ಮುಕ್ತ ಟಿಕೆಟ್‌ಗಳಿಲ್ಲ."
                    : "Support queues are completely clear! There are zero unresolved tickets."))));
        } else {
          if (lang === "ml") {
            answer = `സിസ്റ്റത്തിൽ ആകെ **${openTickets.length} ഓപ്പൺ സപ്പോർട്ട് ടിക്കറ്റുകൾ** ഉണ്ട്:\n\n` +
              openTickets.map((t) => `• [${t.priority.toUpperCase()}] ${t.ticket_number}: ${t.title}`).join("\n");
          } else if (lang === "ta") {
            answer = `கணினியில் **${openTickets.length} திறந்த ஆதரவு டிக்கெட்டுகள்** உள்ளன:\n\n` +
              openTickets.map((t) => `• [${t.priority.toUpperCase()}] ${t.ticket_number}: ${t.title}`).join("\n");
          } else if (lang === "te") {
            answer = `సిస్టమ్‌లో **${openTickets.length} ఓపెన్ సపోర్ట్ టిక్కెట్లు** ఉన్నాయి:\n\n` +
              openTickets.map((t) => `• [${t.priority.toUpperCase()}] ${t.ticket_number}: ${t.title}`).join("\n");
          } else if (lang === "hi") {
            answer = `सिस्टम में **${openTickets.length} खुले सपोर्ट टिकट** हैं:\n\n` +
              openTickets.map((t) => `• [${t.priority.toUpperCase()}] ${t.ticket_number}: ${t.title}`).join("\n");
          } else if (lang === "kn") {
            answer = `ವ್ಯವಸ್ಥೆಯಲ್ಲಿ **${openTickets.length} ಮುಕ್ತ ಬೆಂಬಲ ಟಿಕೆಟ್‌ಗಳು** ಇವೆ:\n\n` +
              openTickets.map((t) => `• [${t.priority.toUpperCase()}] ${t.ticket_number}: ${t.title}`).join("\n");
          } else {
            answer = `Found **${openTickets.length} open support ticket(s)**:\n\n` +
              openTickets.map((t) => `• [${t.priority.toUpperCase()}] ${t.ticket_number}: ${t.title}`).join("\n");
          }
        }
        break;
      }

      default: {
        const isGreeting = /^(hi|hello|hey|greetings|namaste|vanakkam|namaskar|hola)\b/i.test(question.trim()) ||
          /^(नमस्ते|నమస్కారం|నమస్తే|నమస్కారాలు|ನಮಸ್ಕಾರ|வணக்கம்|നമസ്കാരം|नमस्कार|নমস্কার|નમસ્તે|مرحبا)/i.test(question.trim()) ||
          /\b(kaise ho|kya haal|kya chal raha|ela unnav|ela unnaru|hegiddira|eppadi irukkinga|enthoke|vishesham)\b/i.test(question) ||
          /^(hi|hello|hey|नमस्ते|నమస్కారం|నమస్తే|ನಮಸ್ಕಾರ|வணக்கம்|നമസ്കാരം)$/i.test(question.trim());
        const isIdentity = /\b(who are you|what('s| is| are)? your name|what your name|your name|name please|what can you do|who made you|tum kaun ho|tera naam|naam kya hai|nuvvu evaru|neeku emi telusu|nee peru|un peyar|unga peru|tell me what you do)\b/i.test(question) ||
          /^(who are you|what your name|what is your name|your name)$/i.test(question.trim()) ||
          /(உன் பெயர்|உங்கள் பெயர்|நீ பெயர்|నీ పేరు|మీరు ఎవరు|तुम्हारा नाम|आप कौन हैं|ನಿಮ್ಮ ಹೆಸರು|ನೀವು ಯಾರು|ಯಾರು ನೀವು|ನಿಮ್ಮ ಹೆಸರೇನು|നിങ്ങളുടെ പേര്|നിങ്ങൾ ആരാണ്|ആരാണ് നിങ്ങൾ|नाव काय)/.test(question);
        const isLocation = /\b(where are you|where r u|kahan ho|ekkada unnav|enga irukinga|evideyanu)\b/i.test(question);
        const isConversationalHelp = /\b(let me know|tell me|what do you want|kya chahiye|em kavali|how can you help)\b/i.test(question);
        const isOffTopic = /\b(joke|story|capital of|weather|recipe|sing|movie|president|prime minister|cricket|football|who is the president)\b/i.test(question);

        if (isGreeting && !isIdentity) {
          if (lang === "ml") {
            answer = "നമസ്കാരം! 👋 സ്വാഗതം. ഞാൻ നിങ്ങളുടെ AI അസിസ്റ്റന്റാണ്. ഇന്ന് ഞാൻ നിങ്ങളെ എങ്ങനെ സഹായിക്കണം? ഞങ്ങളുടെ ക്ലയന്റുകൾ, ഇൻവോയ്സുകൾ അല്ലെങ്കിൽ പ്രോജക്റ്റുകൾ എന്നിവയെക്കുറിച്ച് ചോദിക്കൂ.";
          } else if (lang === "te") {
            answer = "నమస్కారం! 👋 స్వాగతం. నేను మీ AI సహాయకుడిని. ఈరోజు నేను మీకు ఎలా సహాయపడగలను? మన క్లయింట్లు, ఇన్వాయిస్‌లు, ప్రాజెక్ట్‌లు లేదా కొటేషన్ల వివరాలు అడగండి.";
          } else if (lang === "hi") {
            answer = "नमस्ते! 👋 स्वागत है। मैं आपका AI सहायक हूँ। आज मैं आपकी क्या सहायता कर सकता हूँ? हमारे क्लाइंट्स, इनवॉइस, सक्रिय प्रोजेक्ट्स या कोटेशन के बारे में कभी भी पूछें।";
          } else if (lang === "kn") {
            answer = "ನಮಸ್ಕಾರ! 👋 ಸುಸ್ವಾಗತ. ನಾನು ನಿಮ್ಮ AI ಸಹಾಯಕ. ಇಂದು ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ? ನಮ್ಮ ಗ್ರಾಹಕರು, ಇನ್‌ವಾಯ್ಸ್‌ಗಳು, ಪ್ರಾಜೆಕ್ಟ್‌ಗಳು ಅಥವಾ ಕೊಟೇಶನ್‌ಗಳ ಬಗ್ಗೆ ಕೇಳಿ.";
          } else if (lang === "ta") {
            answer = "வணக்கம்! 👋 வருக. நான் உங்கள் AI உதவியாளர். இன்று நான் உங்களுக்கு எவ்வாறு உதவ முடியும்? எங்கள் வாடிக்கையாளர்கள், இன்வாய்ஸ்கள் அல்லது திட்டப்பணிகள் குறித்து கேளுங்கள்.";
          } else if (lang === "mr") {
            answer = "नमस्कार! 👋 स्वागत आहे. मी तुमचा AI सहाय्यक आहे. आज मी तुम्हाला कशी मदत करू शकतो? आमचे क्लायंट, इनव्हॉइस, सक्रिय प्रोजेक्ट्स किंवा कोटेशन्सबद्दल विचारा.";
          } else if (lang === "bn") {
            answer = "নমস্কার! 👋 স্বাগতম। আমি আপনার এআই সহকারী। আজ আমি আপনাকে কীভাবে সাহায্য করতে পারি? আমাদের ক্লায়েন্ট, ইনভয়েস, সক্রিয় প্রকল্প বা কোটেশন সম্পর্কে জিজ্ঞাসা করুন।";
          } else if (lang === "gu") {
            answer = "નમસ્તે! 👋 સ્વાગત છે. હું તમારો AI સહાયક છું. આજે હું તમને કેવી રીતે મદદ કરી શકું? અમારા ક્લાયન્ટ્સ, ઇન્વૉઇસેસ અથવા પ્રોજેક્ટ્સ વિશે પૂછો.";
          } else if (lang === "ar") {
            answer = "مرحباً! 👋 أهلاً بك. أنا مساعدك الذكي. كيف يمكنني مساعدتك اليوم؟ لا تتردد في الاستفسار عن العملاء أو الفواتير أو المشاريع أو عروض الأسعار.";
          } else if (lang === "es") {
            answer = "¡Hola! 👋 Bienvenido. Soy tu asistente de IA. ¿Cómo puedo ayudarte hoy? Puedes consultarme sobre clientes, facturas, proyectos o cotizaciones cuando desees.";
          } else {
            answer = "Hello! 👋 Welcome. I'm your AI assistant. How can I help you today? Whenever you're ready, feel free to ask about our clients, invoices, active projects, quotations, or cashflow.";
          }
        } else if (isIdentity) {
          if (lang === "ml") {
            answer = "ഞാൻ **അമിറോ ഇന്റലിജൻസ് (Amiro Intelligence)** ആണ് — അമിറോ ടെക് സൊല്യൂഷൻസിന്റെ സമഗ്ര AI ബിസിനസ്സ് പ്രവർത്തന അസിസ്റ്റന്റ്. ഞങ്ങളുടെ ക്ലയന്റുകൾ, ഇൻവോയ്സുകൾ, പ്രോജക്റ്റുകൾ, കൊട്ടേഷനുകൾ എന്നിവയെക്കുറിച്ചുള്ള കൃത്യമായ വിവരങ്ങൾ നൽകാൻ എനിക്ക് കഴിയും.";
          } else if (lang === "ta") {
            answer = "நான் **அமிரோ இன்டலிஜென்ஸ் (Amiro Intelligence)** — அமிரோ டெக் சொல்யூஷன்ஸின் பிரத்யேக AI வணிக செயல்பாட்டு உதவியாளர். வாடிக்கையாளர்கள், இன்வாய்ஸ்கள், திட்டப்பணிகள் மற்றும் மேற்கோள்கள் பற்றிய துல்லியமான தரவுகளை நான் உங்களுக்கு உடனுக்குடன் வழங்குவேன்.";
          } else if (lang === "te") {
            answer = "నేను **అమీరో ఇంటెలిజెన్స్ (Amiro Intelligence)** — అమీరో టెక్ సొల్యూషన్స్ యొక్క బిజినెస్ ఆపరేషన్స్ అసిస్టెంట్. మీరు అడిగినప్పుడు క్లయింట్లు, ఇన్వాయిస్‌లు మరియు ప్రాజెక్ట్‌ల ఖచ్చితమైన డేటాను అందించగలను.";
          } else if (lang === "hi") {
            answer = "मैं **अमीरू इंटेलिजेंस (Amiro Intelligence)** हूँ — अमीरू टेक सॉल्यूशंस का बिज़नेस ऑपरेशन्स सहायक। जब भी आप पूछेंगे, मैं क्लाइंट्स, इनवॉइस, प्रोजेक्ट्स और कोटेशन का सटीक डेटा तुरंत उपलब्ध करा सकता हूँ।";
          } else if (lang === "kn") {
            answer = "ನಾನು **ಅಮಿರೋ ಇಂಟೆಲಿಜೆನ್ಸ್ (Amiro Intelligence)** — ಅಮಿರೋ ಟೆಕ್ ಸೊಲ್ಯೂಷನ್ಸ್‌ನ ವ್ಯಾಪಾರ ಕಾರ್ಯಾಚರಣೆಗಳ ಸಹಾಯಕ. ಗ್ರಾಹಕರು, ಇನ್‌ವಾಯ್ಸ್‌ಗಳು, ಪ್ರಾಜೆಕ್ಟ್‌ಗಳು ಮತ್ತು ಕೊಟೇಶನ್‌ಗಳ ನಿಖರ ಮಾಹಿತಿಯನ್ನು ನಾನು ನೀಡಬಲ್ಲೆ.";
          } else if (lang === "mr") {
            answer = "मी **अमिरो इंटेलिजन्स (Amiro Intelligence)** आहे — अमिरो टेक सोल्युशन्सचा बिझनेस ऑपरेशन्स सहाय्यक. आमचे क्लायंट, इनव्हॉइस आणि प्रोजेक्ट्सची अचूक माहिती मी देऊ शकतो.";
          } else if (lang === "bn") {
            answer = "আমি **আমিরো ইন্টেলিজেন্স (Amiro Intelligence)** — আমিরো টেক সলিউশনের ব্যবসায়িক অপারেশন সহকারী।";
          } else if (lang === "gu") {
            answer = "હું **અમિરો ઇન્ટેલિજન્સ (Amiro Intelligence)** છું — અમિરો ટેક સોલ્યુશન્સનો બિઝનેસ ઓપરેશન્સ સહાયક.";
          } else if (lang === "ar") {
            answer = "أنا **أميرو انتلجنس (Amiro Intelligence)** — المساعد الذكي لإدارة العمليات لشركة حلول أميرو التقنية. يمكنني تزويدك ببيانات دقيقة عن العملاء والفواتير والمشاريع ועروض الأسعار.";
          } else {
            answer = "I am **Amiro Intelligence**, your AI business operations assistant for Amiro Tech Solutions. I can provide accurate data on our clients, invoices, delivery projects, and quotations whenever you ask.";
          }
        } else if (isLocation) {
          if (lang === "ml") {
            answer = "ഞാൻ നിങ്ങളുടെ **അമിറോ ടെക് സൊല്യൂഷൻസ് പ്ലാറ്റ്‌ഫോമിൽ** നേരിട്ട് ഉൾച്ചേർന്നിരിക്കുന്നു, നിങ്ങളുടെ തത്സമയ ബിസിനസ്സ് റെക്കോർഡുകൾ നിരീക്ഷിക്കുന്നു.";
          } else if (lang === "ta") {
            answer = "நான் உங்கள் **அமிரோ டெக் சொல்யூஷன்ஸ் தளத்திலேயே** இயங்குகிறேன், உங்கள் நிறுவனத்தின் நேரலை வணிகப் பதிவுகளைக் கண்காணிக்கிறேன்.";
          } else if (lang === "te") {
            answer = "నేను మీ **అమీరో టెక్ సొల్యూషన్స్ ప్లాట్‌ఫారమ్** లోనే ఉన్నాను, మీ రియల్-టైమ్ వ్యాపార డేటాను పర్యవేక్షిస్తున్నాను.";
          } else if (lang === "hi") {
            answer = "मैं आपके **अमीरू टेक सॉल्यूशंस प्लेटफ़ॉर्म** के भीतर ही मौजूद हूँ और आपके रीयल-टाइम व्यावसायिक रिकॉर्ड्स की निगरानी कर रहा हूँ।";
          } else if (lang === "kn") {
            answer = "ನಾನು ನಿಮ್ಮ **ಅಮಿರೋ ಟೆಕ್ ಸೊಲ್ಯೂಷನ್ಸ್ ಪ್ಲಾಟ್‌ಫಾರ್ಮ್‌ನಲ್ಲಿಯೇ** ಇದ್ದೇನೆ, ನಿಮ್ಮ ನೈಜ-ಸಮಯದ ವ್ಯಾಪಾರ ದಾಖಲೆಗಳನ್ನು ಮೇಲ್ವಿಚಾರಣೆ ಮಾಡುತ್ತಿದ್ದೇನೆ.";
          } else {
            answer = "I am embedded directly inside your Amiro Tech Solutions platform, monitoring your real-time enterprise operations and verified records.";
          }
        } else if (isConversationalHelp) {
          if (lang === "ml") {
            answer = "സഹായിക്കാൻ ഞാൻ തയ്യാറാണ്! നിങ്ങൾക്ക് താഴെ പറയുന്ന ചോദ്യങ്ങൾ ചോദിക്കാം:\n• *'കുടിശ്ശികയുള്ള ഇൻവോയ്സുകൾ ഏതൊക്കെയാണ്?'*\n• *'ഈ മാസത്തെ വരുമാനവും ലാഭവും കാണിക്കുക'*\n• *'അംഗീകാരത്തിനായി കാത്തിരിക്കുന്ന കൊട്ടേഷനുകൾ ഏതൊക്കെയാണ്?'*\n• *'ക്ലയന്റ് ഫോം ഓട്ടോ-ഫിൽ ചെയ്യുക'*";
          } else if (lang === "ta") {
            answer = "நான் உதவ தயாராக உள்ளேன்! நீங்கள் என்னிடம் கேட்கலாம்:\n• *'நிலுவையில் உள்ள இன்வாய்ஸ்கள் எவை?'*\n• *'இந்த மாத வருவாய் மற்றும் லாபம் காட்டு'* \n• *'ஒப்புதலுக்கு காத்திருக்கும் மேற்கோள்கள் எவை?'*\n• *'படிவத்தை தானாக நிரப்பு'*";
          } else if (lang === "te") {
            answer = "నేను సహాయం చేయడానికి సిద్ధంగా ఉన్నాను! మీరు నన్ను ఇలాంటి ప్రశ్నలు అడగవచ్చు:\n• *'ఏ ఇన్వాయిస్‌లు బకాయి ఉన్నాయి?'*\n• *'నెలవారీ ఆదాయం మరియు లాభం చూపించు'* \n• *'పెండింగ్ కొటేషన్లు ఏవి?'*\n• *'క్లయింట్ ఫారం ఆటో-ఫిల్ చేయండి'*";
          } else if (lang === "hi") {
            answer = "मैं आपकी सहायता के लिए तैयार हूँ! आप मुझसे इस तरह के प्रश्न पूछ सकते हैं:\n• *'कौन से इनवॉइस ओवरड्यू हैं?'*\n• *'इस महीने का कुल राजस्व और लाभ दिखाओ'* \n• *'स्वीकृति के लिए लंबित कोटेशन कौन से हैं?'*\n• *'क्लाइंट फॉर्म को ऑटो-फिल करो'*";
          } else if (lang === "kn") {
            answer = "ನಾನು ಸಹಾಯ ಮಾಡಲು ಸಿದ್ಧನಾಗಿದ್ದೇನೆ! ನೀವು ನನ್ನನ್ನು ಹೀಗೆ ಕೇಳಬಹುದು:\n• *'ಯಾವ ಇನ್‌ವಾಯ್ಸ್‌ಗಳು ಬಾಕಿ ಇವೆ?'*\n• *'ಈ ತಿಂಗಳ ಆದಾಯ ಮತ್ತು ಲಾಭ ತೋರಿಸಿ'*\n• *'ಫಾರ್ಮ್ ಆಟೋ-ಫಿಲ್ ಮಾಡಿ'*";
          } else {
            answer = "I am ready to help! You can ask me questions like:\n• *'Which invoices are overdue?'*\n• *'Show our monthly revenue and profit'* \n• *'Which quotations are waiting for approval?'*\n• *'Auto-fill client form'* \n• *'Show delayed projects'*";
          }
        } else if (isOffTopic) {
          if (lang === "ml") {
            answer = "ഞാൻ **അമിറോ ഇന്റലിജൻസ് (Amiro Intelligence)** ആണ്. ഈ കമ്പനിയുടെ ബിസിനസ്സ് പ്രവർത്തനങ്ങൾക്ക് (ക്ലയന്റുകൾ, ഇൻവോയ്സുകൾ, കൊട്ടേഷനുകൾ, പ്രോജക്റ്റുകൾ) മാത്രമാണ് ഞാൻ നിയോഗിക്കപ്പെട്ടിട്ടുള്ളത്. ദയവായി ബിസിനസ്സ് സംബന്ധമായ ചോദ്യങ്ങൾ ചോദിക്കുക.";
          } else if (lang === "ta") {
            answer = "நான் **அமிரோ இன்டலிஜென்ஸ் (Amiro Intelligence)**. நான் இந்த வணிக செயல்பாட்டு தளத்திற்காக மட்டுமே அங்கீகரிக்கப்பட்டுள்ளேன். நிறுவனத்தின் இன்வாய்ஸ்கள், வாடிக்கையாளர்கள், திட்டப்பணிகள் மற்றும் நிதி பதிவுகள் தொடர்பான கேள்விகளுக்கு மட்டுமே என்னால் பதிலளிக்க முடியும்.";
          } else if (lang === "te") {
            answer = "నేను **అమీరో ఇంటెలిజెన్స్ (Amiro Intelligence)**. నేను ఈ వ్యాపార కార్యకలాపాల అప్లికేషన్‌కు మాత్రమే అధీకృతుడిని. ఇన్వాయిస్‌లు, క్లయింట్లు, కొటేషన్లు మరియు ప్రాజెక్ట్‌లకు సంబంధించిన ప్రశ్నలకు మాత్రమే నేను సమాధానం ఇవ్వగలను.";
          } else if (lang === "hi") {
            answer = "मैं **अमीरू इंटेलिजेंस (Amiro Intelligence)** हूँ। मैं विशेष रूप से इस बिज़नेस ऑपरेशन्स प्लेटफ़ॉर्म के लिए अधिकृत हूँ। मैं केवल आपकी कंपनी के इनवॉइस, क्लाइंट्स, कोटेशन, प्रोजेक्ट्स और वित्तीय रिकॉर्ड्स से संबंधित प्रश्नों का उत्तर दे सकता हूँ।";
          } else {
            answer = "I am **Amiro Intelligence**, your dedicated business operations copilot. I am strictly authorized to assist with this application's business records (clients, invoices, quotations, projects, expenses, and financials). Please ask an application-related question.";
          }
        } else {
          // Check if question mentions any client name specifically
          const matchedClient = clients.find((c) => question.toLowerCase().includes(c.company_name.toLowerCase()));
          if (matchedClient) {
            const clientInvoices = invoices.filter((i) => i.client_id === matchedClient.id);
            const clientProjects = projects.filter((p) => p.client_id === matchedClient.id);
            const clientQuotes = quotations.filter((q) => q.client_id === matchedClient.id);
            answer = `### Client 360 Summary: ${matchedClient.company_name}\n\n` +
              `• **Industry:** ${matchedClient.industry || "Enterprise"}\n` +
              `• **Commercial Status:** ${matchedClient.status.toUpperCase()}\n` +
              `• **Invoices Issued:** ${clientInvoices.length} (${clientInvoices.filter((i) => i.status === "paid").length} settled)\n` +
              `• **Delivery Engagements:** ${clientProjects.length} projects\n` +
              `• **Active Proposals:** ${clientQuotes.length} quotations\n\n` +
              `You can review their complete commercial profile in the Clients module.`;
          } else {
            if (lang === "ml") {
              answer = "അമിറോ ടെക് സൊല്യൂഷൻസ് പ്രവർത്തനങ്ങളിൽ നിങ്ങളെ സഹായിക്കാൻ ഞാൻ ഇവിടെയുണ്ട്. ഞങ്ങളുടെ ക്ലയന്റുകൾ, ഇൻവോയ്സുകൾ, പ്രോജക്റ്റുകൾ, കൊട്ടേഷനുകൾ അല്ലെങ്കിൽ ഫോം ഓട്ടോ-ഫിൽ എന്നിവയെക്കുറിച്ച് എന്ത് വിവരമാണ് അറിയേണ്ടതെന്ന് ദയവായി വ്യക്തമാക്കൂ.";
            } else if (lang === "ta") {
              answer = "நான் அமிரோ டெக் சொல்யூஷன்ஸ் செயல்பாடுகளில் உதவ தயாராக உள்ளேன். எங்கள் வாடிக்கையாளர்கள், இன்வாய்ஸ்கள், செயலில் உள்ள திட்டப்பணிகள் அல்லது மேற்கோள்கள் குறித்து நீங்கள் என்ன பார்க்க விரும்புகிறீர்கள் என்று தயவுசெய்து தெரிவிக்கவும்.";
            } else if (lang === "te") {
              answer = "నేను అమీరో టెక్ సొల్యూషన్స్ కార్యకలాపాలలో సహాయం చేయడానికి ఇక్కడ ఉన్నాను. మన క్లయింట్లు, ఇన్వాయిస్‌లు, కొటేషన్లు లేదా ప్రాజెక్టుల వివరాలు కావాలంటే దయచేసి అడగండి.";
            } else if (lang === "hi") {
              answer = "मैं अमीरू टेक सॉल्यूशंस ऑपरेशन्स में आपकी सहायता के लिए तैयार हूँ। कृपया बताएं यदि आप हमारे क्लाइंट्स, इनवॉइस, कोटेशन या प्रोजेक्ट्स से संबंधित कोई डेटा देखना चाहते हैं।";
            } else if (lang === "kn") {
              answer = "ನಾನು ಅಮಿರೋ ಟೆಕ್ ಸೊಲ್ಯೂಷನ್ಸ್ ಕಾರ್ಯಾಚರಣೆಗಳಲ್ಲಿ ಸಹಾಯ ಮಾಡಲು ಇಲ್ಲಿದ್ದೇನೆ. ನಮ್ಮ ಗ್ರಾಹಕರು, ಇನ್‌ವಾಯ್ಸ್‌ಗಳು, ಪ್ರಾಜೆಕ್ಟ್‌ಗಳು ಅಥವಾ ಕೊಟೇಶನ್‌ಗಳ ಬಗ್ಗೆ ನೀವು ಏನನ್ನು ಪರಿಶೀಲಿಸಲು ಬಯಸುತ್ತೀರಿ ಎಂದು ದಯವಿಟ್ಟು ತಿಳಿಸಿ.";
            } else if (lang === "mr") {
              answer = "मी अमिरो टेक सोल्युशन्सच्या ऑपरेशन्समध्ये मदत करण्यासाठी येथे आहे. आमचे क्लायंट, इनव्हॉइस किंवा प्रोजेक्ट्सबद्दल तुम्हाला काय तपासायचे आहे ते कृपया सांगा.";
            } else if (lang === "bn") {
              answer = "আমি আমিরো টেক সলিউশন অপারেশনে আপনাকে সহায়তা করার জন্য এখানে আছি। আমাদের ক্লায়েন্ট, ইনভয়েস বা প্রকল্প সম্পর্কে আপনি কী জানতে চান দয়া করে জানান।";
            } else if (lang === "gu") {
              answer = "હું અમિરો ટેક સોલ્યુશન્સ ઓપરેશન્સમાં તમારી મદદ કરવા માટે અહીં છું. અમારા ગ્રાહકો, ઇન્વૉઇસેસ અથવા પ્રોજેક્ટ્સ વિશે તમે શું તપાસવા માંગો છો તે કૃપા કરીને જણાવો.";
            } else if (lang === "ar") {
              answer = "أنا هنا لمساعدتك في عمليات حلول أميرو التقنية. يُرجى إخباري بما ترغب في مراجعته بخصوص عملائنا أو فواتيرنا أو مشاريعنا أو عروض أسعارنا.";
            } else {
              answer = "I'm here to assist with Amiro Tech Solutions operations. Please let me know what you would like to check regarding our clients, invoices, active projects, or quotations.";
            }
          }
        }
        break;
      }
    }
  }

  const assistantMessage: CopilotMessage = {
    id: `msg-${Date.now()}-a`,
    role: "assistant",
    content: answer,
    records,
    created_at: new Date().toISOString()
  };

  const title = question.slice(0, 48) + (question.length > 48 ? "…" : "");
  const conversation: CopilotConversation = {
    id: convId,
    title,
    updated_at: new Date().toISOString(),
    language: lang
  };

  saveDemoConversation(conversation);
  const existing = getDemoMessages(convId);
  saveDemoMessages(convId, [...existing, userMessage, assistantMessage]);

  return { conversation, userMessage, assistantMessage };
}
