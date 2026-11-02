import { isSupabaseConfigured } from "@/lib/supabase/client";
import { calculateInvoiceTotals } from "@/services/invoiceService";
import {
  readDemoRecords,
  requireSupabase,
  toNumber,
  writeDemoRecords,
} from "@/services/moduleHelpers";
import type { Invoice, Payment, PaymentCreateInput } from "@/types/invoice";
import { allocatePayment } from "@/lib/commercialRules";
import { historyService } from "@/services/historyService";

const INVOICE_KEY = "business-ops-demo-invoices";
const PAYMENT_KEY = "business-ops-demo-payments";

export const paymentService = {
  async uploadEvidence(file: File) {
    const allowed = [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/webp",
    ];
    if (!allowed.includes(file.type))
      throw new Error(
        "Payment evidence must be a PDF, PNG, JPG, or WebP file.",
      );
    if (!file.size || file.size > 10 * 1024 * 1024)
      throw new Error("Payment evidence must be between 1 byte and 10 MB.");
    if (!isSupabaseConfigured) {
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
    const path = `evidence/${new Date().getUTCFullYear()}/${crypto.randomUUID()}-${safeName}`;
    const { error } = await requireSupabase()
      .storage.from("payment-evidence")
      .upload(path, file, { upsert: false, contentType: file.type });
    if (error) throw error;
    return path;
  },
  async getEvidenceUrl(path: string) {
    if (!isSupabaseConfigured || /^https?:|^data:/.test(path)) return path;
    const { data, error } = await requireSupabase()
      .storage.from("payment-evidence")
      .createSignedUrl(path, 15 * 60);
    if (error) throw error;
    return data.signedUrl;
  },
  async addPayment(data: PaymentCreateInput) {
    const payload = {
      invoice_id: data.invoice_id,
      payment_date: data.payment_date,
      amount: toNumber(data.amount),
      payment_mode: data.payment_mode || null,
      transaction_reference: data.transaction_reference || null,
      bank_reference: data.bank_reference || null,
      withholding_amount: toNumber(data.withholding_amount),
      adjustment_amount: toNumber(data.adjustment_amount),
      evidence_path: data.evidence_path || null,
      reversed_at: null,
      reversal_reason: null,
      reversed_by: null,
      notes: data.notes || null,
      created_by: data.created_by,
    };
    if (isSupabaseConfigured) {
      const { data: invoice, error: invoiceError } = await requireSupabase()
        .from("invoices")
        .select("total_amount, amount_paid, tds_amount, credit_applied")
        .eq("id", data.invoice_id)
        .single();
      if (invoiceError) throw invoiceError;
      allocatePayment({
        invoiceTotal: Number(invoice.total_amount),
        paid: Number(invoice.amount_paid),
        withholding: Number(invoice.tds_amount ?? 0),
        credits: Number(invoice.credit_applied ?? 0),
        amount: payload.amount + payload.adjustment_amount,
        paymentWithholding: payload.withholding_amount,
      });
    }
    if (!isSupabaseConfigured) {
      const target = readDemoRecords<Invoice>(INVOICE_KEY).find(
        (item) => item.id === data.invoice_id,
      );
      if (!target) throw new Error("Invoice not found.");
      allocatePayment({
        invoiceTotal: target.total_amount,
        paid: target.amount_paid,
        withholding: target.tds_amount ?? 0,
        credits: target.credit_applied ?? 0,
        amount: payload.amount + payload.adjustment_amount,
        paymentWithholding: payload.withholding_amount,
      });
      const payment = {
        id: crypto.randomUUID(),
        ...payload,
        created_at: new Date().toISOString(),
      } as Payment;
      writeDemoRecords(PAYMENT_KEY, [
        payment,
        ...readDemoRecords<Payment>(PAYMENT_KEY),
      ]);
      const invoices = readDemoRecords<Invoice>(INVOICE_KEY);
      const updated = invoices.map((invoice) => {
        if (invoice.id !== data.invoice_id) return invoice;
        const paid =
          invoice.amount_paid + payment.amount + payment.adjustment_amount;
        const totals = calculateInvoiceTotals(invoice, paid);
        const balance = Math.max(
          invoice.total_amount -
            paid -
            (invoice.tds_amount ?? 0) -
            payment.withholding_amount -
            (invoice.credit_applied ?? 0),
          0,
        );
        return {
          ...invoice,
          ...totals,
          tds_amount: (invoice.tds_amount ?? 0) + payment.withholding_amount,
          balance_due: balance,
          status: balance <= 0 ? "paid" : "partially_paid",
          updated_at: new Date().toISOString(),
        } as Invoice;
      });
      writeDemoRecords(INVOICE_KEY, updated);
      await historyService.record({
        entity_type: "payment",
        entity_id: payment.id,
        event_type: "payment_recorded",
        previous_value: null,
        new_value: { amount: payment.amount },
        description: "Payment recorded",
        actor_id: data.created_by,
        metadata: { invoice_id: data.invoice_id },
      });
      return payment;
    }
    const { data: payment, error } = await requireSupabase()
      .from("payments")
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    await historyService.record({
      entity_type: "payment",
      entity_id: payment.id,
      event_type: "payment_recorded",
      previous_value: null,
      new_value: { amount: payment.amount },
      description: "Payment recorded",
      actor_id: data.created_by,
      metadata: { invoice_id: data.invoice_id },
    });
    return payment as Payment;
  },
  async reversePayment(
    payment: Payment,
    reason: string,
    userId: string | null,
  ) {
    if (!reason.trim()) throw new Error("A reversal reason is required.");
    if (payment.reversed_at) throw new Error("Payment is already reversed.");
    const reversedAt = new Date().toISOString();
    if (!isSupabaseConfigured) {
      writeDemoRecords(
        PAYMENT_KEY,
        readDemoRecords<Payment>(PAYMENT_KEY).map((item) =>
          item.id === payment.id
            ? {
                ...item,
                reversed_at: reversedAt,
                reversal_reason: reason.trim(),
                reversed_by: userId,
              }
            : item,
        ),
      );
      const payments = readDemoRecords<Payment>(PAYMENT_KEY).filter(
        (item) =>
          item.invoice_id === payment.invoice_id &&
          item.id !== payment.id &&
          !item.reversed_at,
      );
      writeDemoRecords(
        INVOICE_KEY,
        readDemoRecords<Invoice>(INVOICE_KEY).map((invoice) => {
          if (invoice.id !== payment.invoice_id) return invoice;
          const paid = payments.reduce(
            (sum, item) => sum + item.amount + item.adjustment_amount,
            0,
          );
          const withheld = payments.reduce(
            (sum, item) => sum + item.withholding_amount,
            0,
          );
          const balance = Math.max(
            invoice.total_amount - paid - withheld - invoice.credit_applied,
            0,
          );
          return {
            ...invoice,
            amount_paid: paid,
            tds_amount: withheld,
            balance_due: balance,
            status:
              balance === 0
                ? "paid"
                : paid + withheld > 0
                  ? "partially_paid"
                  : "issued",
            updated_at: reversedAt,
          };
        }),
      );
    } else {
      const { error } = await requireSupabase()
        .from("payments")
        .update({
          reversed_at: reversedAt,
          reversal_reason: reason.trim(),
          reversed_by: userId,
        })
        .eq("id", payment.id)
        .is("reversed_at", null);
      if (error) throw error;
    }
    await historyService.record({
      entity_type: "payment",
      entity_id: payment.id,
      event_type: "payment_reversed",
      previous_value: { reversed_at: null },
      new_value: { reversed_at: reversedAt },
      description: `Payment reversed: ${reason.trim()}`,
      actor_id: userId,
      metadata: { invoice_id: payment.invoice_id },
    });
  },
};
