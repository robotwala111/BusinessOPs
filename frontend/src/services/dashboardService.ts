import { clientService } from "@/services/clientService";
import { contactService } from "@/services/contactService";
import { expenseService } from "@/services/expenseService";
import { invoiceService } from "@/services/invoiceService";
import { maintenanceService } from "@/services/maintenanceService";
import { paymentService } from "@/services/paymentService";
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
    const [clients, projects, quotations, invoices, expenses, maintenanceContracts, supportTickets, contacts, payments] =
      await Promise.all([
        clientService.getClients(),
        projectService.getProjects(),
        quotationService.getQuotations(),
        invoiceService.getInvoices(),
        expenseService.getExpenses(),
        maintenanceService.getMaintenanceContracts(),
        maintenanceService.getSupportTickets(),
        contactService.getContacts().catch(() => []),
        paymentService.getAllPayments().catch(() => [])
      ]);

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentMonthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;

    const monthlyExpenses = expenses
      .filter((expense) => {
        const d = expense.expense_date || expense.created_at;
        return d ? d.slice(0, 7) === currentMonthKey : false;
      })
      .reduce((sum, expense) => sum + (Number(expense.total_amount) || 0), 0);

    const paidRevenue = invoices.reduce((sum, invoice) => sum + (Number(invoice.amount_paid) || 0), 0);
    const outstandingAmount = invoices.reduce((sum, invoice) => sum + (Number(invoice.balance_due) || 0), 0);
    const totalInvoiced = paidRevenue + outstandingAmount;

    // Generate 6-month financial trajectory
    const months: MonthlyTrendPoint[] = [];
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    for (let i = 5; i >= 0; i--) {
      let targetMonth = currentMonth - i;
      let targetYear = currentYear;
      while (targetMonth < 0) {
        targetMonth += 12;
        targetYear -= 1;
      }
      const yearMonth = `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}`;
      const label = `${monthNames[targetMonth]} ${targetYear % 100}`;

      // Invoiced in month
      const invoicedInMonth = invoices
        .filter((inv) => {
          const d = inv.invoice_date || inv.issue_date || inv.created_at;
          return d ? d.slice(0, 7) === yearMonth : false;
        })
        .reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0);

      // Payments recorded in month
      const paymentsInMonth = payments
        .filter((p) => {
          if (p.reversed_at) return false;
          const d = p.payment_date || p.created_at;
          return d ? d.slice(0, 7) === yearMonth : false;
        })
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

      // Invoiced amount paid in month
      const invoicePaidInMonth = invoices
        .filter((inv) => {
          const d = inv.invoice_date || inv.issue_date || inv.created_at;
          return d ? d.slice(0, 7) === yearMonth : false;
        })
        .reduce((sum, inv) => sum + (Number(inv.amount_paid) || 0), 0);

      const revInMonth = Math.max(invoicedInMonth, paymentsInMonth, invoicePaidInMonth);

      const expInMonth = expenses
        .filter((exp) => {
          const d = exp.expense_date || exp.created_at;
          return d ? d.slice(0, 7) === yearMonth : false;
        })
        .reduce((sum, exp) => sum + (Number(exp.total_amount) || 0), 0);

      months.push({
        month: label,
        revenue: revInMonth,
        expenses: expInMonth,
        net: revInMonth - expInMonth
      });
    }

    // Safety fallback: if there is recorded revenue in invoices/payments but none matched the strict dates,
    // place it in current month so graph accurately reflects business reality
    const totalTrendRevenue = months.reduce((sum, m) => sum + m.revenue, 0);
    if (totalTrendRevenue === 0 && (paidRevenue > 0 || totalInvoiced > 0)) {
      const currentMonthTrend = months[months.length - 1];
      if (currentMonthTrend) {
        currentMonthTrend.revenue = paidRevenue > 0 ? paidRevenue : totalInvoiced;
        currentMonthTrend.net = currentMonthTrend.revenue - currentMonthTrend.expenses;
      }
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
