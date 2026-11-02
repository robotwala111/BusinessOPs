import { roundMoney } from "./businessCalculations";

export function calculateFinancialNote(baseAmount: number, taxRate: number) {
  if (!Number.isFinite(baseAmount) || baseAmount <= 0) throw new Error("Adjustment amount must be greater than zero.");
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) throw new Error("Tax rate must be between 0 and 100.");
  const base = roundMoney(baseAmount);
  const tax = roundMoney(base * taxRate / 100);
  return { baseAmount: base, taxAmount: tax, totalAmount: roundMoney(base + tax) };
}

export function financialNoteTransitions(status: "draft" | "approved" | "issued" | "cancelled") {
  if (status === "draft") return ["approved", "cancelled"] as const;
  if (status === "approved") return ["issued", "cancelled"] as const;
  if (status === "issued") return ["cancelled"] as const;
  return [] as const;
}

export function correctedBalance(input: { invoiceTotal: number; debitTotal: number; paid: number; withheld: number; creditTotal: number }) {
  return roundMoney(Math.max(input.invoiceTotal + input.debitTotal - input.paid - input.withheld - input.creditTotal, 0));
}
