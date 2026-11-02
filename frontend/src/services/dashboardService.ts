import { clientService } from "@/services/clientService";
import { expenseService } from "@/services/expenseService";
import { invoiceService } from "@/services/invoiceService";
import { maintenanceService } from "@/services/maintenanceService";
import { projectService } from "@/services/projectService";
import { quotationService } from "@/services/quotationService";
import type { DashboardMetrics } from "@/types/dashboard";

function countByStatus(records: { status: string }[]) {
  return records.reduce<Record<string, number>>((acc, record) => {
    acc[record.status] = (acc[record.status] ?? 0) + 1;
    return acc;
  }, {});
}

export const dashboardService = {
  async getDashboardMetrics(): Promise<DashboardMetrics> {
    const [clients, projects, quotations, invoices, expenses, maintenanceContracts, supportTickets] =
      await Promise.all([
        clientService.getClients(),
        projectService.getProjects(),
        quotationService.getQuotations(),
        invoiceService.getInvoices(),
        expenseService.getExpenses(),
        maintenanceService.getMaintenanceContracts(),
        maintenanceService.getSupportTickets()
      ]);

    const month = new Date().toISOString().slice(0, 7);
    const monthlyExpenses = expenses
      .filter((expense) => expense.expense_date.startsWith(month))
      .reduce((sum, expense) => sum + expense.total_amount, 0);
    const paidRevenue = invoices.reduce((sum, invoice) => sum + invoice.amount_paid, 0);
    const outstandingAmount = invoices.reduce((sum, invoice) => sum + invoice.balance_due, 0);

    return {
      totalClients: clients.length,
      activeClients: clients.filter((client) => client.status === "active").length,
      activeProjects: projects.filter((project) =>
        ["approved", "in_progress", "maintenance"].includes(project.status)
      ).length,
      totalQuotations: quotations.length,
      approvedQuotationValue: quotations
        .filter((quotation) => quotation.status === "accepted")
        .reduce((sum, quotation) => sum + quotation.total_amount, 0),
      pendingInvoices: invoices.filter((invoice) =>
        ["sent", "partially_paid", "overdue"].includes(invoice.status)
      ).length,
      paidRevenue,
      outstandingAmount,
      monthlyExpenses,
      netProfitEstimate: paidRevenue - monthlyExpenses,
      projectProfitability: paidRevenue - expenses.reduce((sum, expense) => sum + expense.total_amount, 0),
      activeMaintenanceContracts: maintenanceContracts.filter(
        (contract) => contract.status === "active"
      ).length,
      openSupportTickets: supportTickets.filter((ticket) =>
        ["open", "in_progress", "waiting_for_client"].includes(ticket.status)
      ).length,
      recentClients: clients.slice(0, 5),
      recentQuotations: quotations.slice(0, 5),
      recentInvoices: invoices.slice(0, 5),
      recentExpenses: expenses.slice(0, 5),
      quotationStatusBreakdown: countByStatus(quotations),
      invoiceStatusBreakdown: countByStatus(invoices)
    };
  }
};
