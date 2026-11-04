import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateMonthlyFinancials } from "@/lib/copilotTools";
import type { CopilotIntent, CopilotRecord } from "@/types/copilot";

type BusinessRecord = Record<string, unknown> & { id: string };
type QueryResult = { facts: Record<string, unknown>; records: CopilotRecord[] };
type QueryLike<T> = PromiseLike<{ data: T[] | null; error: { code?: string } | null }>;

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function nextDay(date: string) {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

function startOfNextMonth(date: string) {
  const monthStart = new Date(`${date.slice(0, 7)}-01T00:00:00.000Z`);
  monthStart.setUTCMonth(monthStart.getUTCMonth() + 1);
  return monthStart.toISOString().slice(0, 10);
}

function record(
  entity: CopilotRecord["entity"],
  id: string,
  label: string,
  href: string,
  detail: string,
): CopilotRecord {
  return { id, entity, label: label.slice(0, 180), href, detail: detail.slice(0, 400) };
}

async function getClientNames(client: SupabaseClient, ids: string[]) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean))).slice(0, 100);
  if (!uniqueIds.length) return new Map<string, string>();
  const { data, error } = await client.from("clients").select("id,company_name").in("id", uniqueIds);
  if (error) throw new Error("Unable to load authorized client names for Copilot results.");
  return new Map((data ?? []).map((item) => [item.id as string, item.company_name as string]));
}

async function readRows(query: QueryLike<BusinessRecord>, table: string) {
  const { data, error } = await query;
  if (error) {
    console.error("Copilot business query failed", { table, code: error.code });
    throw new Error("Unable to retrieve authorized business records.");
  }
  return (data ?? []) as BusinessRecord[];
}

