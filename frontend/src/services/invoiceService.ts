import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { Invoice, InvoiceCreateInput, InvoiceFormData, InvoiceUpdateInput } from "@/types/invoice";
import { generateNumber, normalizeText, readDemoRecords, requireSupabase, toNumber, writeDemoRecords } from "@/services/moduleHelpers";
import { settingsService } from "@/services/settingsService";
import { historyService } from "@/services/historyService";
import { assertTransition } from "@/lib/workflowRules";

const KEY = "business-ops-demo-invoices";

export function calculateInvoiceTotals(data: Pick<InvoiceFormData, "subtotal" | "discount_amount" | "tax_percentage">, amountPaid = 0) {
  const subtotal = toNumber(data.subtotal);
  const discount_amount = toNumber(data.discount_amount);
  const taxable = Math.max(subtotal - discount_amount, 0);
  const tax_amount = taxable * (toNumber(data.tax_percentage) / 100);
  const total_amount = taxable + tax_amount;
  const balance_due = Math.max(total_amount - amountPaid, 0);
  return { subtotal, discount_amount, tax_amount, total_amount, amount_paid: amountPaid, balance_due };
}

function statusFromBalance(status: Invoice["status"], total: number, paid: number, dueDate?: string | null): Invoice["status"] {
  if (status === "cancelled" || status === "draft") return status;
  if (paid >= total && total > 0) return "paid";
  if (paid > 0) return "partially_paid";
  if (dueDate && new Date(dueDate) < new Date()) return "overdue";
  return status === "paid" ? "issued" : status;
}

function normalize(data: InvoiceFormData, paid = 0) {
  const totals = calculateInvoiceTotals(data, paid);
  return {
    invoice_number: data.invoice_number.trim(),
    client_id: data.client_id,
    project_id: data.project_id || null,
    quotation_id: data.quotation_id || null,
    contract_id: data.contract_id || null,
    milestone_id: data.milestone_id || null,
    invoice_date: data.invoice_date,
    due_date: data.due_date || null,
    status: statusFromBalance(data.status, totals.total_amount, paid, data.due_date),
    tax_percentage: toNumber(data.tax_percentage),
    notes: normalizeText(data.notes),
    ...totals
  };
}

export const invoiceService = {
  generateInvoiceNumber() {
    return settingsService
      .getNumberingPrefix("invoice", "INV")
      .then((prefix) => generateNumber("invoices", "invoice_number", KEY, prefix));
  },
  async getInvoices() {
    if (!isSupabaseConfigured) return readDemoRecords<Invoice>(KEY).sort((a, b) => b.created_at.localeCompare(a.created_at));
    const { data, error } = await requireSupabase().from("invoices").select("*, clients(*), payments(*)").order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((invoice) => ({ ...invoice, client: invoice.clients, payments: invoice.payments ?? [] })) as Invoice[];
  },
  async getInvoiceById(id: string) {
    if (!isSupabaseConfigured) return readDemoRecords<Invoice>(KEY).find((item) => item.id === id) ?? null;
    const { data, error } = await requireSupabase().from("invoices").select("*, clients(*), payments(*), invoice_items(*)").eq("id", id).single();
    if (error) throw error;
    return { ...data, client: data.clients, payments: data.payments ?? [], items: data.invoice_items ?? [] } as Invoice;
  },
  async createInvoice(data: InvoiceCreateInput) {
    const payload = { ...normalize(data), created_by: data.created_by };
    if (!isSupabaseConfigured) {
      const now = new Date().toISOString();
      const record = { id: crypto.randomUUID(), ...payload, document_type: "tax_invoice",
        milestone_id: null, issue_date: null, place_of_supply: null, tax_type: null,
        tds_amount: 0, credit_applied: 0, debit_applied: 0, rounding_amount: 0, cancellation_reason: null,
        write_off_reason: null, archived_at: null, updated_by: data.created_by,
        created_at: now, updated_at: now, payments: [] } as Invoice;
      writeDemoRecords(KEY, [record, ...readDemoRecords<Invoice>(KEY)]);
      return record;
    }
    const { data: record, error } = await requireSupabase().from("invoices").insert(payload).select().single();
    if (error) throw error;
    return record as Invoice;
  },
  async updateInvoice(id: string, data: InvoiceUpdateInput) {
    const existing = await this.getInvoiceById(id);
    if (!existing) throw new Error("Invoice not found.");
    if (existing.status !== "draft") throw new Error("Only draft invoices may be edited. Use a correction document or lifecycle action.");
    if (!isSupabaseConfigured) {
      const records = readDemoRecords<Invoice>(KEY);
      const updated = records.map((record) => record.id === id ? { ...record, ...data, ...calculateInvoiceTotals({ subtotal: data.subtotal ?? record.subtotal, discount_amount: data.discount_amount ?? record.discount_amount, tax_percentage: data.tax_percentage ?? record.tax_percentage }, record.amount_paid), updated_at: new Date().toISOString() } as Invoice : record);
      writeDemoRecords(KEY, updated);
      return updated.find((record) => record.id === id) ?? null;
    }
    const { data: record, error } = await requireSupabase().from("invoices").update({ ...data, updated_at: new Date().toISOString() }).eq("id", id).select().single();
    if (error) throw error;
    return record as Invoice;
  },
  async transitionInvoice(id: string, status: Invoice["status"], userId: string | null, reason = "") {
    const existing = await this.getInvoiceById(id);
    if (!existing) throw new Error("Invoice not found.");
    assertTransition("invoice", existing.status, status);
    if (["cancelled", "written_off"].includes(status) && !reason.trim()) throw new Error("A reason is required.");
    const now = new Date().toISOString();
    const changes = { status, updated_by: userId,
      ...(status === "issued" ? { issue_date: now, sent_at: now } : {}),
      ...(status === "cancelled" ? { cancellation_reason: reason.trim() } : {}),
      ...(status === "written_off" ? { write_off_reason: reason.trim() } : {}) };
    let result: Invoice;
    if (!isSupabaseConfigured) { result = { ...existing, ...changes, updated_at: now }; writeDemoRecords(KEY, readDemoRecords<Invoice>(KEY).map((item) => item.id === id ? result : item)); }
    else { const { data, error } = await requireSupabase().from("invoices").update(changes).eq("id", id).eq("status", existing.status).select().single(); if (error) throw error; result = { ...existing, ...data } as Invoice; }
    await historyService.record({ entity_type: "invoice", entity_id: id, event_type: "status_changed",
      previous_value: { status: existing.status }, new_value: { status }, description: `Invoice moved from ${existing.status} to ${status}${reason ? `: ${reason}` : ""}`,
      actor_id: userId, metadata: {} });
    return result;
  },
  async deleteInvoice(id: string) {
    if (!isSupabaseConfigured) {
      writeDemoRecords(KEY, readDemoRecords<Invoice>(KEY).filter((record) => record.id !== id));
      return;
    }
    const { error } = await requireSupabase().from("invoices").delete().eq("id", id);
    if (error) throw error;
  }
};
