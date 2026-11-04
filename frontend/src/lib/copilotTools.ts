import type { CopilotIntent } from "@/types/copilot";

const intentPatterns: Array<[CopilotIntent, RegExp]> = [
  // 1. High-priority specific queries
  [
    "company_brief",
    /\b(brief|about|who is|overview|details|summary|profile|information)\b.*\b(amiro|company|tech solutions|our organization)\b|\b(amiro|tech solutions)\b.*\b(brief|about|overview|details|summary|profile)\b|(अमीरू|कंपनी के बारे में|कंपनी विवरण)|(అమీరో|కంపెనీ వివరాలు)|(acerca de amiro|sobre amiro)/i
  ],
  [
    "assistant_status",
    /\b(what are you doing|what r u doing|what do you do|what are you working on|current task)\b|(क्या कर रहे हो|तुम क्या करते हो)|(నువ్వు ఏమి చేస్తున్నావు|ఏమి చేస్తున్నావ్)|(que estas haciendo)/i
  ],
  [
    "overdue_invoices",
    /\b(overdue|past due|late)\b.*\b(invoice|invoices|payment|payments)\b|\b(invoice|invoices|payment|payments)\b.*\b(overdue|past due|late)\b|(बकाया|देरी|अतिदेय).*(इनवॉइस|बिल|भुगतान)|(इनवॉइस|बिल|भुगतान).*(बकाया|पेंडिंग)|(పెండింగ్|బకాయి).*(ఇన్వాయిస్|చెల్లింపు)|(facturas?|pagos?).*(vencidas?|pendientes?)|(vencidas?|pendientes?).*(facturas?|pagos?)|(baki|pending).*(invoice|bill|payment)/i
  ],
  [
    "delayed_projects",
    /\b(delayed|late|overdue|behind schedule)\b.*\b(project|projects)\b|\b(project|projects)\b.*\b(delayed|late|overdue|behind schedule)\b|(विलंबित|देरी|लेट).*(प्रोजेक्ट|परियोजना)|(లేట్|ఆలస్యం).*(ప్రాజెక్ట్)|(proyectos?).*(retrasados?|demorados?)/i
  ],
  [
    "pending_quotations",
    /\b(pending|awaiting|open)\b.*\b(quotation|quotations|quote|quotes|proposal|proposals)\b|\b(quotation|quotations|quote|quotes|proposal|proposals)\b.*\b(pending|awaiting|open)\b|(पेंडिंग|खुले|लंबित).*(कोटेशन|प्रस्ताव)|(कोटेशन|प्रस्ताव).*(पेंडिंग|स्वीकृति)|(పెండింగ్).*(కొటేషన్|ప్రతిపాదన)|(cotizaciones?|propuestas?).*(pendientes?|abiertas?)/i
  ],
  [
    "expiring_contracts",
    /\b(expiring|renewal|renewals|expires|expiry)\b.*\b(contract|contracts)\b|\b(contract|contracts)\b.*\b(expiring|renewal|renewals|expires|expiry)\b|(समाप्त|नवीनीकरण|एक्सपायरी).*(अनुबंध|कॉन्ट्रैक्ट)|(ముగింపు|గడువు).*(ఒప్పందం|కాంట్రాక్ట్)|(contratos?).*(vencimiento|expirando|renovacion)/i
  ],
  [
    "unresolved_tickets",
    /\b(unresolved|open|pending)\b.*\b(ticket|tickets|support)\b|\b(ticket|tickets|support)\b.*\b(unresolved|open|pending)\b|(अनसुलझे|खुले|लंबित).*(टिकट|सपोर्ट)|(పరిష్కరించని|ఓపెన్).*(టికెట్|సపోర్ట్)|(tickets?|soporte).*(pendientes?|abiertos?)/i
  ],
  [
    "today_activities",
    /\b(today|today's|activities|activity|meetings|calls)\b|(आज|आज की|गतिविधियां|बैठक)|(ఈరోజు|కార్యకలాపాలు)|(actividades de hoy|reuniones)/i
  ],
  [
    "client_followups",
    /\b(follow.?ups?|follow up|followup|follow-up)\b|\bclients?\b.*\b(contact|reach|follow)\b|(फॉलो.?अप|ग्राहक संपर्क)|(ఫాలోఅప్|క్లయింట్)|(seguimiento|contactar clientes)/i
  ],

  // 2. Broader module overviews (lower precedence)
  [
    "monthly_financials",
    /\b(monthly|this month|month)\b.*\b(revenue|income|expenses|financials?)\b|\b(revenue|income|expenses|financials?)\b.*\b(monthly|this month|month)\b|(मासिक|इस महीने|महीने).*(राजस्व|आय|कमाई|खर्च)|(నెల|నెలవారీ).*(ఆదాయం|ఖర్చులు)|(ingresos?|gastos?).*(mensuales?|este mes)/i
  ],
  [
    "clients_overview",
    /\b(clients?|customers?)\b.*\b(list|show|all|how many|who|active|portfolio|accounts?)\b|\b(list|show|all|how many|who)\b.*\b(clients?|customers?)\b|(क्लाइंट|ग्राहक).*(सूची|दिखाओ|कितने)|(క్లయింట్లు|కస్టమర్లు).*(చూపించు|ఎంతమంది)|(clientes).*(mostrar|cuantos)/i
  ],
  [
    "active_projects",
    /\b(projects?)\b.*\b(list|show|all|active|running|current|ongoing|progress|deliveries)\b|\b(list|show|all|active|running|current|ongoing)\b.*\b(projects?)\b|(प्रोजेक्ट|परियोजना).*(दिखाओ|सूची|चालू)|(ప్రాజెక్టులు).*(చూపించు|లిస్ట్|ప్రస్తుత)/i
  ],
  [
    "invoices_overview",
    /\b(invoices?|bills?)\b.*\b(list|show|all|total|recent|summary|issued)\b|\b(list|show|all|total|recent|summary)\b.*\b(invoices?|bills?)\b|(इनवॉइस|बिल).*(दिखाओ|सूची|कुल)|(ఇన్వాయిస్లు|బిల్లులు).*(చూపించు|మొత్తం)/i
  ],
  [
    "quotations_overview",
    /\b(quotations?|quotes?|proposals?)\b.*\b(list|show|all|recent|summary|pipeline)\b|\b(list|show|all|recent)\b.*\b(quotations?|quotes?|proposals?)\b|(कोटेशन|प्रस्ताव).*(दिखाओ|सूची)|(కొటేషన్లు).*(చూపించు|లిస్ట్)/i
  ],
  [
    "contracts_overview",
    /\b(contracts?|agreements?|slas?)\b.*\b(list|show|all|active|summary)\b|\b(list|show|all)\b.*\b(contracts?|agreements?|slas?)\b|(अनुबंध|कॉन्ट्रैक्ट).*(दिखाओ|सूची)|(ఒప్పందాలు).*(చూపించు|లిస్ట్)/i
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
    !Number.isFinite(outputCostPerMillion) ||
    inputCostPerMillion < 0 ||
    outputCostPerMillion < 0
  ) {
    return null;
  }
  return (inputTokens * inputCostPerMillion + outputTokens * outputCostPerMillion) / 1_000_000;
}
