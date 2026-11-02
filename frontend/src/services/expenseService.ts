import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { Expense, ExpenseCreateInput, ExpenseFormData, ExpenseUpdateInput } from "@/types/expense";
import { generateNumber, normalizeText, readDemoRecords, requireSupabase, toNumber, writeDemoRecords } from "@/services/moduleHelpers";
import { settingsService } from "@/services/settingsService";
import { historyService } from "@/services/historyService";
import { assertTransition } from "@/lib/workflowRules";
import type { ExpenseStatus } from "@/types/expense";

const KEY = "business-ops-demo-expenses";

function normalize(data: ExpenseFormData) {
  const amount = toNumber(data.amount);
  const tax_amount = toNumber(data.tax_amount);
  return {
    expense_number: data.expense_number.trim(),
    expense_date: data.expense_date,
    category: data.category,
    vendor_name: normalizeText(data.vendor_name),
    client_id: data.client_id || null,
    project_id: data.project_id || null,
    project_or_reference: normalizeText(data.project_or_reference),
    amount,
    tax_amount,
    total_amount: amount + tax_amount,
    payment_mode: normalizeText(data.payment_mode),
    receipt_file_url: normalizeText(data.receipt_file_url),
    billable_to_client: data.billable_to_client,
    reimbursable: data.reimbursable,
    approval_status: data.approval_status || "pending",
    status: "draft" as const,
    notes: normalizeText(data.notes)
  };
}

export const expenseService = {
  generateExpenseNumber() {
    return settingsService
      .getNumberingPrefix("expense", "EXP")
      .then((prefix) => generateNumber("expenses", "expense_number", KEY, prefix));
  },
  async getExpenses() {
    if (!isSupabaseConfigured) return readDemoRecords<Expense>(KEY).sort((a, b) => b.created_at.localeCompare(a.created_at));
    const { data, error } = await requireSupabase().from("expenses").select("*, clients(*), projects(*)").order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((expense) => ({ ...expense, client: expense.clients, project: expense.projects })) as Expense[];
  },
  async getExpenseById(id: string) {
    if (!isSupabaseConfigured) return readDemoRecords<Expense>(KEY).find((item) => item.id === id) ?? null;
    const { data, error } = await requireSupabase().from("expenses").select("*, clients(*), projects(*)").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? ({ ...data, client: data.clients, project: data.projects } as Expense) : null;
  },
  async createExpense(data: ExpenseCreateInput) {
    const payload = { ...normalize(data), created_by: data.created_by };
    if (!isSupabaseConfigured) {
      const now = new Date().toISOString();
      const record = { id: crypto.randomUUID(), ...payload, description: null, gst_number: null,
        approval_comments: null, approved_by: null, approved_at: null, rejected_at: null,
        paid_at: null, archived_at: null, updated_by: data.created_by,
        created_at: now, updated_at: now } as Expense;
      writeDemoRecords(KEY, [record, ...readDemoRecords<Expense>(KEY)]);
      return record;
    }
    const { data: record, error } = await requireSupabase().from("expenses").insert(payload).select().single();
    if (error) throw error;
    return record as Expense;
  },
  async updateExpense(id: string, data: ExpenseUpdateInput) {
    if (!isSupabaseConfigured) {
      const records = readDemoRecords<Expense>(KEY);
      const updated = records.map((record) => record.id === id ? { ...record, ...data, total_amount: toNumber(data.amount ?? record.amount) + toNumber(data.tax_amount ?? record.tax_amount), updated_at: new Date().toISOString() } as Expense : record);
      writeDemoRecords(KEY, updated);
      return updated.find((record) => record.id === id) ?? null;
    }
    const { data: record, error } = await requireSupabase().from("expenses").update({ ...data, updated_at: new Date().toISOString() }).eq("id", id).select().single();
    if (error) throw error;
    return record as Expense;
  },
  async transitionExpense(id: string, status: ExpenseStatus, userId: string | null, comments = "") {
    const existing = (await this.getExpenses()).find((item) => item.id === id);
    if (!existing) throw new Error("Expense not found.");
    assertTransition("expense", existing.status ?? "draft", status);
    if (["approved", "rejected"].includes(status) && !comments.trim()) throw new Error("Approval comments are required.");
    const now = new Date().toISOString();
    const changes = { status, approval_status: status, approval_comments: comments.trim() || null,
      ...(status === "approved" ? { approved_by: userId, approved_at: now } : {}),
      ...(status === "rejected" ? { rejected_at: now } : {}), ...(status === "paid" ? { paid_at: now } : {}),
      updated_by: userId, updated_at: now };
    if (!isSupabaseConfigured) writeDemoRecords(KEY, readDemoRecords<Expense>(KEY).map((item) => item.id === id ? { ...item, ...changes } : item));
    else { const { error } = await requireSupabase().from("expenses").update(changes).eq("id", id).eq("status", existing.status ?? "draft"); if (error) throw error; }
    await historyService.record({ entity_type: "expense", entity_id: id, event_type: "status_changed",
      previous_value: { status: existing.status ?? "draft" }, new_value: { status }, description: `Expense moved to ${status}${comments ? `: ${comments}` : ""}`,
      actor_id: userId, metadata: { project_id: existing.project_id, client_id: existing.client_id } });
  },
  async deleteExpense(id: string) {
    if (!isSupabaseConfigured) {
      writeDemoRecords(KEY, readDemoRecords<Expense>(KEY).filter((record) => record.id !== id));
      return;
    }
    const { error } = await requireSupabase().from("expenses").delete().eq("id", id);
    if (error) throw error;
  },
  async uploadReceipt(file: File) {
    const allowed = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
    if (!allowed.includes(file.type)) throw new Error("Receipt must be a PDF, PNG, JPG, or WebP file.");
    if (!file.size || file.size > 10 * 1024 * 1024) throw new Error("Receipt must be between 1 byte and 10 MB.");
    if (!isSupabaseConfigured) {
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
    const path = `receipts/${new Date().getUTCFullYear()}/${crypto.randomUUID()}-${safeName}`;
    const { error } = await requireSupabase().storage.from("expense-receipts").upload(path, file, { upsert: false, contentType: file.type });
    if (error) throw error;
    return path;
  },
  async getReceiptUrl(path: string) {
    if (!isSupabaseConfigured || /^https?:|^data:/.test(path)) return path;
    const { data, error } = await requireSupabase().storage.from("expense-receipts").createSignedUrl(path, 15 * 60);
    if (error) throw error;
    return data.signedUrl;
  }
};