async function readMonthlyRows<T extends Record<string, unknown>>(
  table: string,
  queryForPage: (offset: number, pageSize: number) => QueryLike<T>,
): Promise<T[]> {
  const pageSize = 500;
  const maxRows = 10_000;
  const rows: T[] = [];
  for (let offset = 0; offset <= maxRows; offset += pageSize) {
    const { data, error } = await queryForPage(offset, pageSize);
    if (error) {
      console.error("Copilot monthly query failed", { table, code: error.code });
      throw new Error("Unable to retrieve authorized monthly financial records.");
    }
    const page = (data ?? []) as T[];
    if (offset >= maxRows && page.length > 0) {
      throw new Error("Monthly financial record limit exceeded; use the standard reports for a complete result.");
    }
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
  throw new Error("Monthly financial record limit exceeded; use the standard reports for a complete result.");
}

async function runQuery(client: SupabaseClient, intent: CopilotIntent): Promise<QueryResult> {
  const today = todayUtc();
  const tomorrow = nextDay(today);
  switch (intent) {
    case "today_activities": {
      const rows = await readRows(client.from("activities")
        .select("id,client_id,subject,activity_type,activity_date,due_date,status,priority")
        .gte("activity_date", `${today}T00:00:00.000Z`).lt("activity_date", `${tomorrow}T00:00:00.000Z`)
        .order("activity_date").limit(50), "activities");
      const names = await getClientNames(client, rows.map((item) => String(item.client_id ?? "")));
      const records = rows.map((item) => record("activity", item.id, String(item.subject), `/activities`,
        `${String(item.activity_type)} · ${String(item.status)} · ${names.get(String(item.client_id)) ?? "Client"}`));
      return { facts: { date: today, count: rows.length, activities: rows.map((item) => ({ subject: item.subject, type: item.activity_type, status: item.status, priority: item.priority, client: names.get(String(item.client_id)) ?? "Client" })) }, records };
    }
    case "overdue_invoices": {
      const rows = await readRows(client.from("invoices")
        .select("id,client_id,invoice_number,due_date,status,total_amount,amount_paid,balance_due")
        .lt("due_date", today).in("status", ["issued", "sent", "partially_paid", "overdue"])
        .order("due_date").limit(100), "invoices");
      const names = await getClientNames(client, rows.map((item) => String(item.client_id ?? "")));
      const records = rows.map((item) => {
        const balance = Number(item.balance_due ?? Math.max(0, Number(item.total_amount) - Number(item.amount_paid)));
        return record("invoice", item.id, String(item.invoice_number), `/invoices/${item.id}`,
          `${names.get(String(item.client_id)) ?? "Client"} · ${item.status} · ${balance.toFixed(2)} due · due ${item.due_date}`);
      });
      const totalOutstanding = rows.reduce((sum, item) => sum + Number(item.balance_due ?? Math.max(0, Number(item.total_amount) - Number(item.amount_paid))), 0);
      return { facts: { asOf: today, count: rows.length, outstanding: Number(totalOutstanding.toFixed(2)), invoices: records.map((item) => item.detail) }, records };
    }
    case "client_followups": {
      const [activities, leads] = await Promise.all([
        readRows(client.from("activities").select("id,client_id,subject,due_date,status,priority")
          .eq("status", "pending").lt("due_date", `${tomorrow}T00:00:00.000Z`).order("due_date").limit(50), "activities"),
        readRows(client.from("leads").select("id,company_name,follow_up_date,status,priority")
          .lt("follow_up_date", `${tomorrow}T00:00:00.000Z`).not("status", "in", '("converted","lost")')
          .order("follow_up_date").limit(50), "leads")
      ]);
      const names = await getClientNames(client, activities.map((item) => String(item.client_id ?? "")));
      const activityRecords = activities.map((item) => record("activity", item.id, String(item.subject), "/activities",
        `${names.get(String(item.client_id)) ?? "Client"} · due ${item.due_date}`));
      const leadRecords = leads.map((item) => record("lead", item.id, String(item.company_name), "/leads",
        `${item.status} · follow-up ${item.follow_up_date}`));
      return { facts: { asOf: today, activityFollowups: activityRecords.map((item) => item.detail), leadFollowups: leadRecords.map((item) => item.detail) }, records: [...activityRecords, ...leadRecords] };
    }
    case "pending_quotations": {
      const rows = await readRows(client.from("quotations").select("id,client_id,quotation_number,title,status,total_amount,valid_until")
        .in("status", ["draft", "under_review", "approved", "sent"]).order("updated_at", { ascending: false }).limit(100), "quotations");
      const names = await getClientNames(client, rows.map((item) => String(item.client_id ?? "")));
      const records = rows.map((item) => record("quotation", item.id, String(item.quotation_number), `/quotations/${item.id}`,
        `${String(item.title)} · ${names.get(String(item.client_id)) ?? "Client"} · ${item.status} · ${Number(item.total_amount).toFixed(2)}`));
      return { facts: { count: rows.length, quotations: records.map((item) => item.detail) }, records };
    }
    case "delayed_projects": {
      const rows = await readRows(client.from("projects").select("id,client_id,project_code,project_name,status,target_end_date,priority")
        .lt("target_end_date", today).not("status", "in", '("completed","closed","cancelled","archived")')
        .order("target_end_date").limit(100), "projects");
      const names = await getClientNames(client, rows.map((item) => String(item.client_id ?? "")));
      const records = rows.map((item) => record("project", item.id, String(item.project_name), `/projects/${item.id}`,
        `${String(item.project_code)} · ${names.get(String(item.client_id)) ?? "Client"} · ${item.status} · target ${item.target_end_date}`));
      return { facts: { asOf: today, count: rows.length, projects: records.map((item) => item.detail) }, records };
    }
    case "monthly_financials": {
      const start = `${today.slice(0, 7)}-01`;
      const end = startOfNextMonth(today);
      const [payments, expenses, settings] = await Promise.all([
        readMonthlyRows("payments", (offset, pageSize) => client.from("payments")
          .select("amount,adjustment_amount,withholding_amount,reversed_at")
          .gte("payment_date", start).lt("payment_date", end)
          .range(offset, offset + pageSize - 1)),
        readMonthlyRows("expenses", (offset, pageSize) => client.from("expenses")
          .select("total_amount,approval_status")
          .gte("expense_date", start).lt("expense_date", end)
          .range(offset, offset + pageSize - 1)),
        client.from("company_settings").select("currency").limit(1).maybeSingle()
      ]);
      if (settings.error) throw new Error("Unable to retrieve the configured business currency.");
      const totals = calculateMonthlyFinancials(payments, expenses);
      return { facts: { month: today.slice(0, 7), currency: settings.data?.currency ?? "INR", collectedRevenue: totals.revenue, recordedExpenses: totals.expenses, approvedOrPaidExpenses: totals.approvedExpenses, paymentCount: payments.filter((payment) => !payment.reversed_at).length, expenseCount: expenses.length }, records: [] };
    }
    case "expiring_contracts": {
      const limit = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
      const rows = await readRows(client.from("contracts").select("id,client_id,contract_number,title,status,end_date,renewal_date")
        .in("status", ["active", "signed", "sent_for_signature"])
        .or(`and(end_date.gte.${today},end_date.lte.${limit}),and(renewal_date.gte.${today},renewal_date.lte.${limit})`)
        .order("end_date").limit(100), "contracts");
      const names = await getClientNames(client, rows.map((item) => String(item.client_id ?? "")));
      const records = rows.map((item) => record("contract", item.id, String(item.contract_number), `/contracts/${item.id}`,
        `${String(item.title)} · ${names.get(String(item.client_id)) ?? "Client"} · ${item.status} · ends ${item.end_date ?? "unknown"} · renewal ${item.renewal_date ?? "not set"}`));
      return { facts: { asOf: today, windowDays: 30, count: rows.length, contracts: records.map((item) => item.detail) }, records };
    }
    case "unresolved_tickets": {
      const rows = await readRows(client.from("support_tickets").select("id,client_id,ticket_number,title,status,priority,due_date")
        .not("status", "in", '("resolved","closed","cancelled")').order("priority").order("due_date").limit(100), "support_tickets");
      const names = await getClientNames(client, rows.map((item) => String(item.client_id ?? "")));
      const records = rows.map((item) => record("ticket", item.id, String(item.ticket_number), `/support/${item.id}`,
        `${String(item.title)} · ${names.get(String(item.client_id)) ?? "Client"} · ${item.status} · ${item.priority} · due ${item.due_date ?? "not set"}`));
      return { facts: { count: rows.length, tickets: records.map((item) => item.detail) }, records };
    }
    default: {
      const rows = await readRows(client.from("clients").select("id,company_name,status").limit(20), "clients");
      const records = rows.map((c) => record("client", c.id, String(c.company_name), `/clients/${c.id}`, `Status: ${c.status}`));
      return { facts: { company: "Amiro Tech Solutions", activeClients: rows.length }, records };
    }
  }
}

export async function getCopilotFacts(client: SupabaseClient, intent: CopilotIntent) {
  return runQuery(client, intent);
}
