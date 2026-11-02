import type { Client } from "@/types/client";
import type { Expense } from "@/types/expense";
import type { Invoice } from "@/types/invoice";
import type { Quotation } from "@/types/quotation";

export type DashboardMetrics = {
  totalClients: number;
  activeClients: number;
  activeProjects: number;
  totalQuotations: number;
  approvedQuotationValue: number;
  pendingInvoices: number;
  paidRevenue: number;
  outstandingAmount: number;
  monthlyExpenses: number;
  netProfitEstimate: number;
  projectProfitability: number;
  activeMaintenanceContracts: number;
  openSupportTickets: number;
  recentClients: Client[];
  recentQuotations: Quotation[];
  recentInvoices: Invoice[];
  recentExpenses: Expense[];
  quotationStatusBreakdown: Record<string, number>;
  invoiceStatusBreakdown: Record<string, number>;
};
