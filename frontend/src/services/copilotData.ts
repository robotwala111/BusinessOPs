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
    case "today_sales": {
      const { data: payments, error: paymentsError } = await client
        .from("payments")
        .select("id,amount,adjustment_amount,withholding_amount,payment_date,invoice:invoices(id,invoice_number,client_id,client:clients(id,company_name))")
        .gte("payment_date", `${today}T00:00:00.000Z`)
        .lt("payment_date", `${tomorrow}T00:00:00.000Z`)
        .is("reversed_at", null)
        .limit(100);
      
      if (paymentsError) throw new Error("Unable to retrieve today's payment records.");
      
      const { data: invoices, error: invoicesError } = await client
        .from("invoices")
        .select("id,invoice_number,total_amount,client_id,client:clients(id,company_name)")
        .gte("created_at", `${today}T00:00:00.000Z`)
        .lt("created_at", `${tomorrow}T00:00:00.000Z`)
        .limit(100);
      
      if (invoicesError) throw new Error("Unable to retrieve today's invoice records.");
      
      const totalCollected = (payments ?? []).reduce((sum, p) => 
        sum + Number(p.amount) + Number(p.adjustment_amount ?? 0) + Number(p.withholding_amount ?? 0), 0);
      
      const totalInvoiced = (invoices ?? []).reduce((sum, inv) => 
        sum + Number(inv.total_amount), 0);
      
      const records: CopilotRecord[] = (payments ?? []).slice(0, 10).map((p) => {
        const inv = p.invoice as any;
        const clientName = inv?.client?.company_name ?? "Client";
        return record("invoice", p.id, `Payment - ${inv?.invoice_number ?? "N/A"}`, 
          `/invoices/${inv?.id ?? ""}`, 
          `${clientName} · ₹${Number(p.amount).toLocaleString('en-IN')}`);
      });
      
      return {
        facts: {
          date: today,
          paymentsCollected: Math.round(totalCollected * 100) / 100,
          invoicesIssued: Math.round(totalInvoiced * 100) / 100,
          paymentsCount: (payments ?? []).length,
          invoicesCount: (invoices ?? []).length,
          summary: `Today's collections: ₹${Math.round(totalCollected).toLocaleString('en-IN')}, Invoices issued: ₹${Math.round(totalInvoiced).toLocaleString('en-IN')}`
        },
        records
      };
    }
    
    case "weekly_sales": {
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      const { data: payments, error } = await client
        .from("payments")
        .select("amount,adjustment_amount,withholding_amount,payment_date")
        .gte("payment_date", `${weekAgo}T00:00:00.000Z`)
        .lt("payment_date", `${tomorrow}T00:00:00.000Z`)
        .is("reversed_at", null)
        .order("payment_date", { ascending: true });
      
      if (error) throw new Error("Unable to retrieve weekly payment records.");
      
      const dailySales = new Map<string, number>();
      (payments ?? []).forEach(p => {
        const date = p.payment_date.split('T')[0];
        const amount = Number(p.amount) + Number(p.adjustment_amount ?? 0) + Number(p.withholding_amount ?? 0);
        dailySales.set(date, (dailySales.get(date) ?? 0) + amount);
      });
      
      const totalWeekRevenue = Array.from(dailySales.values()).reduce((sum, amt) => sum + amt, 0);
      const averageDailySales = dailySales.size > 0 ? totalWeekRevenue / dailySales.size : 0;
      
      return {
        facts: {
          weekStart: weekAgo,
          weekEnd: today,
          dailySales: Array.from(dailySales.entries()).map(([date, amount]) => ({ 
            date, 
            amount: Math.round(amount * 100) / 100 
          })),
          totalWeekRevenue: Math.round(totalWeekRevenue * 100) / 100,
          averageDailySales: Math.round(averageDailySales * 100) / 100,
          activeDays: dailySales.size,
          summary: `Weekly revenue: ₹${Math.round(totalWeekRevenue).toLocaleString('en-IN')}, Average: ₹${Math.round(averageDailySales).toLocaleString('en-IN')}/day`
        },
        records: []
      };
    }
    
    case "monthly_sales_trend": {
      const monthStart = `${today.slice(0, 7)}-01`;
      const monthEnd = startOfNextMonth(today);
      const { data: payments, error } = await client
        .from("payments")
        .select("payment_date,amount,adjustment_amount,withholding_amount")
        .gte("payment_date", `${monthStart}T00:00:00.000Z`)
        .lt("payment_date", `${monthEnd}T00:00:00.000Z`)
        .is("reversed_at", null)
        .order("payment_date", { ascending: true });
      
      if (error) throw new Error("Unable to retrieve monthly payment records.");
      
      const dailySales = new Map<string, number>();
      (payments ?? []).forEach(p => {
        const date = p.payment_date.split('T')[0];
        const amount = Number(p.amount) + Number(p.adjustment_amount ?? 0) + Number(p.withholding_amount ?? 0);
        dailySales.set(date, (dailySales.get(date) ?? 0) + amount);
      });
      
      const totalMonthRevenue = Array.from(dailySales.values()).reduce((sum, amt) => sum + amt, 0);
      const averageDailySales = dailySales.size > 0 ? totalMonthRevenue / dailySales.size : 0;
      
      return {
        facts: {
          month: today.slice(0, 7),
          dailySales: Array.from(dailySales.entries()).map(([date, amount]) => ({ 
            date, 
            amount: Math.round(amount * 100) / 100 
          })),
          totalMonthRevenue: Math.round(totalMonthRevenue * 100) / 100,
          averageDailySales: Math.round(averageDailySales * 100) / 100,
          activeDays: dailySales.size,
          summary: `Monthly revenue: ₹${Math.round(totalMonthRevenue).toLocaleString('en-IN')}, Average: ₹${Math.round(averageDailySales).toLocaleString('en-IN')}/day over ${dailySales.size} days`
        },
        records: []
      };
    }
    
    case "revenue_analysis": {
      const monthStart = `${today.slice(0, 7)}-01`;
      const monthEnd = startOfNextMonth(today);
      const { data: payments, error } = await client
        .from("payments")
        .select("amount,adjustment_amount,withholding_amount,payment_method,invoice:invoices(client_id,client:clients(id,company_name))")
        .gte("payment_date", `${monthStart}T00:00:00.000Z`)
        .lt("payment_date", `${monthEnd}T00:00:00.000Z`)
        .is("reversed_at", null);
      
      if (error) throw new Error("Unable to retrieve revenue records.");
      
      const totalRevenue = (payments ?? []).reduce((sum, p) => 
        sum + Number(p.amount) + Number(p.adjustment_amount ?? 0) + Number(p.withholding_amount ?? 0), 0);
      
      const byMethod = new Map<string, number>();
      (payments ?? []).forEach(p => {
        const method = String(p.payment_method ?? "other");
        const amount = Number(p.amount) + Number(p.adjustment_amount ?? 0) + Number(p.withholding_amount ?? 0);
        byMethod.set(method, (byMethod.get(method) ?? 0) + amount);
      });
      
      return {
        facts: {
          month: today.slice(0, 7),
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          paymentCount: (payments ?? []).length,
          byPaymentMethod: Array.from(byMethod.entries()).map(([method, amount]) => ({
            method,
            amount: Math.round(amount * 100) / 100,
            percentage: Math.round((amount / totalRevenue) * 100)
          })),
          summary: `Total revenue: ₹${Math.round(totalRevenue).toLocaleString('en-IN')} from ${(payments ?? []).length} payments`
        },
        records: []
      };
    }
    
    case "top_clients_by_revenue": {
      const { data: payments, error } = await client
        .from("payments")
        .select("amount,adjustment_amount,withholding_amount,invoice:invoices(client_id,client:clients(id,company_name))")
        .is("reversed_at", null)
        .limit(1000);
      
      if (error) throw new Error("Unable to retrieve client revenue records.");
      
      const revenueByClient = new Map<string, { id: string; name: string; revenue: number }>();
      (payments ?? []).forEach(p => {
        const inv = p.invoice as any;
        if (inv?.client?.id) {
          const clientId = inv.client.id;
          const clientName = inv.client.company_name;
          const amount = Number(p.amount) + Number(p.adjustment_amount ?? 0) + Number(p.withholding_amount ?? 0);
          
          if (!revenueByClient.has(clientId)) {
            revenueByClient.set(clientId, { id: clientId, name: clientName, revenue: 0 });
          }
          const existing = revenueByClient.get(clientId)!;
          existing.revenue += amount;
        }
      });
      
      const topClients = Array.from(revenueByClient.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);
      
      const records: CopilotRecord[] = topClients.map((c, idx) => record(
        "client",
        c.id,
        `${idx + 1}. ${c.name}`,
        `/clients/${c.id}`,
        `Total Revenue: ₹${Math.round(c.revenue).toLocaleString('en-IN')}`
      ));
      
      return {
        facts: {
          topClients: topClients.map((c, idx) => ({
            rank: idx + 1,
            name: c.name,
            revenue: Math.round(c.revenue * 100) / 100
          })),
          totalClientsAnalyzed: revenueByClient.size,
          summary: `Top 10 clients analyzed from ${revenueByClient.size} total clients`
        },
        records
      };
    }
    
    case "outstanding_receivables": {
      const { data: unpaidInvoices, error } = await client
        .from("invoices")
        .select("id,invoice_number,total_amount,amount_paid,balance_due,due_date,client:clients(id,company_name)")
        .in("status", ["issued", "sent", "overdue", "partially_paid"])
        .order("due_date", { ascending: true })
        .limit(100);
      
      if (error) throw new Error("Unable to retrieve outstanding receivables.");
      
      const totalOutstanding = (unpaidInvoices ?? []).reduce((sum, inv) => 
        sum + Number(inv.balance_due ?? Math.max(0, Number(inv.total_amount) - Number(inv.amount_paid ?? 0))), 0);
      
      const overdue = (unpaidInvoices ?? []).filter(inv => 
        new Date(inv.due_date) < new Date()).length;
      
      const records: CopilotRecord[] = (unpaidInvoices ?? []).slice(0, 10).map(inv => {
        const balance = Number(inv.balance_due ?? Math.max(0, Number(inv.total_amount) - Number(inv.amount_paid ?? 0)));
        const isOverdue = new Date(inv.due_date) < new Date();
        return record(
          "invoice",
          inv.id,
          `${inv.invoice_number} ${isOverdue ? "⚠️ OVERDUE" : ""}`,
          `/invoices/${inv.id}`,
          `${(inv.client as any)?.company_name ?? "Client"} · ₹${Math.round(balance).toLocaleString('en-IN')} · Due: ${inv.due_date}`
        );
      });
      
      return {
        facts: {
          totalOutstanding: Math.round(totalOutstanding * 100) / 100,
          unpaidCount: (unpaidInvoices ?? []).length,
          overdueCount: overdue,
          summary: `Total outstanding: ₹${Math.round(totalOutstanding).toLocaleString('en-IN')} across ${(unpaidInvoices ?? []).length} invoices (${overdue} overdue)`,
          invoices: records.map(r => r.detail)
        },
        records
      };
    }
    
    case "expense_analysis": {
      const monthStart = `${today.slice(0, 7)}-01`;
      const monthEnd = startOfNextMonth(today);
      const { data: expenses, error } = await client
        .from("expenses")
        .select("id,expense_date,total_amount,category,approval_status,description")
        .gte("expense_date", `${monthStart}T00:00:00.000Z`)
        .lt("expense_date", `${monthEnd}T00:00:00.000Z`)
        .limit(500);
      
      if (error) throw new Error("Unable to retrieve expense records.");
      
      const totalExpenses = (expenses ?? []).reduce((sum, exp) => sum + Number(exp.total_amount), 0);
      const approvedExpenses = (expenses ?? [])
        .filter(exp => ["approved", "paid"].includes(exp.approval_status ?? ""))
        .reduce((sum, exp) => sum + Number(exp.total_amount), 0);
      
      const byCategory = new Map<string, number>();
      (expenses ?? []).forEach(exp => {
        const cat = String(exp.category ?? "other");
        byCategory.set(cat, (byCategory.get(cat) ?? 0) + Number(exp.total_amount));
      });
      
      return {
        facts: {
          month: today.slice(0, 7),
          totalExpenses: Math.round(totalExpenses * 100) / 100,
          approvedExpenses: Math.round(approvedExpenses * 100) / 100,
          pendingApproval: Math.round((totalExpenses - approvedExpenses) * 100) / 100,
          expenseCount: (expenses ?? []).length,
          byCategory: Array.from(byCategory.entries()).map(([category, amount]) => ({
            category,
            amount: Math.round(amount * 100) / 100,
            percentage: Math.round((amount / totalExpenses) * 100)
          })),
          summary: `Total expenses: ₹${Math.round(totalExpenses).toLocaleString('en-IN')}, Approved: ₹${Math.round(approvedExpenses).toLocaleString('en-IN')}`
        },
        records: []
      };
    }
    
    case "payment_collection_status": {
      const { data: invoices, error } = await client
        .from("invoices")
        .select("id,total_amount,amount_paid,payment_status")
        .not("payment_status", "eq", "cancelled")
        .limit(500);
      
      if (error) throw new Error("Unable to retrieve payment collection status.");
      
      const totalInvoiced = (invoices ?? []).reduce((sum, inv) => sum + Number(inv.total_amount), 0);
      const totalCollected = (invoices ?? []).reduce((sum, inv) => sum + Number(inv.amount_paid ?? 0), 0);
      const collectionRate = totalInvoiced > 0 ? (totalCollected / totalInvoiced) * 100 : 0;
      
      const byStatus = new Map<string, { count: number; amount: number }>();
      (invoices ?? []).forEach(inv => {
        const status = String(inv.payment_status ?? "unknown");
        if (!byStatus.has(status)) {
          byStatus.set(status, { count: 0, amount: 0 });
        }
        const existing = byStatus.get(status)!;
        existing.count++;
        existing.amount += Number(inv.total_amount);
      });
      
      return {
        facts: {
          totalInvoiced: Math.round(totalInvoiced * 100) / 100,
          totalCollected: Math.round(totalCollected * 100) / 100,
          outstanding: Math.round((totalInvoiced - totalCollected) * 100) / 100,
          collectionRate: Math.round(collectionRate * 100) / 100,
          invoiceCount: (invoices ?? []).length,
          byStatus: Array.from(byStatus.entries()).map(([status, data]) => ({
            status,
            count: data.count,
            amount: Math.round(data.amount * 100) / 100
          })),
          summary: `Revenue rate: ${Math.round(collectionRate)}% (₹${Math.round(totalCollected).toLocaleString('en-IN')} of ₹${Math.round(totalInvoiced).toLocaleString('en-IN')})`
        },
        records: []
      };
    }
    
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
