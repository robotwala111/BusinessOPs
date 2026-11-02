import { isSupabaseConfigured } from "@/lib/supabase/client";
import { historyService } from "@/services/historyService";
import {
  readDemoRecords,
  requireSupabase,
  writeDemoRecords,
} from "@/services/moduleHelpers";
import { settingsService } from "@/services/settingsService";
import { generateNumber } from "@/services/moduleHelpers";
import type { FinancialNote, FinancialNoteType } from "@/types/financialNote";
import { calculateFinancialNote } from "@/lib/financialNoteRules";
const KEY = "business-ops-demo-financial-notes";
export const financialNoteService = {
  async list(invoiceId: string) {
    if (!isSupabaseConfigured)
      return readDemoRecords<FinancialNote>(KEY).filter(
        (n) => n.invoice_id === invoiceId,
      );
    const { data, error } = await requireSupabase()
      .from("financial_notes")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("created_at");
    if (error) throw error;
    return (data ?? []) as FinancialNote[];
  },
  async create(input: {
    invoiceId: string;
    type: FinancialNoteType;
    reason: string;
    baseAmount: number;
    taxRate: number;
    eligibleBalance: number;
    overrideReason?: string;
    userId: string | null;
  }) {
    if (!input.reason.trim()) throw new Error("Reason is required.");
    const calculation = calculateFinancialNote(input.baseAmount, input.taxRate);
    const tax = calculation.taxAmount;
    const total = calculation.totalAmount;
    if (
      input.type === "credit_note" &&
      total > input.eligibleBalance &&
      !input.overrideReason?.trim()
    )
      throw new Error(
        "Credit exceeds eligible balance; an override reason is required.",
      );
    const prefix = input.type === "credit_note" ? "CRN" : "DBN";
    const number = await settingsService
      .getNumberingPrefix(input.type, prefix)
      .then((p) =>
        generateNumber("financial_notes", "note_number", KEY, p, input.type),
      );
    const now = new Date().toISOString();
    const record = {
      id: crypto.randomUUID(),
      note_number: number,
      note_type: input.type,
      invoice_id: input.invoiceId,
      note_date: now.slice(0, 10),
      reason: input.reason.trim(),
      status: "draft",
      base_amount: input.baseAmount,
      tax_rate: input.taxRate,
      tax_amount: tax,
      total_amount: total,
      override_reason: input.overrideReason?.trim() || null,
      approved_at: null,
      issued_at: null,
      cancelled_at: null,
      cancellation_reason: null,
      created_by: input.userId,
      updated_by: input.userId,
      created_at: now,
      updated_at: now,
    } as FinancialNote;
    if (!isSupabaseConfigured) {
      writeDemoRecords(KEY, [record, ...readDemoRecords<FinancialNote>(KEY)]);
      return record;
    }
    const { data, error } = await requireSupabase()
      .from("financial_notes")
      .insert({ ...record, id: undefined })
      .select()
      .single();
    if (error) throw error;
    return data as FinancialNote;
  },
  async transition(
    note: FinancialNote,
    status: FinancialNote["status"],
    userId: string | null,
    reason = "",
  ) {
    if (status === "approved" && note.status !== "draft") throw new Error("Only draft notes may be approved.");
    if (status === "issued" && note.status !== "approved") throw new Error("Only approved notes may be issued.");
    if (note.status === "cancelled") throw new Error("Cancelled notes are immutable.");
    if (status === "cancelled" && !reason.trim())
      throw new Error("Cancellation reason is required.");
    const now = new Date().toISOString();
    const changes = {
      status,
      updated_by: userId,
      ...(status === "approved" ? { approved_at: now } : {}),
      ...(status === "issued" ? { issued_at: now } : {}),
      ...(status === "cancelled"
        ? { cancelled_at: now, cancellation_reason: reason.trim() }
        : {}),
      updated_at: now,
    };
    if (!isSupabaseConfigured)
      writeDemoRecords(
        KEY,
        readDemoRecords<FinancialNote>(KEY).map((n) =>
          n.id === note.id ? { ...n, ...changes } : n,
        ),
      );
    else {
      const { error } = await requireSupabase().rpc("transition_financial_note", { p_note_id: note.id, p_status: status, p_reason: reason });
      if (error) throw error;
      return;
    }
    await historyService.record({
      entity_type: "invoice",
      entity_id: note.invoice_id,
      event_type: "financial_note_status",
      previous_value: { status: note.status },
      new_value: { status },
      description: `${note.note_type} ${note.note_number} moved to ${status}`,
      actor_id: userId,
      metadata: { note_id: note.id },
    });
  },
};
