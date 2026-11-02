import { calculateProfitability, calculateOutstanding } from "@/lib/businessCalculations";
import { contractService } from "@/services/contractService";
import { expenseService } from "@/services/expenseService";
import { invoiceService } from "@/services/invoiceService";
import { milestoneService } from "@/services/milestoneService";
import { quotationService } from "@/services/quotationService";

export const project360Service = {
  async load(projectId: string) {
    const [quotations, contracts, invoices, expenses, milestones] = await Promise.all([
      quotationService.getQuotations(), contractService.getContracts(), invoiceService.getInvoices(),
      expenseService.getExpenses(), milestoneService.listByProject(projectId)
    ]);
    const q = quotations.filter((item) => item.project_id === projectId);
    const c = contracts.filter((item) => item.project_id === projectId);
    const i = invoices.filter((item) => item.project_id === projectId);
    const e = expenses.filter((item) => item.project_id === projectId);
    const quoted = q.filter((item) => item.status === "accepted").reduce((sum, item) => sum + Number(item.total_amount), 0);
    const contracted = c.filter((item) => !["terminated", "archived"].includes(item.status)).reduce((sum, item) => sum + Number(item.contract_value), 0);
    const invoiced = i.filter((item) => !["draft", "cancelled"].includes(item.status)).reduce((sum, item) => sum + Number(item.total_amount), 0);
    const collected = i.reduce((sum, item) => sum + Number(item.amount_paid), 0);
    const outstanding = i.reduce((sum, item) => sum + calculateOutstanding({ invoiceTotal: Number(item.total_amount),
      validPayments: Number(item.amount_paid), withholding: Number(item.tds_amount ?? 0), appliedCredits: Number(item.credit_applied ?? 0) }), 0);
    const approvedExpenses = e.filter((item) => item.status === "approved" || item.status === "paid" || item.approval_status === "approved")
      .reduce((sum, item) => sum + Number(item.total_amount), 0);
    const completed = milestones.filter((item) => ["accepted", "invoiced"].includes(item.status)).length;
    return { quotations: q, contracts: c, invoices: i, expenses: e, milestones,
      summary: { quoted, contracted, invoiced, collected, outstanding, approvedExpenses,
        ...calculateProfitability({ revenue: invoiced, approvedExpenses }),
        collectionPercentage: invoiced > 0 ? Math.round(collected / invoiced * 10000) / 100 : 0,
        milestoneCompletion: milestones.length > 0 ? Math.round(completed / milestones.length * 10000) / 100 : 0 } };
  }
};

