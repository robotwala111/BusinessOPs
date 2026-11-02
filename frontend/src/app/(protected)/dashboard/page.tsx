"use client";

import { ModuleScaffold } from "@/components/business/ModuleScaffold";
import { Card } from "@/components/ui/Card";
import { Table } from "@/components/ui/Table";
import { useDashboard } from "@/hooks/useDashboard";
import { formatCurrency } from "@/utils/formatCurrency";

export default function DashboardPage() {
  const { metrics, isLoading, errorMessage } = useDashboard();

  return (
    <ModuleScaffold title="Dashboard" eyebrow="Business Overview" description="Live operational and financial snapshot across clients, quotations, invoices, expenses, and support." errorMessage={errorMessage} isLoading={isLoading} isEmpty={!metrics}>
      {metrics ? (
        <>
          <div className="dashboard-grid">
            <Metric label="Total clients" value={metrics.totalClients} />
            <Metric label="Active clients" value={metrics.activeClients} />
            <Metric label="Active projects" value={metrics.activeProjects} />
            <Metric label="Total quotations" value={metrics.totalQuotations} />
            <Metric label="Approved quote value" value={formatCurrency(metrics.approvedQuotationValue)} />
            <Metric label="Pending invoices" value={metrics.pendingInvoices} />
            <Metric label="Paid revenue" value={formatCurrency(metrics.paidRevenue)} />
            <Metric label="Outstanding" value={formatCurrency(metrics.outstandingAmount)} />
            <Metric label="Monthly expenses" value={formatCurrency(metrics.monthlyExpenses)} />
            <Metric label="Net profit estimate" value={formatCurrency(metrics.netProfitEstimate)} />
            <Metric label="Project profitability" value={formatCurrency(metrics.projectProfitability)} />
            <Metric label="Active maintenance" value={metrics.activeMaintenanceContracts} />
            <Metric label="Open tickets" value={metrics.openSupportTickets} />
          </div>
          <div className="quote-detail-columns">
            <Card><h2>Quotation status breakdown</h2>{Object.entries(metrics.quotationStatusBreakdown).map(([status, count]) => <p key={status}>{status}: <strong>{count}</strong></p>)}</Card>
            <Card><h2>Invoice status breakdown</h2>{Object.entries(metrics.invoiceStatusBreakdown).map(([status, count]) => <p key={status}>{status}: <strong>{count}</strong></p>)}</Card>
          </div>
          <Card><h2>Recent invoices</h2><Table><thead><tr><th>Invoice</th><th>Client</th><th>Status</th><th>Total</th></tr></thead><tbody>{metrics.recentInvoices.map((invoice) => <tr key={invoice.id}><td>{invoice.invoice_number}</td><td>{invoice.client?.company_name || "-"}</td><td>{invoice.status}</td><td>{formatCurrency(invoice.total_amount)}</td></tr>)}</tbody></Table></Card>
          <Card><h2>Recent expenses</h2><Table><thead><tr><th>Expense</th><th>Category</th><th>Total</th></tr></thead><tbody>{metrics.recentExpenses.map((expense) => <tr key={expense.id}><td>{expense.expense_number}</td><td>{expense.category}</td><td>{formatCurrency(expense.total_amount)}</td></tr>)}</tbody></Table></Card>
        </>
      ) : null}
    </ModuleScaffold>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <Card className="metric-card"><span>{label}</span><strong>{value}</strong></Card>;
}
