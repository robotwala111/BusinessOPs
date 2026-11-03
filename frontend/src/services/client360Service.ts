import { calculateProfitability, calculateOutstanding } from "@/lib/businessCalculations";
import { contractService } from "@/services/contractService";
import { expenseService } from "@/services/expenseService";
import { invoiceService } from "@/services/invoiceService";
import { maintenanceService } from "@/services/maintenanceService";
import { quotationService } from "@/services/quotationService";

export const client360Service = {
  async load(clientId: string) {
    const [quotations, contracts, invoices, expenses, maintenance, tickets] = await Promise.all([
      quotationService.getQuotations(), contractService.getContracts(), invoiceService.getInvoices(),
      expenseService.getExpenses(), maintenanceService.getMaintenanceContracts(), maintenanceService.getSupportTickets()
    ]);
    const relatedQuotations = quotations.filter((item) => item.client_id === clientId);
    const relatedContracts = contracts.filter((item) => item.client_id === clientId);
    const relatedInvoices = invoices.filter((item) => item.client_id === clientId);
    const relatedExpenses = expenses.filter((item) => item.client_id === clientId);
    const relatedMaintenance = maintenance.filter((item) => item.client_id === clientId);
    const relatedTickets = tickets.filter((item) => item.client_id === clientId);
    const totalQuoted = relatedQuotations.reduce((sum, item) => sum + Number(item.total_amount), 0);
    const acceptedQuoted = relatedQuotations.filter((item) => item.status === "accepted")
      .reduce((sum, item) => sum + Number(item.total_amount), 0);
    const contractValue = relatedContracts.filter((item) => !["terminated", "archived"].includes(item.status))
      .reduce((sum, item) => sum + Number(item.contract_value), 0);
    const totalInvoiced = relatedInvoices.filter((item) => !["draft", "cancelled"].includes(item.status))
      .reduce((sum, item) => sum + Number(item.total_amount), 0);
    const totalCollected = relatedInvoices.reduce((sum, item) => sum + Number(item.amount_paid), 0);
    const outstanding = relatedInvoices.reduce((sum, item) => sum + calculateOutstanding({
      invoiceTotal: Number(item.total_amount), validPayments: Number(item.amount_paid),
      withholding: Number(item.tds_amount ?? 0), appliedCredits: Number(item.credit_applied ?? 0)
    }), 0);
    const approvedExpenses = relatedExpenses.filter((item) => item.status === "approved" || item.status === "paid" || item.approval_status === "approved")
      .reduce((sum, item) => sum + Number(item.total_amount), 0);
    const profitability = calculateProfitability({ revenue: totalInvoiced, approvedExpenses });
    return { quotations: relatedQuotations, contracts: relatedContracts, invoices: relatedInvoices,
      expenses: relatedExpenses, maintenance: relatedMaintenance, tickets: relatedTickets,
      summary: { totalQuoted, acceptedQuoted, contractValue, totalInvoiced, totalCollected,
        outstanding, approvedExpenses, ...profitability } };
  }
};

export type Client360Data = Awaited<ReturnType<typeof client360Service.load>>;
