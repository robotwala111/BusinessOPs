import { calculateOutstanding, roundMoney } from "./businessCalculations";

export function isQuotationEditable(status: string) { return status === "draft"; }
export function nextContractVersion(versions: Array<{ version_number: number }>) {
  return Math.max(0, ...versions.map((item) => item.version_number)) + 1;
}
export function invoiceBasedProfitability(records: Array<{ invoiced: number; approvedExpenses: number }>) {
  const invoiced = roundMoney(records.reduce((sum, item) => sum + item.invoiced, 0));
  const approvedExpenses = roundMoney(records.reduce((sum, item) => sum + item.approvedExpenses, 0));
  const grossMargin = roundMoney(invoiced - approvedExpenses);
  return { invoiced, approvedExpenses, grossMargin,
    grossMarginPercentage: invoiced > 0 ? roundMoney(grossMargin / invoiced * 100) : 0 };
}
export function assertQuotationEditable(status: string) {
  if (!isQuotationEditable(status)) throw new Error("Only draft quotations may be edited. Create a revision instead.");
}
export function nextRevision(current: { revision_number: number; status: string }) {
  if (current.status === "accepted") throw new Error("Accepted quotations are commercially immutable.");
  if (!['approved', 'sent', 'rejected', 'expired'].includes(current.status)) throw new Error("Only approved or issued quotations may be revised.");
  return current.revision_number + 1;
}
export function milestoneInvoiceEligibility(input: { status: string; invoice_id: string | null; billingAmount: number; availableValue: number; overrideReason?: string }) {
  if (input.invoice_id) throw new Error("This milestone already has an invoice.");
  if (input.status !== "accepted" && !input.overrideReason?.trim()) throw new Error("Only accepted milestones may be invoiced without an override reason.");
  if (input.billingAmount <= 0) throw new Error("A positive billing amount is required.");
  if (input.billingAmount > input.availableValue && !input.overrideReason?.trim()) throw new Error("Milestone billing exceeds the remaining commercial value.");
  return true;
}
export function allocatePayment(input: { invoiceTotal: number; paid: number; withholding: number; credits: number; amount: number; paymentWithholding?: number }) {
  if (input.amount <= 0) throw new Error("Payment amount must be greater than zero.");
  const before = calculateOutstanding({ invoiceTotal: input.invoiceTotal, validPayments: input.paid,
    withholding: input.withholding, appliedCredits: input.credits });
  const applied = roundMoney(input.amount + (input.paymentWithholding ?? 0));
  if (applied > before) throw new Error("Payment allocation exceeds the outstanding balance.");
  const outstanding = roundMoney(before - applied);
  return { outstanding, status: outstanding === 0 ? "paid" as const : "partially_paid" as const };
}
export function invoiceStatusFromBalance(input: { currentStatus: string; total: number; outstanding: number; dueDate?: string | null; now?: string }) {
  if (["draft", "cancelled", "written_off"].includes(input.currentStatus)) return input.currentStatus;
  if (input.outstanding <= 0 && input.total > 0) return "paid";
  if (input.outstanding < input.total) return "partially_paid";
  if (input.dueDate && new Date(input.dueDate) < new Date(input.now ?? Date.now())) return "overdue";
  return input.currentStatus;
}
export function projectClosureReadiness(input: { incompleteMilestones: number; deliverablesAccepted: boolean; finalInvoiceRaisedOrWaived: boolean; unprocessedReimbursableExpenses: number; requiredDocumentsAttached: boolean; clientAcceptanceRecorded: boolean; closureNotes: string }) {
  const blockers: string[] = [];
  if (input.incompleteMilestones > 0) blockers.push("Required milestones remain incomplete.");
  if (!input.deliverablesAccepted) blockers.push("Deliverables have not been accepted.");
  if (!input.finalInvoiceRaisedOrWaived) blockers.push("Final invoice has not been raised or waived.");
  if (input.unprocessedReimbursableExpenses > 0) blockers.push("Reimbursable expenses remain unprocessed.");
  if (!input.requiredDocumentsAttached) blockers.push("Required closure documents are missing.");
  if (!input.clientAcceptanceRecorded) blockers.push("Client acceptance has not been recorded.");
  if (!input.closureNotes.trim()) blockers.push("Closure notes are required.");
  return { ready: blockers.length === 0, blockers };
}
