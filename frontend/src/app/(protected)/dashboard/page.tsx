"use client";

import Link from "next/link";
import { ModuleScaffold } from "@/components/business/ModuleScaffold";
import { Card } from "@/components/ui/Card";
import { Table } from "@/components/ui/Table";
import { useDashboard } from "@/hooks/useDashboard";
import { formatCurrency } from "@/utils/formatCurrency";

export default function DashboardPage() {
  const { metrics, isLoading, errorMessage } = useDashboard();

  const totalQuoteCount = metrics
    ? Object.values(metrics.quotationStatusBreakdown).reduce((acc, curr) => acc + curr, 0)
    : 0;

  const totalInvoiceCount = metrics
    ? Object.values(metrics.invoiceStatusBreakdown).reduce((acc, curr) => acc + curr, 0)
    : 0;

  return (
    <ModuleScaffold
      title="Operations Dashboard"
      eyebrow="Executive Overview"
      description="Real-time commercial, financial, and operational pulse across all active client accounts and engagements."
      errorMessage={errorMessage}
      isLoading={isLoading}
      isEmpty={!metrics}
    >
      {metrics ? (
        <div className="dashboard-content-flow">
          {/* Top Tier: Primary Financial KPI Cards */}
          <div className="dashboard-hero-metrics">
            <KpiCard
              label="Paid Revenue"
              value={formatCurrency(metrics.paidRevenue)}
              subtitle="Realized income to date"
              variant="success"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              }
            />
            <KpiCard
              label="Outstanding Due"
              value={formatCurrency(metrics.outstandingAmount)}
              subtitle={`${metrics.pendingInvoices} pending invoices`}
              variant="warning"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              }
            />
            <KpiCard
              label="Monthly Expenses"
              value={formatCurrency(metrics.monthlyExpenses)}
              subtitle="Current operational burn"
              variant="danger"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" />
                  <path d="M4 6v12c0 1.1.9 2 2 2h14v-4" />
                  <line x1="18" x2="18" y1="14" y2="14" />
                </svg>
              }
            />
            <KpiCard
              label="Net Profit Estimate"
              value={formatCurrency(metrics.netProfitEstimate)}
              subtitle={`Project margin: ${formatCurrency(metrics.projectProfitability)}`}
              variant="accent"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                  <polyline points="16 7 22 7 22 13" />
                </svg>
              }
            />
          </div>

          {/* Secondary Operational Stats Grid */}
          <div className="dashboard-grid-secondary">
            <SecondaryMetric
              label="Active Clients"
              value={metrics.activeClients}
              totalLabel={`${metrics.totalClients} Total`}
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                </svg>
              }
            />
            <SecondaryMetric
              label="Active Projects"
              value={metrics.activeProjects}
              totalLabel="Under execution"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
              }
            />
            <SecondaryMetric
              label="Approved Quotes"
              value={formatCurrency(metrics.approvedQuotationValue)}
              totalLabel={`${metrics.totalQuotations} Quotations`}
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <path d="M14 2v6h6" />
                </svg>
              }
            />
            <SecondaryMetric
              label="Support & SLA"
              value={metrics.openSupportTickets}
              totalLabel={`${metrics.activeMaintenanceContracts} Maintenance contracts`}
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                </svg>
              }
            />
          </div>

          {/* Breakdown Analytics */}
          <div className="dashboard-breakdown-row">
            <Card className="breakdown-card">
              <div className="card-header-row">
                <div>
                  <h3 className="card-title">Quotation Pipeline</h3>
                  <small className="card-subtitle">Volume distribution by status</small>
                </div>
                <Link href="/quotations" className="card-header-link">Manage Quotes &rarr;</Link>
              </div>
              <div className="status-bars-list">
                {Object.entries(metrics.quotationStatusBreakdown).map(([status, count]) => {
                  const percent = totalQuoteCount > 0 ? Math.round((count / totalQuoteCount) * 100) : 0;
                  return (
                    <div key={status} className="status-bar-item">
                      <div className="status-bar-labels">
                        <span className="status-name">
                          <span className={`status-dot status-dot-${status}`} />
                          {status.replace(/_/g, " ")}
                        </span>
                        <span className="status-count">
                          <strong>{count}</strong> <small>({percent}%)</small>
                        </span>
                      </div>
                      <div className="status-progress-track">
                        <div
                          className={`status-progress-fill status-fill-${status}`}
                          style={{ width: `${Math.max(percent, count > 0 ? 4 : 0)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card className="breakdown-card">
              <div className="card-header-row">
                <div>
                  <h3 className="card-title">Billing Lifecycle</h3>
                  <small className="card-subtitle">Invoice settlement status</small>
                </div>
                <Link href="/invoices" className="card-header-link">Manage Invoices &rarr;</Link>
              </div>
              <div className="status-bars-list">
                {Object.entries(metrics.invoiceStatusBreakdown).map(([status, count]) => {
                  const percent = totalInvoiceCount > 0 ? Math.round((count / totalInvoiceCount) * 100) : 0;
                  return (
                    <div key={status} className="status-bar-item">
                      <div className="status-bar-labels">
                        <span className="status-name">
                          <span className={`status-dot status-dot-${status}`} />
                          {status.replace(/_/g, " ")}
                        </span>
                        <span className="status-count">
                          <strong>{count}</strong> <small>({percent}%)</small>
                        </span>
                      </div>
                      <div className="status-progress-track">
                        <div
                          className={`status-progress-fill status-fill-${status}`}
                          style={{ width: `${Math.max(percent, count > 0 ? 4 : 0)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Recent Records Row */}
          <div className="dashboard-tables-grid">
            <Card className="dashboard-table-card">
              <div className="card-header-row">
                <div>
                  <h3 className="card-title">Recent Invoices</h3>
                  <small className="card-subtitle">Latest issued billings</small>
                </div>
                <Link href="/invoices" className="card-header-link">View All</Link>
              </div>
              <Table>
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Client</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.recentInvoices.length > 0 ? (
                    metrics.recentInvoices.map((invoice) => (
                      <tr key={invoice.id}>
                        <td>
                          <Link href={`/invoices/${invoice.id}`} className="table-code-link">
                            {invoice.invoice_number}
                          </Link>
                        </td>
                        <td>{invoice.client?.company_name || "-"}</td>
                        <td>
                          <span className={`badge badge-${invoice.status}`}>
                            {invoice.status}
                          </span>
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 700 }}>
                          {formatCurrency(invoice.total_amount)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="table-empty-cell">No recent invoices found.</td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </Card>

            <Card className="dashboard-table-card">
              <div className="card-header-row">
                <div>
                  <h3 className="card-title">Recent Expenses</h3>
                  <small className="card-subtitle">Operational ledger activity</small>
                </div>
                <Link href="/expenses" className="card-header-link">View All</Link>
              </div>
              <Table>
                <thead>
                  <tr>
                    <th>Expense</th>
                    <th>Category</th>
                    <th style={{ textAlign: "right" }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.recentExpenses.length > 0 ? (
                    metrics.recentExpenses.map((expense) => (
                      <tr key={expense.id}>
                        <td>
                          <Link href={`/expenses/${expense.id}`} className="table-code-link">
                            {expense.expense_number}
                          </Link>
                        </td>
                        <td>
                          <span className="expense-category-pill">{expense.category}</span>
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 700 }}>
                          {formatCurrency(expense.total_amount)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="table-empty-cell">No recent expenses found.</td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </Card>
          </div>
        </div>
      ) : null}
    </ModuleScaffold>
  );
}

function KpiCard({
  label,
  value,
  subtitle,
  icon,
  variant
}: {
  label: string;
  value: string;
  subtitle: string;
  icon: JSX.Element;
  variant: "success" | "warning" | "danger" | "accent";
}) {
  return (
    <div className={`kpi-hero-card kpi-card-${variant}`}>
      <div className="kpi-header">
        <span className="kpi-label">{label}</span>
        <div className="kpi-icon-wrap">{icon}</div>
      </div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-subtext">{subtitle}</div>
    </div>
  );
}

function SecondaryMetric({
  label,
  value,
  totalLabel,
  icon
}: {
  label: string;
  value: string | number;
  totalLabel: string;
  icon: JSX.Element;
}) {
  return (
    <div className="secondary-metric-card">
      <div className="secondary-metric-icon">{icon}</div>
      <div className="secondary-metric-body">
        <span className="secondary-metric-label">{label}</span>
        <strong className="secondary-metric-value">{value}</strong>
        <span className="secondary-metric-sub">{totalLabel}</span>
      </div>
    </div>
  );
}
