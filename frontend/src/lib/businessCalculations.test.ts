import { describe, expect, it } from "vitest";
import { calculateMaintenanceHours, calculateOutstanding, calculateProfitability,
  calculateSlaDeadline, calculateTax, calculateTaxableAmount, roundMoney } from "./businessCalculations";

describe("business calculations", () => {
  it("applies discounts and splits GST without losing paise", () => {
    const taxable = calculateTaxableAmount(1000, 100);
    expect(taxable).toBe(900);
    expect(calculateTax(taxable, 18, "cgst_sgst")).toEqual({ cgst: 81, sgst: 81, igst: 0, totalTax: 162 });
    expect(calculateTax(taxable, 18, "igst")).toEqual({ cgst: 0, sgst: 0, igst: 162, totalTax: 162 });
  });

  it("calculates outstanding with payment, withholding and credits", () => {
    expect(calculateOutstanding({ invoiceTotal: 1000, validPayments: 400, withholding: 100, appliedCredits: 50 })).toBe(450);
    expect(calculateOutstanding({ invoiceTotal: 1000, validPayments: 1200, withholding: 0, appliedCredits: 0 })).toBe(0);
  });

  it("calculates profitability, maintenance balances, SLA and rounding", () => {
    expect(calculateProfitability({ revenue: 1250, approvedExpenses: 250 })).toEqual({ grossMargin: 1000, grossMarginPercentage: 80 });
    expect(calculateMaintenanceHours(10, 3.25)).toEqual({ consumedHours: 3.25, remainingHours: 6.75 });
    expect(calculateSlaDeadline("2026-09-02T10:00:00.000Z", 4)).toBe("2026-09-02T14:00:00.000Z");
    expect(roundMoney(1.005)).toBe(1.01);
  });
});

