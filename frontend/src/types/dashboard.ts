import type { Client } from "@/types/client";
import type { Expense } from "@/types/expense";
import type { Invoice } from "@/types/invoice";
import type { Quotation } from "@/types/quotation";

export type MonthlyTrendPoint = {
  month: string;
  revenue: number;
  expenses: number;
  net: number;
};

export type ClientInsight = {
  client: Client;
  totalBilled: number;
  outstandingDue: number;
  projectCount: number;
  health: "healthy" | "attention" | "review";
};

export type KeyContactSummary = {
  id: string;
  fullName: string;
  designation: string;
  companyName: string;
  email: string;
  phone: string;
  isPrimary: boolean;
};

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
  clientStatusBreakdown: Record<string, number>;
  monthlyTrends: MonthlyTrendPoint[];
  clientInsights: ClientInsight[];
  keyContacts: KeyContactSummary[];
  collectionRate: number;
  quoteWinRate: number;
};
