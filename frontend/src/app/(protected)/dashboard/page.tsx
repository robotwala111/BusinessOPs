"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useDashboard } from "@/hooks/useDashboard";
import { formatCurrency } from "@/utils/formatCurrency";
import type { DashboardMetrics } from "@/types/dashboard";

/* ── helpers ─────────────────────────────────────────────────────── */

const greetings = [
  "A New Window Of Opportunity Opens Today—Explore Your Momentum.",
  "Your Business Pulse Looks Strong—Let's Keep The Momentum Going.",
  "Growth Is Built One Great Decision At A Time—Start Here.",
  "Today's Insights Are Ready. Let's Make Them Count.",
  "Your Operations Are In Motion—Stay Ahead Of Every Detail."
];

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

function pct(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

function formatYTick(n: number) {
  if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(1)}Cr`;
  if (n >= 100_000) return `${(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

function getCurvedPath(points: Array<[number, number]>): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0][0]} ${points[0][1]}`;

  let path = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? i : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;

    path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return path;
}

/* ── Revenue Chart ───────────────────────────────────────────────── */

function RevenueChart({ trends }: { trends: DashboardMetrics["monthlyTrends"] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const chartW = 580;
  const chartH = 220;
  const padL = 48;
  const padR = 16;
  const padT = 20;
  const padB = 36;
  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;

  const rawMax = Math.max(...trends.map((t) => Math.max(t.revenue, t.expenses)), 0);
  const maxVal = rawMax > 0 ? Math.ceil(rawMax * 1.2) : 50000;
  const yTicks = [0, Math.round(maxVal * 0.33), Math.round(maxVal * 0.66), maxVal];

  const xStep = trends.length > 1 ? innerW / (trends.length - 1) : innerW;

  function toX(i: number) {
    return padL + i * xStep;
  }
  function toY(v: number) {
    return padT + innerH - (Math.max(v, 0) / maxVal) * innerH;
  }

  // Generate smooth spline paths
  const revPoints: Array<[number, number]> = trends.map((t, i) => [toX(i), toY(t.revenue)]);
  const revCurve = getCurvedPath(revPoints);
  const revArea = `${revCurve} L ${toX(trends.length - 1)} ${toY(0)} L ${toX(0)} ${toY(0)} Z`;

  const expPoints: Array<[number, number]> = trends.map((t, i) => [toX(i), toY(t.expenses)]);
  const expCurve = getCurvedPath(expPoints);

  return (
    <div className="exec-chart-container">
      <div className="exec-chart-header">
        <div>
          <h3 className="exec-chart-title">Revenue & Growth Report</h3>
          <p className="exec-chart-sub">Measuring income and growth trends across the quarter.</p>
        </div>
        <div className="exec-chart-legend">
          <span className="exec-legend-dot" style={{ background: "#f59e0b" }} />
          <span>Revenue Growth</span>
          <span className="exec-legend-dot" style={{ background: "#f87171" }} />
          <span>Expenses</span>
        </div>
      </div>

      <div className="exec-chart-body">
        <svg
          viewBox={`0 0 ${chartW} ${chartH}`}
          className="exec-chart-svg"
          onMouseLeave={() => setHoverIdx(null)}
        >
          <defs>
            <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.28" />
              <stop offset="60%" stopColor="#f59e0b" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#f59e0b" floodOpacity="0.25" />
            </filter>
          </defs>

          {/* Y-axis gridlines */}
          {yTicks.map((tick) => (
            <g key={tick}>
              <line
                x1={padL}
                y1={toY(tick)}
                x2={chartW - padR}
                y2={toY(tick)}
                stroke="#f1f5f9"
                strokeWidth="1"
              />
              <text
                x={padL - 8}
                y={toY(tick) + 4}
                textAnchor="end"
                fill="#94a3b8"
                fontSize="10"
                fontWeight="600"
              >
                {formatYTick(tick)}
              </text>
            </g>
          ))}

          {/* Revenue smooth area fill */}
          <path d={revArea} fill="url(#revGrad)" />

          {/* Revenue smooth spline */}
          <path
            d={revCurve}
            fill="none"
            stroke="#f59e0b"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#glow)"
          />

          {/* Expense smooth spline */}
          <path
            d={expCurve}
            fill="none"
            stroke="#f87171"
            strokeWidth="2"
            strokeDasharray="5 4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data Points */}
          {trends.map((t, i) => (
            <circle
              key={`dot-${i}`}
              cx={toX(i)}
              cy={toY(t.revenue)}
              r={hoverIdx === i ? 6 : 4}
              fill="#ffffff"
              stroke="#f59e0b"
              strokeWidth={hoverIdx === i ? 3 : 2}
            />
          ))}

          {/* X-axis labels */}
          {trends.map((t, i) => (
            <text
              key={t.month}
              x={toX(i)}
              y={chartH - 6}
              textAnchor="middle"
              fill={hoverIdx === i ? "#0f172a" : "#94a3b8"}
              fontSize="11"
              fontWeight={hoverIdx === i ? "700" : "600"}
            >
              {t.month}
            </text>
          ))}

          {/* Interactive hover zones */}
          {trends.map((t, i) => (
            <g key={`hover-${i}`} onMouseEnter={() => setHoverIdx(i)}>
              <rect
                x={toX(i) - xStep / 2}
                y={padT}
                width={xStep}
                height={innerH}
                fill="transparent"
                style={{ cursor: "pointer" }}
              />
              {hoverIdx === i && (
                <>
                  <line
                    x1={toX(i)}
                    y1={padT}
                    x2={toX(i)}
                    y2={padT + innerH}
                    stroke="#f59e0b"
                    strokeWidth="1.5"
                    strokeDasharray="4 3"
                    opacity="0.6"
                  />
                  <circle cx={toX(i)} cy={toY(t.revenue)} r="6" fill="#f59e0b" stroke="#fff" strokeWidth="2.5" />
                  {t.expenses > 0 && (
                    <circle cx={toX(i)} cy={toY(t.expenses)} r="5" fill="#f87171" stroke="#fff" strokeWidth="2" />
                  )}
                </>
              )}
            </g>
          ))}
        </svg>

        {/* Floating tooltip */}
        {hoverIdx !== null && trends[hoverIdx] && (
          <div
            className="exec-chart-tooltip"
            style={{
              left: `${Math.min(Math.max((toX(hoverIdx) / chartW) * 100, 18), 82)}%`,
            }}
          >
            <div className="exec-tooltip-label">{trends[hoverIdx].month}</div>
            <div className="exec-tooltip-row">
              <span>Realized Revenue</span>
              <strong style={{ color: "#f59e0b" }}>
                {formatCurrency(trends[hoverIdx].revenue)}
              </strong>
            </div>
            <div className="exec-tooltip-row">
              <span>Expenses</span>
              <strong style={{ color: "#f87171" }}>
                {formatCurrency(trends[hoverIdx].expenses)}
              </strong>
            </div>
            <div className="exec-tooltip-divider" />
            <div className="exec-tooltip-row">
              <span>Net Margin</span>
              <strong style={{ color: trends[hoverIdx].net >= 0 ? "#10b981" : "#ef4444" }}>
                {formatCurrency(trends[hoverIdx].net)}
              </strong>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main Dashboard Page ─────────────────────────────────────────── */

export default function DashboardPage() {
  const { metrics, isLoading, errorMessage, refresh } = useDashboard();
  const { profile } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [motivationalText] = useState(
    () => greetings[Math.floor(Math.random() * greetings.length)]
  );

  const companyName = profile?.company_name || "Amiro Tech Solutions";

  async function handleRefresh() {
    setIsRefreshing(true);
    try {
      await refresh();
    } finally {
      setIsRefreshing(false);
    }
  }

  // Compute operational KPIs
  const kpis = useMemo(() => {
    if (!metrics) return null;

    const totalInvoiced = metrics.paidRevenue + metrics.outstandingAmount;
    const collectionRate = totalInvoiced > 0 ? pct(metrics.paidRevenue, totalInvoiced) : 100;
    const clientEngagement = metrics.totalClients > 0
      ? pct(metrics.activeClients, metrics.totalClients)
      : 0;

    return {
      collectionRate,
      clientEngagement,
    };
  }, [metrics]);

  if (isLoading) {
    return (
      <section className="exec-dash">
        <div className="exec-loading-state">
          <div className="exec-loading-spinner" />
          <p>Loading your business intelligence…</p>
        </div>
      </section>
    );
  }

  if (errorMessage) {
    return (
      <section className="exec-dash">
        <div className="exec-error-state">
          <p>{errorMessage}</p>
        </div>
      </section>
    );
  }

  if (!metrics || !kpis) return null;

  const totalQuoteCount = Object.values(metrics.quotationStatusBreakdown).reduce((a, b) => a + b, 0);

  return (
    <section className="exec-dash">
      {/* ── Greeting Header with Refresh Button ── */}
      <header className="exec-greeting" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 className="exec-greeting-title">
            {getGreeting()}, <span className="exec-name-highlight">{companyName}.</span>
          </h1>
          <p className="exec-greeting-sub">{motivationalText}</p>
        </div>
        <button
          type="button"
          className="exec-refresh-btn"
          onClick={handleRefresh}
          disabled={isRefreshing}
          title="Refresh dashboard metrics"
        >
          <svg className={isRefreshing ? "exec-spin" : ""} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
          </svg>
          <span>{isRefreshing ? "Updating…" : "Refresh"}</span>
        </button>
      </header>

      {/* ── KPI Strip ── */}
      <div className="exec-kpi-strip">
        <KpiPill
          title="Client Engagement"
          value={`${kpis.clientEngagement}%`}
          change={kpis.clientEngagement > 50 ? "+active" : "low"}
          positive={kpis.clientEngagement > 50}
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          }
          color="#f59e0b"
        />
        <KpiPill
          title="Collection Rate"
          value={`${kpis.collectionRate}%`}
          change={kpis.collectionRate >= 80 ? "Healthy" : "Needs Attention"}
          positive={kpis.collectionRate >= 80}
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          }
          color="#10b981"
        />
        <KpiPill
          title="Quote Win Rate"
          value={`${metrics.quoteWinRate}%`}
          change={metrics.quoteWinRate > 30 ? "Converting" : "Pipeline"}
          positive={metrics.quoteWinRate > 30}
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6" />
              <path d="m9 15 2 2 4-4" />
            </svg>
          }
          color="#3b82f6"
        />
        <KpiPill
          title="Team Productivity"
          value={`${metrics.activeProjects}`}
          change={`${metrics.activeProjects > 0 ? "Active" : "Idle"} Projects`}
          positive={metrics.activeProjects > 0}
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
          }
          color="#8b5cf6"
        />
      </div>

      {/* ── Main Content Grid: Chart + Insights ── */}
      <div className="exec-main-grid">
        {/* Left: Revenue Chart */}
        <div className="exec-chart-card">
          <RevenueChart trends={metrics.monthlyTrends} />
        </div>

        {/* Right: Profit Insights */}
        <div className="exec-insights-panel">
          <div className="exec-insights-header">
            <h3>Financial Insights</h3>
            <Link href="/reports/finance" className="exec-see-all">See all</Link>
          </div>

          <InsightCard
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                <polyline points="16 7 22 7 22 13" />
              </svg>
            }
            iconBg="#fef3c7"
            iconColor="#d97706"
            value={formatCurrency(metrics.netProfitEstimate)}
            label="Net Profit Estimate"
          />
          <InsightCard
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            }
            iconBg="#dcfce7"
            iconColor="#16a34a"
            value={formatCurrency(metrics.paidRevenue)}
            label="Realized Revenue"
          />
          <InsightCard
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            }
            iconBg="#fee2e2"
            iconColor="#dc2626"
            value={formatCurrency(metrics.outstandingAmount)}
            label="Outstanding Receivables"
          />
          <InsightCard
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" />
                <path d="M4 6v12c0 1.1.9 2 2 2h14v-4" />
              </svg>
            }
            iconBg="#ede9fe"
            iconColor="#7c3aed"
            value={formatCurrency(metrics.monthlyExpenses)}
            label="Monthly Expenses"
          />
        </div>
      </div>

      {/* ── Project Performance Table ── */}
      <div className="exec-project-card">
        <div className="exec-project-header">
          <h3>Project Performance Overview</h3>
          <div className="exec-project-actions">
            <span className="exec-updated-tag">
              Updated: {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
            </span>
            <Link href="/projects" className="exec-view-all-btn">View All Projects →</Link>
          </div>
        </div>

        <table className="exec-project-table">
          <thead>
            <tr>
              <th>Project</th>
              <th>Client</th>
              <th style={{ textAlign: "right" }}>Value</th>
              <th style={{ textAlign: "center" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {metrics.clientInsights.length > 0 ? (
              metrics.clientInsights.slice(0, 5).map((insight) => (
                <tr key={insight.client.id}>
                  <td>
                    <Link href={`/clients/${insight.client.id}`} className="exec-project-name">
                      {insight.client.company_name}
                    </Link>
                  </td>
                  <td className="exec-project-industry">{insight.client.industry || "Technology"}</td>
                  <td style={{ textAlign: "right" }}>
                    <span className="exec-project-revenue">
                      {formatCurrency(insight.totalBilled)}
                    </span>
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <span className={`exec-status-pill exec-status-${insight.health}`}>
                      {insight.health === "healthy" ? "● Active" : insight.health === "attention" ? "● Attention" : "● Review"}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="exec-empty-row">
                  No client accounts yet. <Link href="/clients/onboard">Onboard your first client →</Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Quick Stats Footer Row ── */}
      <div className="exec-footer-grid">
        <div className="exec-footer-stat">
          <div className="exec-footer-stat-header">
            <h4>Quotation Pipeline</h4>
            <Link href="/quotations" className="exec-see-all">Manage →</Link>
          </div>
          <div className="exec-stat-bars">
            {Object.entries(metrics.quotationStatusBreakdown).map(([status, count]) => {
              const percent = totalQuoteCount > 0 ? Math.round((count / totalQuoteCount) * 100) : 0;
              return (
                <div key={status} className="exec-stat-bar-row">
                  <div className="exec-stat-bar-meta">
                    <span className={`exec-bar-dot exec-bar-dot-${status}`} />
                    <span className="exec-bar-label">{status.replace(/_/g, " ")}</span>
                    <span className="exec-bar-count">{count}</span>
                  </div>
                  <div className="exec-bar-track">
                    <div
                      className={`exec-bar-fill exec-fill-${status}`}
                      style={{ width: `${Math.max(percent, count > 0 ? 6 : 0)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="exec-footer-stat">
          <div className="exec-footer-stat-header">
            <h4>Recent Invoices</h4>
            <Link href="/invoices" className="exec-see-all">View All →</Link>
          </div>
          <div className="exec-mini-list">
            {metrics.recentInvoices.length > 0 ? (
              metrics.recentInvoices.slice(0, 4).map((inv) => (
                <div key={inv.id} className="exec-mini-row">
                  <div className="exec-mini-info">
                    <Link href={`/invoices/${inv.id}`} className="exec-mini-code">{inv.invoice_number}</Link>
                    <span className="exec-mini-client">{inv.client?.company_name || "Client"}</span>
                  </div>
                  <div className="exec-mini-right">
                    <span className="exec-mini-amount">{formatCurrency(inv.total_amount)}</span>
                    <span className={`exec-mini-badge exec-mini-badge-${inv.status}`}>
                      {inv.status.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="exec-mini-empty">No invoices recorded yet.</p>
            )}
          </div>
        </div>

        <div className="exec-footer-stat">
          <div className="exec-footer-stat-header">
            <h4>Recent Expenses</h4>
            <Link href="/expenses" className="exec-see-all">View All →</Link>
          </div>
          <div className="exec-mini-list">
            {metrics.recentExpenses.length > 0 ? (
              metrics.recentExpenses.slice(0, 4).map((exp) => (
                <div key={exp.id} className="exec-mini-row">
                  <div className="exec-mini-info">
                    <span className="exec-mini-code">{exp.expense_number}</span>
                    <span className="exec-mini-client">{exp.category}</span>
                  </div>
                  <span className="exec-mini-amount">{formatCurrency(exp.total_amount)}</span>
                </div>
              ))
            ) : (
              <p className="exec-mini-empty">No expenses recorded yet.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── KPI Pill Component ── */

function KpiPill({
  title,
  value,
  change,
  positive,
  icon,
  color,
}: {
  title: string;
  value: string;
  change: string;
  positive: boolean;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="exec-kpi-pill">
      <div className="exec-kpi-top">
        <span className="exec-kpi-title">{title}</span>
        <div className="exec-kpi-icon" style={{ backgroundColor: `${color}18`, color }}>
          {icon}
        </div>
      </div>
      <div className="exec-kpi-value">{value}</div>
      <div className={`exec-kpi-change ${positive ? "positive" : "negative"}`}>
        {positive ? "↑" : "↓"} {change}
      </div>
    </div>
  );
}

/* ── Insight Card Component ── */

function InsightCard({
  icon,
  iconBg,
  iconColor,
  value,
  label,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  value: string;
  label: string;
}) {
  return (
    <div className="exec-insight-card">
      <div className="exec-insight-icon" style={{ backgroundColor: iconBg, color: iconColor }}>
        {icon}
      </div>
      <div className="exec-insight-body">
        <div className="exec-insight-value">{value}</div>
        <div className="exec-insight-label">{label}</div>
      </div>
    </div>
  );
}
