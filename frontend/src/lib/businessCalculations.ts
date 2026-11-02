export type TaxMode = "cgst_sgst" | "igst" | "none";

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateTaxableAmount(subtotal: number, discount: number) {
  return roundMoney(Math.max(subtotal - discount, 0));
}

export function calculateTax(
  taxableAmount: number,
  rate: number,
  mode: TaxMode
) {
  const totalTax = mode === "none"
    ? 0
    : roundMoney(taxableAmount * Math.max(rate, 0) / 100);

  if (mode === "cgst_sgst") {
    const cgst = roundMoney(totalTax / 2);
    return { cgst, sgst: roundMoney(totalTax - cgst), igst: 0, totalTax };
  }

  return { cgst: 0, sgst: 0, igst: totalTax, totalTax };
}

export type CommercialLineInput = { description:string; quantity:number; unitPrice:number; discountRate:number; taxRate:number };
export function calculateCommercialLines(lines:CommercialLineInput[],documentDiscount=0,rounding=0){
  const calculated=lines.map(line=>{if(!line.description.trim())throw new Error("Line description is required.");if(line.quantity<=0||line.unitPrice<0||line.discountRate<0||line.discountRate>100||line.taxRate<0)throw new Error("Invoice line values are invalid.");const gross=roundMoney(line.quantity*line.unitPrice);const discountAmount=roundMoney(gross*line.discountRate/100);const taxableAmount=calculateTaxableAmount(gross,discountAmount);const taxAmount=calculateTax(taxableAmount,line.taxRate,"igst").totalTax;return{...line,gross,discountAmount,taxableAmount,taxAmount,lineTotal:roundMoney(taxableAmount+taxAmount)};});
  const subtotal=roundMoney(calculated.reduce((s,l)=>s+l.taxableAmount,0));const discountAmount=roundMoney(Math.max(documentDiscount,0));const taxable=calculateTaxableAmount(subtotal,discountAmount);const taxAmount=roundMoney(calculated.reduce((s,l)=>s+l.taxAmount,0));const total=roundMoney(taxable+taxAmount+rounding);if(total<0)throw new Error("Invoice total cannot be negative.");return{lines:calculated,subtotal,discountAmount,taxAmount,roundingAmount:roundMoney(rounding),totalAmount:total};
}

export function calculateOutstanding(input: {
  invoiceTotal: number;
  validPayments: number;
  withholding: number;
  appliedCredits: number;
}) {
  return roundMoney(Math.max(
    input.invoiceTotal - input.validPayments - input.withholding - input.appliedCredits,
    0
  ));
}

export function calculateProfitability(input: {
  revenue: number;
  approvedExpenses: number;
}) {
  const grossMargin = roundMoney(input.revenue - input.approvedExpenses);
  const grossMarginPercentage = input.revenue > 0
    ? roundMoney(grossMargin / input.revenue * 100)
    : 0;
  return { grossMargin, grossMarginPercentage };
}

export function calculateMaintenanceHours(includedHours: number, eligibleTimeHours: number) {
  const consumedHours = roundMoney(Math.max(eligibleTimeHours, 0));
  return {
    consumedHours,
    remainingHours: roundMoney(Math.max(includedHours - consumedHours, 0))
  };
}

export function calculateSlaDeadline(startedAt: string | Date, hours: number) {
  const start = new Date(startedAt);
  if (Number.isNaN(start.getTime())) throw new Error("A valid SLA start time is required.");
  return new Date(start.getTime() + Math.max(hours, 0) * 60 * 60 * 1000).toISOString();
}
