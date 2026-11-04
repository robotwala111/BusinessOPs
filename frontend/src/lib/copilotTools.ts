import type { CopilotIntent } from "@/types/copilot";

const intentPatterns: Array<[CopilotIntent, RegExp]> = [
  [
    "today_activities",
    /\b(today|today's|activities|activity|meetings|calls)\b|(आज|आज की|गतिविधियां|बैठक)|(ఈరోజు|కార్యకలాపాలు)|(actividades de hoy|reuniones)/i
  ],
  [
    "overdue_invoices",
    /\b(overdue|past due|late)\b.*\b(invoice|invoices|payment|payments)\b|\b(invoice|invoices|payment|payments)\b.*\b(overdue|past due|late)\b|(बकाया|देरी|अतिदेय).*(इनवॉइस|बिल|भुगतान)|(इनवॉइस|बिल|भुगतान).*(बकाया|पेंडिंग)|(పెండింగ్|బకాయి).*(ఇన్వాయిస్|చెల్లింపు)|(facturas?|pagos?).*(vencidas?|pendientes?)|(vencidas?|pendientes?).*(facturas?|pagos?)|(baki|pending).*(invoice|bill|payment)/i
  ],
  [
    "client_followups",
    /\b(follow.?ups?|follow up|followup|follow-up)\b|\bclients?\b.*\b(contact|reach|follow)\b|(फॉलो.?अप|ग्राहक संपर्क)|(ఫాలోఅప్|క్లయింట్)|(seguimiento|contactar clientes)/i
  ],
  [
    "pending_quotations",
    /\b(pending|awaiting|open)\b.*\b(quotation|quotations|quote|quotes|proposal|proposals)\b|\b(quotation|quotations|quote|quotes|proposal|proposals)\b.*\b(pending|awaiting|open)\b|(पेंडिंग|खुले|लंबित).*(कोटेशन|प्रस्ताव)|(कोटेशन|प्रस्ताव).*(पेंडिंग|स्वीकृति)|(పెండింగ్).*(కొటేషన్|ప్రతిపాదన)|(cotizaciones?|propuestas?).*(pendientes?|abiertas?)/i
  ],
  [
    "delayed_projects",
    /\b(delayed|late|overdue|behind schedule)\b.*\b(project|projects)\b|\b(project|projects)\b.*\b(delayed|late|overdue|behind schedule)\b|(विलंबित|देरी|लेट).*(प्रोजेक्ट|परियोजना)|(లేట్|ఆలస్యం).*(ప్రాజెక్ట్)|(proyectos?).*(retrasados?|demorados?)/i
  ],
  [
    "monthly_financials",
    /\b(monthly|this month|month)\b.*\b(revenue|income|expenses|financials?)\b|\b(revenue|income|expenses|financials?)\b.*\b(monthly|this month|month)\b|(मासिक|इस महीने|महीने).*(राजस्व|आय|कमाई|खर्च)|(నెల|నెలవారీ).*(ఆదాయం|ఖర్చులు)|(ingresos?|gastos?).*(mensuales?|este mes)/i
  ],
  [
    "expiring_contracts",
    /\b(expiring|renewal|renewals|expires|expiry)\b.*\b(contract|contracts)\b|\b(contract|contracts)\b.*\b(expiring|renewal|renewals|expires|expiry)\b|(समाप्त|नवीनीकरण|एक्सपायरी).*(अनुबंध|कॉन्ट्रैक्ट)|(ముగింపు|గడువు).*(ఒప్పందం|కాంట్రాక్ట్)|(contratos?).*(vencimiento|expirando|renovacion)/i
  ],
  [
    "unresolved_tickets",
    /\b(unresolved|open|pending)\b.*\b(ticket|tickets|support)\b|\b(ticket|tickets|support)\b.*\b(unresolved|open|pending)\b|(अनसुलझे|खुले|लंबित).*(टिकट|सपोर्ट)|(పరిష్కరించని|ఓపెన్).*(టికెట్|సపోర్ట్)|(tickets?|soporte).*(pendientes?|abiertos?)/i
  ]
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
