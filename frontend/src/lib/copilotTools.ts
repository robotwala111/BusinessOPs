import type { CopilotIntent } from "@/types/copilot";

const intentPatterns: Array<[CopilotIntent, RegExp]> = [
  ["today_activities", /\b(today|today's|activities|activity|meetings|calls)\b/i],
  ["overdue_invoices", /\b(overdue|past due|late)\b.*\b(invoice|invoices|payment|payments)\b|\b(invoice|invoices|payment|payments)\b.*\b(overdue|past due|late)\b/i],
  ["client_followups", /\b(follow.?ups?|follow up|followup|follow-up)\b|\bclients?\b.*\b(contact|reach|follow)\b/i],
  ["pending_quotations", /\b(pending|awaiting|open)\b.*\b(quotation|quotations|quote|quotes|proposal|proposals)\b|\b(quotation|quotations|quote|quotes|proposal|proposals)\b.*\b(pending|awaiting|open)\b/i],
  ["delayed_projects", /\b(delayed|late|overdue|behind schedule)\b.*\b(project|projects)\b|\b(project|projects)\b.*\b(delayed|late|overdue|behind schedule)\b/i],
  ["monthly_financials", /\b(monthly|this month|month)\b.*\b(revenue|income|expenses|financials?)\b|\b(revenue|income|expenses|financials?)\b.*\b(monthly|this month|month)\b/i],
  ["expiring_contracts", /\b(expiring|renewal|renewals|expires|expiry)\b.*\b(contract|contracts)\b|\b(contract|contracts)\b.*\b(expiring|renewal|renewals|expires|expiry)\b/i],
  ["unresolved_tickets", /\b(unresolved|open|pending)\b.*\b(ticket|tickets|support)\b|\b(ticket|tickets|support)\b.*\b(unresolved|open|pending)\b/i]
];

export function detectCopilotIntent(question: string): CopilotIntent | null {
  return intentPatterns.find(([, pattern]) => pattern.test(question))?.[0] ?? null;
}

export function calculateMonthlyFinancials(
  payments: Array<{ amount: number | string; adjustment_amount?: number | string | null; withholding_amount?: number | string | null; reversed_at?: string | null }>,
  expenses: Array<{ total_amount: number | string; approval_status?: string | null }>,
) {
  const revenue = payments
    .filter((payment) => !payment.reversed_at)
    .reduce((sum, payment) =>
      sum + Number(payment.amount) + Number(payment.adjustment_amount ?? 0) + Number(payment.withholding_amount ?? 0), 0);
  const expensesTotal = expenses.reduce((sum, expense) => sum + Number(expense.total_amount), 0);
  const approvedExpenses = expenses
    .filter((expense) => ["approved", "paid"].includes(expense.approval_status ?? ""))
    .reduce((sum, expense) => sum + Number(expense.total_amount), 0);

  return {
    revenue: Math.round((revenue + Number.EPSILON) * 100) / 100,
    expenses: Math.round((expensesTotal + Number.EPSILON) * 100) / 100,
    approvedExpenses: Math.round((approvedExpenses + Number.EPSILON) * 100) / 100
  };
}

export function estimateAiCostUsd(
  inputTokens: number,
  outputTokens: number,
  inputRate: string | undefined,
  outputRate: string | undefined,
) {
  const inputCostPerMillion = Number(inputRate);
  const outputCostPerMillion = Number(outputRate);
  if (
    !Number.isFinite(inputCostPerMillion) ||
    inputCostPerMillion < 0 ||
    !Number.isFinite(outputCostPerMillion) ||
    outputCostPerMillion < 0
  ) {
    return null;
  }
  return Math.round(
    ((inputTokens * inputCostPerMillion + outputTokens * outputCostPerMillion) / 1_000_000 + Number.EPSILON) *
      100_000_000
  ) / 100_000_000;
}
