import { describe, expect, it } from "vitest";
import { allocatePayment, assertQuotationEditable, invoiceBasedProfitability,
  invoiceStatusFromBalance, milestoneInvoiceEligibility, nextContractVersion,
  nextRevision, projectClosureReadiness } from "./commercialRules";

describe("commercial lifecycle rules", () => {
  it("locks accepted quotations and creates sequential revisions", () => {
    expect(() => assertQuotationEditable("accepted")).toThrow(/Only draft/);
    expect(nextRevision({ revision_number: 2, status: "sent" })).toBe(3);
    expect(() => nextRevision({ revision_number: 1, status: "accepted" })).toThrow(/immutable/);
  });
  it("allocates partial, final, TDS and credit-adjusted payments without overpayment", () => {
    expect(allocatePayment({ invoiceTotal: 1000, paid: 0, withholding: 0, credits: 0, amount: 400 })).toEqual({ outstanding: 600, status: "partially_paid" });
    expect(allocatePayment({ invoiceTotal: 1000, paid: 400, withholding: 100, credits: 100, amount: 400 })).toEqual({ outstanding: 0, status: "paid" });
    expect(() => allocatePayment({ invoiceTotal: 1000, paid: 900, withholding: 0, credits: 0, amount: 101 })).toThrow(/exceeds/);
  });
  it("derives overdue and paid status from balance", () => {
    expect(invoiceStatusFromBalance({ currentStatus: "issued", total: 100, outstanding: 100, dueDate: "2026-01-01", now: "2026-02-01" })).toBe("overdue");
    expect(invoiceStatusFromBalance({ currentStatus: "issued", total: 100, outstanding: 0 })).toBe("paid");
  });
  it("prevents duplicate and premature milestone invoicing", () => {
    expect(() => milestoneInvoiceEligibility({ status: "accepted", invoice_id: "invoice", billingAmount: 10, availableValue: 100 })).toThrow(/already/);
    expect(() => milestoneInvoiceEligibility({ status: "in_progress", invoice_id: null, billingAmount: 10, availableValue: 100 })).toThrow(/accepted/);
    expect(() => milestoneInvoiceEligibility({ status: "accepted", invoice_id: null, billingAmount: 101, availableValue: 100 })).toThrow(/exceeds/);
  });
  it("increments contract versions and aggregates invoice-based margin", () => {
    expect(nextContractVersion([{ version_number: 1 }, { version_number: 3 }])).toBe(4);
    expect(invoiceBasedProfitability([{ invoiced: 1000, approvedExpenses: 200 }, { invoiced: 500, approvedExpenses: 100 }]))
      .toEqual({ invoiced: 1500, approvedExpenses: 300, grossMargin: 1200, grossMarginPercentage: 80 });
    expect(invoiceBasedProfitability([{ invoiced: 0, approvedExpenses: 10 }]).grossMarginPercentage).toBe(0);
  });
  it("reports every closure blocker", () => {
    const result = projectClosureReadiness({ incompleteMilestones: 1, deliverablesAccepted: false,
      finalInvoiceRaisedOrWaived: false, unprocessedReimbursableExpenses: 1,
      requiredDocumentsAttached: false, clientAcceptanceRecorded: false, closureNotes: "" });
    expect(result.ready).toBe(false); expect(result.blockers).toHaveLength(7);
  });
});
