import { describe, expect, it } from "vitest";
import { calculateFinancialNote, correctedBalance, financialNoteTransitions } from "./financialNoteRules";

describe("financial note rules", () => {
  it("calculates deterministic taxable adjustment totals", () => {
    expect(calculateFinancialNote(1000, 18)).toEqual({ baseAmount: 1000, taxAmount: 180, totalAmount: 1180 });
  });
  it("rejects invalid adjustment values", () => {
    expect(() => calculateFinancialNote(0, 18)).toThrow();
    expect(() => calculateFinancialNote(100, 101)).toThrow();
  });
  it("preserves the approval and issue lifecycle", () => {
    expect(financialNoteTransitions("draft")).toEqual(["approved", "cancelled"]);
    expect(financialNoteTransitions("approved")).toEqual(["issued", "cancelled"]);
    expect(financialNoteTransitions("issued")).toEqual(["cancelled"]);
  });
  it("applies debits and credits without producing negative balances", () => {
    expect(correctedBalance({ invoiceTotal: 10000, debitTotal: 500, paid: 4000, withheld: 500, creditTotal: 1000 })).toBe(5000);
    expect(correctedBalance({ invoiceTotal: 1000, debitTotal: 0, paid: 900, withheld: 100, creditTotal: 500 })).toBe(0);
  });
});
