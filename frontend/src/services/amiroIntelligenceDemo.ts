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

const DEMO_COPILOT_CONVERSATIONS_KEY = "business-ops-demo-copilot-conversations";
const DEMO_COPILOT_MESSAGES_KEY = "business-ops-demo-copilot-messages";

export function getDemoConversations(): CopilotConversation[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(DEMO_COPILOT_CONVERSATIONS_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function saveDemoConversation(conv: CopilotConversation) {
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
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(`${DEMO_COPILOT_MESSAGES_KEY}-${conversationId}`);
  return raw ? JSON.parse(raw) : [];
}

export function saveDemoMessages(conversationId: string, messages: CopilotMessage[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`${DEMO_COPILOT_MESSAGES_KEY}-${conversationId}`, JSON.stringify(messages));
}

function detectQuestionLanguage(text: string): "hi" | "te" | "ta" | "es" | "hinglish" | "en" {
  if (/[\u0900-\u097F]/.test(text)) return "hi"; // Devanagari / Hindi
  if (/[\u0C00-\u0C7F]/.test(text)) return "te"; // Telugu
  if (/[\u0B80-\u0BFF]/.test(text)) return "ta"; // Tamil
  if (/\b(hola|gracias|facturas?|proyectos?|cotizaciones?|cuanto|por favor)\b/i.test(text)) return "es"; // Spanish
  if (/\b(dikhao|batao|karo|kitna|kaun|hai|hoga|baki|paisa|kuch)\b/i.test(text)) return "hinglish";
  return "en";
}

export async function askAmiroIntelligenceDemo(
  question: string,
  currentConvId?: string
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

  const clientMap = new Map(clients.map((c) => [c.id, c.company_name]));
  const intent = detectCopilotIntent(question);
  const lang = detectQuestionLanguage(question);

  let answer = "";
  const records: CopilotRecord[] = [];

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

  const isGreeting = /^(hi|hello|hey|greetings|namaste|vanakkam|namaskar|hola)\b/i.test(question.trim()) || /^(hi|hello|hey)$/i.test(question.trim());
  const isIdentity = /\b(who are you|what can you do|who made you|tum kaun ho|kya kar sakte ho|nuvvu evaru|neeku emi telusu|tell me what you do)\b/i.test(question);
  const isLocation = /\b(where are you|where r u|kahan ho|ekkada unnav|enga irukinga)\b/i.test(question);
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
          history: prior
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
  if (intent === "company_brief" || /amiro/i.test(question)) {
    records.push({
      id: "dash-brief",
      entity: "client",
      label: "Amiro Tech Solutions – Executive Dashboard",
      href: "/dashboard",
      detail: `${clients.length} accounts · ₹${payments.reduce((s, p) => s + Number(p.amount), 0).toLocaleString("en-IN")} realized`
    });
  } else if (intent === "clients_overview" || /client|ग्राहक|క్లయింట్/i.test(question)) {
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
      case "company_brief": {
        const activeClients = clients.filter((c) => c.status === "active");
        const realizedRev = payments.reduce((s, p) => s + Number(p.amount), 0);
        const activeProjs = projects.filter((p) => p.status === "active");

        if (lang === "hi") {
          answer = `### अमीरू टेक सॉल्यूशंस (Amiro Tech Solutions) — कंपनी परिचय एवं बिज़नेस सारांश\n\n` +
            `**अमीरू टेक सॉल्यूशंस** एक प्रमुख एंटरप्राइज टेक्नोलॉजी सॉल्यूशंस एवं बिज़नेस ऑपरेशन्स प्रदाता है। हम आधुनिक डिजिटल इन्फ्रास्ट्रक्चर, कस्टम सॉफ्टवेयर और क्लाउड समाधान प्रदान करते हैं।\n\n` +
            `**लाइव ऑपरेशन्स स्थिति:**\n` +
            `• **क्लाइंट पोर्टफोलियो:** कुल **${clients.length} क्लाइंट खाते** (${activeClients.length} सक्रिय खाते, जैसे ${clients.map((c) => c.company_name).slice(0, 2).join(", ") || "प्रमुख ग्राहक"})\n` +
            `• **प्राप्त कुल राजस्व:** **₹${realizedRev.toLocaleString("en-IN", { minimumFractionDigits: 2 })}** प्राप्त भुगतान\n` +
            `• **सक्रिय डिलीवरी:** **${activeProjs.length} चालू प्रोजेक्ट्स** समय-सीमा पर गतिमान\n` +
            `• **पाइपलाइन कोटेशन:** **${pendingQuotes.length} कोटेशन** समीक्षा और अनुमोदन में\n` +
            `• **बकाया इनवॉइस:** **${overdueInvoices.length} ओवरड्यू इनवॉइस** (कुल बकाया ₹${totalOverdue.toLocaleString("en-IN", { minimumFractionDigits: 2 })})\n` +
            `• **सपोर्ट व अनुबंध:** **${contracts.length} सेवा अनुबंध** और **${openTickets.length}** खुले सपोर्ट टिकट\n\n` +
            `आप मुझसे किसी भी विशिष्ट क्लाइंट, इनवॉइस या प्रोजेक्ट के बारे में विस्तार से पूछ सकते हैं।`;
        } else if (lang === "te") {
          answer = `### అమీరో టెక్ సొల్యూషన్స్ (Amiro Tech Solutions) — కంపెనీ వివరాలు\n\n` +
            `**అమీరో టెక్ సొల్యూషన్స్** అత్యాధునిక ఎంటర్‌ప్రైజ్ సాఫ్ట్‌వేర్ మరియు వ్యాపార నిర్వహణ పరిష్కారాలను అందించే ప్రముఖ సంస్థ.\n\n` +
            `**ప్రస్తుత వ్యాపార స్థితి:**\n` +
            `• **మొత్తం క్లయింట్లు:** **${clients.length} క్లయింట్ ఖాతాలు** (${activeClients.length} యాక్టివ్)\n` +
            `• **వచ్చిన రాబడి:** **₹${realizedRev.toLocaleString("en-IN", { minimumFractionDigits: 2 })}**\n` +
            `• **ప్రస్తుత ప్రాజెక్టులు:** **${activeProjs.length} ప్రాజెక్ట్‌లు** నిర్మాణంలో ఉన్నాయి\n` +
            `• **కొటేషన్లు:** **${pendingQuotes.length} కొటేషన్లు** పెండింగ్‌లో ఉన్నాయి\n` +
            `• **బకాయిలు:** **${overdueInvoices.length} బకాయి బిల్లులు** (మొత్తం ₹${totalOverdue.toLocaleString("en-IN", { minimumFractionDigits: 2 })})\n\n` +
            `మీరు ఏ ప్రాజెక్ట్ లేదా ఇన్వాయిస్ గురించి అయినా వివరాలు అడగవచ్చు.`;
        } else {
          answer = `### Amiro Tech Solutions — Enterprise Operations Briefing\n\n` +
            `**Amiro Tech Solutions** is a premier technology services and enterprise business operations firm specializing in mission-critical business platforms, digital operations management, and secure cloud integrations.\n\n` +
            `**Live Operational Footprint:**\n` +
            `• **Client Portfolio:** **${clients.length} registered accounts** (${activeClients.length} actively engaged: ${clients.map((c) => c.company_name).slice(0, 2).join(", ") || "Active accounts"})\n` +
            `• **Realized Gross Revenue:** **₹${realizedRev.toLocaleString("en-IN", { minimumFractionDigits: 2 })}** in verified collections\n` +
            `• **Delivery Pipeline:** **${activeProjs.length} active delivery projects** tracking milestones on schedule\n` +
            `• **Commercial Pipeline:** **${pendingQuotes.length} quotations** currently awaiting conversion\n` +
            `• **Credit Standing:** **${overdueInvoices.length} overdue invoices** (₹${totalOverdue.toLocaleString("en-IN", { minimumFractionDigits: 2 })} balance due)\n` +
            `• **SLA Commitments:** **${contracts.length} active maintenance contracts** with **${openTickets.length} open tickets**\n\n` +
            `You can request deep-dive analytics for any client account, invoice ledger, project schedule, or quotation proposal.`;
        }
        break;
      }

      case "assistant_status": {
        if (lang === "hi") {
          answer = "मैं आपकी सहायता के लिए तैयार हूँ। जब भी आप हमारे क्लाइंट्स, इनवॉइस, प्रोजेक्ट्स या कोटेशन से संबंधित कोई डेटा देखना चाहें, बस मुझे बताएं!";
        } else if (lang === "te") {
          answer = "నేను మీకు సహాయం చేయడానికి సిద్ధంగా ఉన్నాను. మన క్లయింట్లు, ఇన్వాయిస్‌లు, ప్రాజెక్ట్‌లు లేదా కొటేషన్ల సమాచారం కావాలంటే నన్ను అడగండి!";
        } else {
          answer = "I am ready and standing by to assist you. Whenever you would like to inspect our clients, invoices, active projects, or quotations, just ask!";
        }
        break;
      }

      case "clients_overview": {
        const activeCount = clients.filter((c) => c.status === "active").length;
        if (clients.length === 0) {
          answer = "There are currently no clients registered in the system. You can onboard new clients from the Clients module.";
        } else {
          if (lang === "hi") {
            answer = `सिस्टम में कुल **${clients.length} क्लाइंट्स** दर्ज हैं (**${activeCount} सक्रिय**):\n\n` +
              clients.map((c) => `• **${c.company_name}** (${c.industry || "General"}): स्थिति ${c.status.toUpperCase()}`).join("\n");
          } else if (lang === "te") {
            answer = `సిస్టమ్‌లో మొత్తం **${clients.length} క్లయింట్లు** ఉన్నారు (**${activeCount} యాక్టివ్**):\n\n` +
              clients.map((c) => `• **${c.company_name}** (${c.industry || "General"}): స్థితి ${c.status}`).join("\n");
          } else {
            answer = `There are **${clients.length} client account(s)** registered in the platform (**${activeCount} active**):\n\n` +
              clients.map((c) => `• **${c.company_name}** [${c.industry || "Enterprise"} · Status: ${c.status.toUpperCase()}]`).join("\n");
          }
        }
        break;
      }

      case "active_projects": {
        if (projects.length === 0) {
          answer = "There are currently no active projects recorded. Projects can be initialized from the Projects module.";
        } else {
          const inFlight = projects.filter((p) => p.status === "active" || p.status === "planned");
          if (lang === "hi") {
            answer = `कुल **${projects.length} प्रोजेक्ट्स** हैं (${inFlight.length} सक्रिय/नियोजित):\n\n` +
              projects.map((p) => `• **${p.project_name}** (${p.project_code}): स्थिति ${p.status.toUpperCase()} · लक्ष्य तिथि: ${p.target_end_date || "N/A"}`).join("\n");
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
        answer = `### Invoices & Billing Overview\n\n` +
          `• **Total Invoices Issued:** ${invoices.length} (Total Value: ₹${totalBilled.toLocaleString("en-IN", { minimumFractionDigits: 2 })})\n` +
          `• **Total Realized Collections:** ₹${totalPaid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}\n` +
          `• **Overdue Invoices:** ${overdueInvoices.length} (₹${totalOverdue.toLocaleString("en-IN", { minimumFractionDigits: 2 })})\n\n` +
          invoices.map((inv) => `• **${inv.invoice_number}** (${clientMap.get(inv.client_id) || "Client"}): ₹${Number(inv.total_amount).toLocaleString("en-IN")} [${inv.status.toUpperCase()}]`).join("\n");
        break;
      }

      case "quotations_overview": {
        const totalVal = quotations.reduce((s, q) => s + Number(q.total_amount || 0), 0);
        answer = `### Quotations Pipeline Overview\n\n` +
          `• **Total Quotations:** ${quotations.length} (Total Value: ₹${totalVal.toLocaleString("en-IN", { minimumFractionDigits: 2 })})\n` +
          `• **Pending Approvals:** ${pendingQuotes.length}\n\n` +
          quotations.map((q) => `• **${q.quotation_number}** for ${clientMap.get(q.client_id) || "Client"}: ₹${Number(q.total_amount).toLocaleString("en-IN")} [${q.status.toUpperCase()}]`).join("\n");
        break;
      }

      case "contracts_overview": {
        answer = contracts.length === 0
          ? "There are currently no active contracts recorded."
          : `### Service Contracts & Agreements\n\n` +
            `• **Total Contracts:** ${contracts.length} active\n` +
            `• **Expiring Contracts:** ${expiringContracts.length}\n\n` +
            contracts.map((c) => `• Contract **${c.contract_number}** (${clientMap.get(c.client_id) || "Client"}): Valid until ${c.end_date || "N/A"}`).join("\n");
        break;
      }

      case "today_activities": {
        answer = activities.length === 0
          ? "No activities or calls scheduled for today. You can log client communications from the Activities module."
          : `### Today's Activities & Communication Log\n\n` +
            `• **Total Scheduled/Logged:** ${activities.length} activity record(s)\n\n` +
            activities.slice(0, 5).map((a) => `• [${a.activity_type.toUpperCase()}] ${a.subject || "Activity"} (${a.activity_date || "Today"})`).join("\n");
        break;
      }

      case "client_followups": {
        const followups = clients.filter((c) => c.status === "lead" || c.status === "proposal_sent");
        answer = followups.length === 0
          ? "All client relationships are active and healthy. No urgent follow-up flags recorded."
          : `Found **${followups.length} client account(s)** requiring commercial follow-up:\n\n` +
            followups.map((c) => `• **${c.company_name}** (${c.status.toUpperCase()})`).join("\n");
        break;
      }

      case "overdue_invoices": {
        if (overdueInvoices.length === 0) {
          if (lang === "hi") {
            answer = "अच्छी खबर है! वर्तमान में किसी भी ग्राहक खाते पर कोई बकाया (overdue) इनवॉइस नहीं है। सभी भुगतान समय पर हैं।";
          } else if (lang === "te") {
            answer = "శుభవార్త! ప్రస్తుతం ఏ క్లయింట్ ఖాతాలోనూ బకాయి ఉన్న ఇన్వాయిస్‌లు లేవు. అన్నీ సమయానికి చెల్లించబడ్డాయి.";
          } else {
            answer = "Great news! There are currently no overdue invoices across all client accounts. Outstanding balances are within normal payment terms.";
          }
        } else {
          if (lang === "hi") {
            answer = `कुल **${overdueInvoices.length} बकाया इनवॉइस** हैं, जिनकी कुल राशि **₹${totalOverdue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}** है:\n\n` +
              overdueInvoices.map((inv) => `• इनवॉइस **${inv.invoice_number}** (${clientMap.get(inv.client_id) || "क्लाइंट"}): ₹${Number(inv.balance_due).toLocaleString("en-IN")} (अंतिम तिथि: ${inv.due_date || "N/A"})`).join("\n");
          } else if (lang === "te") {
            answer = `మొత్తం **${overdueInvoices.length} బకాయి ఇన్వాయిస్‌లు** ఉన్నాయి, మొత్తం మొత్తం **₹${totalOverdue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}**:\n\n` +
              overdueInvoices.map((inv) => `• ఇన్వాయిస్ **${inv.invoice_number}** (${clientMap.get(inv.client_id) || "క్లయింట్"}): ₹${Number(inv.balance_due).toLocaleString("en-IN")} (గడువు: ${inv.due_date || "N/A"})`).join("\n");
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
        if (lang === "hi") {
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
        if (lang === "hi") {
          answer = `पाइपलाइन में **${pendingQuotes.length} लंबित कोटेशन** हैं, जिनका कुल मूल्य **₹${pipeVal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}** है:\n\n` +
            pendingQuotes.map((q) => `• **${q.quotation_number}**: ₹${Number(q.total_amount).toLocaleString("en-IN")} (${clientMap.get(q.client_id) || "क्लाइंट"})`).join("\n");
        } else {
          answer = `There are **${pendingQuotes.length} pending quotation(s)** in the pipeline totaling **₹${pipeVal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}**:\n\n` +
            pendingQuotes.map((q) => `• **${q.quotation_number}**: ₹${Number(q.total_amount).toLocaleString("en-IN")} for ${clientMap.get(q.client_id) || "Client"} [${q.status.toUpperCase()}]`).join("\n");
        }
        break;
      }

      case "delayed_projects": {
        if (delayedProjects.length === 0) {
          answer = lang === "hi"
            ? "सभी सक्रिय प्रोजेक्ट्स समय पर चल रहे हैं। कोई भी प्रोजेक्ट विलंबित नहीं है।"
            : "All active delivery engagements are tracking on schedule. No overdue deadlines identified.";
        } else {
          answer = lang === "hi"
            ? `**${delayedProjects.length} विलंबित प्रोजेक्ट्स** हैं:\n\n` + delayedProjects.map((p) => `• **${p.project_name}** (${p.project_code}): अंतिम तिथि थी ${p.target_end_date}`).join("\n")
            : `Found **${delayedProjects.length} delayed project(s)**:\n\n` + delayedProjects.map((p) => `• **${p.project_name}** (${p.project_code}): Target was ${p.target_end_date}`).join("\n");
        }
        break;
      }

      case "unresolved_tickets": {
        answer = openTickets.length === 0
          ? (lang === "hi" ? "सपोर्ट कतार पूरी तरह स्पष्ट है! कोई अनसुलझा टिकट नहीं है।" : "Support queues are completely clear! There are zero unresolved tickets.")
          : `Found **${openTickets.length} open support ticket(s)**:\n\n` + openTickets.map((t) => `• [${t.priority.toUpperCase()}] ${t.ticket_number}: ${t.title}`).join("\n");
        break;
      }

      default: {
        const isGreeting = /^(hi|hello|hey|greetings|namaste|vanakkam|namaskar|hola)\b/i.test(question.trim()) || /^(hi|hello|hey)$/i.test(question.trim());
        const isIdentity = /\b(who are you|what can you do|who made you|tum kaun ho|kya kar sakte ho|nuvvu evaru|neeku emi telusu|tell me what you do)\b/i.test(question);
        const isLocation = /\b(where are you|where r u|kahan ho|ekkada unnav|enga irukinga)\b/i.test(question);
        const isConversationalHelp = /\b(let me know|tell me|what do you want|kya chahiye|em kavali|how can you help)\b/i.test(question);
        const isOffTopic = /\b(joke|story|capital of|weather|recipe|sing|movie|president|prime minister|cricket|football|who is the president)\b/i.test(question);

        if (isGreeting) {
          if (lang === "hi") {
            answer = "नमस्ते! आज मैं आपकी क्या सहायता कर सकता हूँ? जब भी आपको आवश्यकता हो, आप हमारे क्लाइंट्स, इनवॉइस, प्रोजेक्ट्स या कोटेशन से जुड़ा डेटा पूछ सकते हैं।";
          } else if (lang === "te") {
            answer = "నమస్కారం! ఈరోజు నేను మీకు ఎలా సహాయపడగలను? మన క్లయింట్లు, ఇన్వాయిస్‌లు, ప్రాజెక్టులు లేదా కొటేషన్ల వివరాలు కావాలంటే నన్ను అడగండి.";
          } else if (lang === "ta") {
            answer = "வணக்கம்! இன்று நான் உங்களுக்கு எவ்வாறு உதவ முடியும்? எங்கள் வாடிக்கையாளர்கள், இன்வாய்ஸ்கள் அல்லது திட்டப்பணிகள் குறித்து என்னிடம் கேட்கலாம்.";
          } else if (lang === "es") {
            answer = "¡Hola! ¿Cómo puedo ayudarte hoy? Puedes consultarme sobre clientes, facturas, proyectos o cotizaciones cuando desees.";
          } else {
            answer = "Hello! How can I help you today? Whenever you're ready, please ask regarding our clients, invoices, active projects, or quotations.";
          }
        } else if (isIdentity) {
          if (lang === "hi") {
            answer = "मैं **अमीरू इंटेलिजेंस (Amiro Intelligence)** हूँ — अमीरू टेक सॉल्यूशंस का बिज़नेस ऑपरेशन्स सहायक। जब भी आप पूछेंगे, मैं क्लाइंट्स, इनवॉइस, प्रोजेक्ट्स और कोटेशन का सटीक डेटा तुरंत उपलब्ध करा सकता हूँ।";
          } else if (lang === "te") {
            answer = "నేను **అమీరో ఇంటెలిజెన్స్ (Amiro Intelligence)** — అమీరో టెక్ సొల్యూషన్స్ యొక్క బిజినెస్ ఆపరేషన్స్ అసిస్టెంట్. మీరు అడిగినప్పుడు క్లయింట్లు, ఇన్వాయిస్‌లు మరియు ప్రాజెక్ట్‌ల ఖచ్చితమైన డేటాను అందించగలను.";
          } else {
            answer = "I am **Amiro Intelligence**, your AI business operations assistant for Amiro Tech Solutions. I can provide accurate data on our clients, invoices, delivery projects, and quotations whenever you ask.";
          }
        } else if (isLocation) {
          if (lang === "hi") {
            answer = "मैं आपके **अमीरू टेक सॉल्यूशंस प्लेटफ़ॉर्म** के भीतर ही मौजूद हूँ और आपके रीयल-टाइम व्यावसायिक रिकॉर्ड्स की निगरानी कर रहा हूँ।";
          } else if (lang === "te") {
            answer = "నేను మీ **అమీరో టెక్ సొల్యూషన్స్ ప్లాట్‌ఫారమ్** లోనే ఉన్నాను, మీ రియల్-టైమ్ వ్యాపార డేటాను పర్యవేక్షిస్తున్నాను.";
          } else {
            answer = "I am embedded directly inside your Amiro Tech Solutions platform, monitoring your real-time enterprise operations and verified records.";
          }
        } else if (isConversationalHelp) {
          if (lang === "hi") {
            answer = "मैं आपकी सहायता के लिए तैयार हूँ! आप मुझसे इस तरह के प्रश्न पूछ सकते हैं:\n• *'कौन से इनवॉइस ओवरड्यू हैं?'*\n• *'इस महीने का कुल राजस्व और लाभ दिखाओ'* \n• *'स्वीकृति के लिए लंबित कोटेशन कौन से हैं?'*\n• *'क्या कोई प्रोजेक्ट विलंबित है?'*";
          } else if (lang === "te") {
            answer = "నేను సహాయం చేయడానికి సిద్ధంగా ఉన్నాను! మీరు నన్ను ఇలాంటి ప్రశ్నలు అడగవచ్చు:\n• *'ఏ ఇన్వాయిస్‌లు బకాయి ఉన్నాయి?'*\n• *'నెలవారీ ఆదాయం మరియు లాభం చూపించు'* \n• *'పెండింగ్ కొటేషన్లు ఏవి?'*\n• *'ఏవైనా ప్రాజెక్ట్‌లు ఆలస్యమయ్యాయా?'*";
          } else {
            answer = "I am ready to help! You can ask me questions like:\n• *'Which invoices are overdue?'*\n• *'Show our monthly revenue and profit'* \n• *'Which quotations are waiting for approval?'*\n• *'Show delayed projects'* \n• *'Any open support tickets?'*\n\nAsk in English, Hindi, Telugu, Tamil, or your preferred language.";
          }
        } else if (isOffTopic) {
          if (lang === "hi") {
            answer = "मैं **अमीरू इंटेलिजेंस (Amiro Intelligence)** हूँ। मैं विशेष रूप से इस बिज़नेस ऑपरेशन्स प्लेटफ़ॉर्म के लिए अधिकृत हूँ। मैं केवल आपकी कंपनी के इनवॉइस, क्लाइंट्स, कोटेशन, प्रोजेक्ट्स और वित्तीय रिकॉर्ड्स से संबंधित प्रश्नों का उत्तर दे सकता हूँ। कृपया एप्लिकेशन से जुड़ा कोई प्रश्न पूछें।";
          } else if (lang === "te") {
            answer = "నేను **అమీరో ఇంటెలిజెన్స్ (Amiro Intelligence)**. నేను ఈ వ్యాపార కార్యకలాపాల అప్లికేషన్‌కు మాత్రమే అధీకృతుడిని. ఇన్వాయిస్‌లు, క్లయింట్లు, కొటేషన్లు మరియు ప్రాజెక్ట్‌లకు సంబంధించిన ప్రశ్నలకు మాత్రమే నేను సమాధానం ఇవ్వగలను.";
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
            if (lang === "hi") {
              answer = "मैं अमीरू टेक सॉल्यूशंस ऑपरेशन्स में आपकी सहायता के लिए तैयार हूँ। कृपया बताएं यदि आप हमारे क्लाइंट्स, इनवॉइस, कोटेशन या प्रोजेक्ट्स से संबंधित कोई डेटा देखना चाहते हैं।";
            } else if (lang === "te") {
              answer = "నేను అమీరో టెక్ సొల్యూషన్స్ కార్యకలాపాలలో సహాయం చేయడానికి ఇక్కడ ఉన్నాను. మన క్లయింట్లు, ఇన్వాయిస్‌లు, కొటేషన్లు లేదా ప్రాజెక్టుల వివరాలు కావాలంటే దయచేసి అడగండి.";
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
    updated_at: new Date().toISOString()
  };

  saveDemoConversation(conversation);
  const existing = getDemoMessages(convId);
  saveDemoMessages(convId, [...existing, userMessage, assistantMessage]);

  return { conversation, userMessage, assistantMessage };
}
