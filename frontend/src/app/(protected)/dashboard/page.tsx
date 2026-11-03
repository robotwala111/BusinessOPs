"use client";

import Link from "next/link";
import { ModuleScaffold } from "@/components/business/ModuleScaffold";
import { Card } from "@/components/ui/Card";
import { Table } from "@/components/ui/Table";
import { useDashboard } from "@/hooks/useDashboard";
import { formatCurrency } from "@/utils/formatCurrency";
import { RevenueTrendChart } from "@/components/dashboard/RevenueTrendChart";
import { ClientPortfolioSection } from "@/components/dashboard/ClientPortfolioSection";
import { OperationalPulseGauges } from "@/components/dashboard/OperationalPulseGauges";
import { KeyStakeholdersRoster } from "@/components/dashboard/KeyStakeholdersRoster";

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
          {/* Top Financial KPI Hero Cards */}
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
              label="Net Profit Margin"
              value={formatCurrency(metrics.netProfitEstimate)}
              subtitle={`Lifetime margin: ${formatCurrency(metrics.projectProfitability)}`}
              variant="accent"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                  <polyline points="16 7 22 7 22 13" />
                </svg>
              }
            />
          </div>

          {/* Operational Pulse Gauges */}
          <OperationalPulseGauges
            collectionRate={metrics.collectionRate}
            quoteWinRate={metrics.quoteWinRate}
            activeSlaCount={metrics.activeMaintenanceContracts}
          />

          {/* Revenue & Cashflow Trajectory Chart */}
          <Card className="dashboard-chart-card">
            <div className="card-header-row">
              <div>
                <h3 className="card-title">Commercial & Cashflow Trajectory</h3>
                <small className="card-subtitle">Monthly revenue billed vs operational expense burn</small>
              </div>
              <Link href="/invoices" className="card-header-link">Invoices Ledger &rarr;</Link>
            </div>
            <RevenueTrendChart data={metrics.monthlyTrends} />
          </Card>

          {/* Interactive Client Portfolio Section (Donut & Account Cards) */}
          <Card className="dashboard-chart-card">
            <div className="card-header-row">
              <div>
                <h3 className="card-title">Client Portfolio & Account Pulse</h3>
                <small className="card-subtitle">Interactive relationship matrix, status distribution, and account health</small>
              </div>
              <Link href="/clients" className="card-header-link">Manage Clients &rarr;</Link>
            </div>
            <ClientPortfolioSection
              insights={metrics.clientInsights}
              statusBreakdown={metrics.clientStatusBreakdown}
            />
          </Card>

          {/* Key Stakeholders & Persons Spotlight */}
          <Card className="dashboard-chart-card">
            <div className="card-header-row">
              <div>
                <h3 className="card-title">Key Stakeholders & Contacts</h3>
                <small className="card-subtitle">Direct channels to primary decision makers and project coordinators</small>
              </div>
              <Link href="/contacts" className="card-header-link">All Contacts &rarr;</Link>
            </div>
            <KeyStakeholdersRoster contacts={metrics.keyContacts} />
          </Card>

          {/* Quotation Pipeline & Billing Lifecycle Split Row */}
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
