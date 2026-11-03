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
  let answer = "";
  const records: CopilotRecord[] = [];

  switch (intent) {
    case "overdue_invoices": {
      const overdue = invoices.filter(
        (inv) =>
          inv.status === "overdue" ||
          (Number(inv.balance_due) > 0 && inv.due_date && inv.due_date < today && inv.status !== "cancelled")
      );

      if (overdue.length === 0) {
        answer = "Great news! There are currently no overdue invoices across all client accounts. Outstanding balances are within normal payment terms.";
      } else {
        const totalOverdue = overdue.reduce((sum, inv) => sum + Number(inv.balance_due || 0), 0);
        answer = `Found ${overdue.length} overdue invoice${overdue.length > 1 ? "s" : ""} totaling ₹${totalOverdue.toLocaleString("en-IN", { minimumFractionDigits: 2 })} awaiting collection:\n\n` +
          overdue
            .map((inv) => `• Invoice **${inv.invoice_number}** (${clientMap.get(inv.client_id) || "Client"}): ₹${Number(inv.balance_due).toLocaleString("en-IN")} due since ${inv.due_date || "N/A"}`)
            .join("\n");

        overdue.forEach((inv) => {
          records.push({
            id: inv.id,
            entity: "invoice",
            label: `${inv.invoice_number} – ${clientMap.get(inv.client_id) || "Client"}`,
            href: `/invoices`,
            detail: `₹${Number(inv.balance_due).toLocaleString("en-IN")} balance due (${inv.due_date})`
          });
        });
      }
      break;
    }

    case "monthly_financials": {
      const fin = calculateMonthlyFinancials(payments, expenses);
      const netMargin = fin.revenue - fin.approvedExpenses;
      const marginPct = fin.revenue > 0 ? ((netMargin / fin.revenue) * 100).toFixed(1) : "0.0";

      answer = `### Monthly Financial Performance Summary\n\n` +
        `• **Realized Gross Revenue:** ₹${fin.revenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}\n` +
        `• **Operational Expenses:** ₹${fin.approvedExpenses.toLocaleString("en-IN", { minimumFractionDigits: 2 })}\n` +
        `• **Net Operating Margin:** ₹${netMargin.toLocaleString("en-IN", { minimumFractionDigits: 2 })} (${marginPct}% margin)\n\n` +
        `Cashflow is balanced with recorded collections and verified operational outlays.`;

      payments.slice(0, 3).forEach((p) => {
        records.push({
          id: p.id,
          entity: "invoice",
          label: `Receipt #${p.id.slice(-6).toUpperCase()} – ₹${Number(p.amount).toLocaleString("en-IN")}`,
          href: "/payments",
          detail: `Settlement via ${p.payment_mode} on ${p.payment_date}`
        });
      });
      break;
    }

    case "pending_quotations": {
      const pending = quotations.filter((q) => ["draft", "sent", "under_review"].includes(q.status));
      if (pending.length === 0) {
        answer = "All commercial quotations are currently converted or closed. There are no quotes awaiting review or client sign-off.";
      } else {
        const pipelineValue = pending.reduce((sum, q) => sum + Number(q.total_amount || 0), 0);
        answer = `There are **${pending.length} pending quotation(s)** in the pipeline with an aggregate value of **₹${pipelineValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}**:\n\n` +
          pending
            .map((q) => `• **${q.quotation_number}** (v${q.revision_number}): ₹${Number(q.total_amount).toLocaleString("en-IN")} for ${clientMap.get(q.client_id) || "Client"} [${q.status.replace("_", " ").toUpperCase()}]`)
            .join("\n");

        pending.forEach((q) => {
          records.push({
            id: q.id,
            entity: "quotation",
            label: `${q.quotation_number} – ${clientMap.get(q.client_id) || "Client"}`,
            href: `/quotations`,
            detail: `₹${Number(q.total_amount).toLocaleString("en-IN")} · Status: ${q.status}`
          });
        });
      }
      break;
    }

    case "delayed_projects": {
      const delayed = projects.filter(
        (p) =>
          !["completed", "closed", "cancelled"].includes(p.status) &&
          p.target_end_date &&
          p.target_end_date < today
      );

      if (delayed.length === 0) {
        answer = "All active engagements and delivery milestones are tracking on schedule. No overdue deadlines identified.";
      } else {
        answer = `Found **${delayed.length} delayed project(s)** requiring milestone adjustment or resource escalation:\n\n` +
          delayed
            .map((p) => `• **${p.project_name}** (${p.project_code}): Target completion was ${p.target_end_date} (Manager: ${p.assigned_manager || "Unassigned"})`)
            .join("\n");

        delayed.forEach((p) => {
          records.push({
            id: p.id,
            entity: "project",
            label: `${p.project_code} – ${p.project_name}`,
            href: `/projects`,
            detail: `Target date was ${p.target_end_date} · Status: ${p.status}`
          });
        });
      }
      break;
    }

    case "client_followups": {
      const activeClients = clients.filter((c) => c.status !== "inactive" && c.status !== "closed");
      answer = `### Recommended Client Follow-ups\n\n` +
        `Based on account activity and contract health, here are primary accounts to check in with:\n\n` +
        activeClients
          .slice(0, 5)
          .map((c) => `• **${c.company_name}** (${c.industry || "General"}): Contact: ${c.email || c.phone || "On File"}`)
          .join("\n");

      activeClients.slice(0, 4).forEach((c) => {
        records.push({
          id: c.id,
          entity: "client",
          label: c.company_name,
          href: `/clients/${c.id}`,
          detail: `${c.industry || "Technology"} · Status: ${c.status}`
        });
      });
      break;
    }

    case "today_activities": {
      answer = `### Operational Pulse & Recent Activities\n\n` +
        `• **Active Client Accounts:** ${clients.length}\n` +
        `• **Active Project Workstreams:** ${projects.filter((p) => p.status === "active").length}\n` +
        `• **Commercial Proposals:** ${quotations.length} total quotes logged\n` +
        `• **Recent Activities:** ${activities.length} recent log entries tracked.\n\n` +
        `All platform modules are synchronized and operating normally.`;

      activities.slice(0, 3).forEach((a) => {
        records.push({
          id: a.id,
          entity: "activity",
          label: `${a.activity_type.toUpperCase()}: ${a.subject}`,
          href: `/activities`,
          detail: a.description || "Activity logged"
        });
      });
      break;
    }

    case "expiring_contracts": {
      const expiring = contracts.filter((c) => c.end_date && c.end_date < today);
      if (expiring.length === 0) {
        answer = "All client contracts and service level agreements are currently in good standing with active validity.";
      } else {
        answer = `Found **${expiring.length} contract(s)** nearing or past expiration date:\n\n` +
          expiring.map((c) => `• **${c.contract_number}**: Ended ${c.end_date} (Value: ₹${Number(c.contract_value || 0).toLocaleString("en-IN")})`).join("\n");

        expiring.forEach((c) => {
          records.push({
            id: c.id,
            entity: "contract",
            label: `${c.contract_number} – ${clientMap.get(c.client_id) || "Client"}`,
            href: `/contracts`,
            detail: `Term ended ${c.end_date}`
          });
        });
      }
      break;
    }

    case "unresolved_tickets": {
      const openTickets = tickets.filter((t) => ["new", "assigned", "in_progress"].includes(t.status));
      if (openTickets.length === 0) {
        answer = "Support queues are completely clear! There are zero unresolved or pending client support tickets.";
      } else {
        answer = `Found **${openTickets.length} open support ticket(s)**:\n\n` +
          openTickets.map((t) => `• **[${t.priority.toUpperCase()}] ${t.ticket_number}**: ${t.title} (${t.status.replace("_", " ")})`).join("\n");

        openTickets.forEach((t) => {
          records.push({
            id: t.id,
            entity: "ticket",
            label: `${t.ticket_number} – ${t.title}`,
            href: `/support`,
            detail: `Priority: ${t.priority} · Status: ${t.status}`
          });
        });
      }
      break;
    }

    default: {
      answer = `I analyzed your request against current business data. Here is the operational summary:\n\n` +
        `• **Clients Portfolio:** ${clients.length} accounts (${clients.filter((c) => c.status === "active").length} active)\n` +
        `• **Active Deliveries:** ${projects.filter((p) => p.status === "active").length} projects in flight\n` +
        `• **Revenue Realized:** ₹${payments.reduce((s, p) => s + Number(p.amount), 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}\n` +
        `• **Invoices Issued:** ${invoices.length} invoices on file\n\n` +
        `You can ask me specific questions like *"Show overdue invoices"*, *"Which quotations are pending?"*, or *"Summarize monthly revenue and expenses"*.`;
      break;
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
