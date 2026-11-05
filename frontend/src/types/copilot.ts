export type CopilotIntent =
  | "company_brief"
  | "assistant_status"
  | "fill_client_form"
  | "clients_overview"
  | "active_projects"
  | "invoices_overview"
  | "quotations_overview"
  | "contracts_overview"
  | "today_activities"
  | "overdue_invoices"
  | "client_followups"
  | "pending_quotations"
  | "delayed_projects"
  | "monthly_financials"
  | "expiring_contracts"
  | "unresolved_tickets"
  | "today_sales"
  | "weekly_sales"
  | "monthly_sales_trend"
  | "revenue_analysis"
  | "top_clients_by_revenue"
  | "outstanding_receivables"
  | "expense_analysis"
  | "payment_collection_status";

export type CopilotRecord = {
  id: string;
  entity: "lead" | "client" | "activity" | "quotation" | "project" | "invoice" | "contract" | "ticket";
  label: string;
  href: string;
  detail: string;
};

export type CopilotMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  records: CopilotRecord[];
  created_at: string;
};

export type CopilotConversation = {
  id: string;
  title: string;
  updated_at: string;
  language?: string;
};

export type CopilotReply = {
  conversation: CopilotConversation;
  message: CopilotMessage;
  usage: {
    input_tokens: number;
    output_tokens: number;
    estimated_cost_usd: number | null;
  };
};
