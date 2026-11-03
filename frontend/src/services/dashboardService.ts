import { clientService } from "@/services/clientService";
import { contactService } from "@/services/contactService";
import { expenseService } from "@/services/expenseService";
import { invoiceService } from "@/services/invoiceService";
import { maintenanceService } from "@/services/maintenanceService";
import { projectService } from "@/services/projectService";
import { quotationService } from "@/services/quotationService";
import type { DashboardMetrics, MonthlyTrendPoint, ClientInsight, KeyContactSummary } from "@/types/dashboard";

function countByStatus(records: { status: string }[]) {
  return records.reduce<Record<string, number>>((acc, record) => {
    acc[record.status] = (acc[record.status] ?? 0) + 1;
    return acc;
  }, {});
}

export const dashboardService = {
  async getDashboardMetrics(): Promise<DashboardMetrics> {
    const [clients, projects, quotations, invoices, expenses, maintenanceContracts, supportTickets, contacts] =
      await Promise.all([
        clientService.getClients(),
        projectService.getProjects(),
        quotationService.getQuotations(),
        invoiceService.getInvoices(),
        expenseService.getExpenses(),
        maintenanceService.getMaintenanceContracts(),
        maintenanceService.getSupportTickets(),
        contactService.getContacts().catch(() => [])
      ]);

    const now = new Date();
    const currentMonthKey = now.toISOString().slice(0, 7);

    const monthlyExpenses = expenses
      .filter((expense) => expense.expense_date?.startsWith(currentMonthKey))
      .reduce((sum, expense) => sum + expense.total_amount, 0);

    const paidRevenue = invoices.reduce((sum, invoice) => sum + (Number(invoice.amount_paid) || 0), 0);
    const outstandingAmount = invoices.reduce((sum, invoice) => sum + (Number(invoice.balance_due) || 0), 0);
    const totalInvoiced = paidRevenue + outstandingAmount;

    // Generate 6-month financial trajectory
    const months: MonthlyTrendPoint[] = [];
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const yearMonth = d.toISOString().slice(0, 7);
      const label = `${monthNames[d.getMonth()]} ${d.getFullYear() % 100}`;

      const revInMonth = invoices
        .filter((inv) => (inv.issue_date || inv.created_at)?.startsWith(yearMonth))
        .reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0);

      const expInMonth = expenses
        .filter((exp) => exp.expense_date?.startsWith(yearMonth))
        .reduce((sum, exp) => sum + (Number(exp.total_amount) || 0), 0);

      months.push({
        month: label,
        revenue: revInMonth,
        expenses: expInMonth,
        net: revInMonth - expInMonth
      });
    }

    // Client Insights & Health
    const clientInsights: ClientInsight[] = clients.map((client) => {
      const clientInvoices = invoices.filter((inv) => inv.client_id === client.id);
      const clientProjects = projects.filter((prj) => prj.client_id === client.id);
      const totalBilled = clientInvoices.reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0);
      const outstandingDue = clientInvoices.reduce((sum, inv) => sum + (Number(inv.balance_due) || 0), 0);

      let health: "healthy" | "attention" | "review" = "healthy";
      if (outstandingDue > 0 && clientInvoices.some((inv) => inv.status === "overdue")) {
        health = "attention";
      } else if (client.status !== "active") {
        health = "review";
      }

      return {
        client,
        totalBilled,
        outstandingDue,
        projectCount: clientProjects.length,
        health
      };
    });

    // Key Contacts Summary
    const keyContacts: KeyContactSummary[] = contacts.slice(0, 6).map((c) => ({
      id: c.id,
      fullName: c.full_name,
      designation: c.designation || "Stakeholder",
      companyName: c.client?.company_name || "Enterprise Account",
      email: c.email || "",
      phone: c.phone || "",
      isPrimary: Boolean(c.is_primary)
    }));

    const acceptedQuotes = quotations.filter((q) => q.status === "accepted");
    const quoteWinRate = quotations.length > 0 ? Math.round((acceptedQuotes.length / quotations.length) * 100) : 0;
    const collectionRate = totalInvoiced > 0 ? Math.round((paidRevenue / totalInvoiced) * 100) : 100;

    return {
      totalClients: clients.length,
      activeClients: clients.filter((client) => client.status === "active").length,
      activeProjects: projects.filter((project) =>
        ["approved", "in_progress", "maintenance"].includes(project.status)
      ).length,
      totalQuotations: quotations.length,
      approvedQuotationValue: acceptedQuotes.reduce((sum, quotation) => sum + (Number(quotation.total_amount) || 0), 0),
      pendingInvoices: invoices.filter((invoice) =>
        ["sent", "partially_paid", "overdue"].includes(invoice.status)
      ).length,
      paidRevenue,
      outstandingAmount,
      monthlyExpenses,
      netProfitEstimate: paidRevenue - monthlyExpenses,
      projectProfitability: paidRevenue - expenses.reduce((sum, expense) => sum + (Number(expense.total_amount) || 0), 0),
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
      invoiceStatusBreakdown: countByStatus(invoices),
      clientStatusBreakdown: countByStatus(clients),
      monthlyTrends: months,
      clientInsights,
      keyContacts,
      collectionRate,
      quoteWinRate
    };
  }
};
