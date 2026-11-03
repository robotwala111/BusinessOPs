"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ClientInsight } from "@/types/dashboard";
import { formatCurrency } from "@/utils/formatCurrency";

type Props = {
  insights: ClientInsight[];
  statusBreakdown: Record<string, number>;
};

export function ClientPortfolioSection({ insights, statusBreakdown }: Props) {
  const [filter, setFilter] = useState<"all" | "active" | "due">("all");
  const [hoveredStatus, setHoveredStatus] = useState<string | null>(null);

  const totalClients = insights.length;

  const filteredInsights = useMemo(() => {
    if (filter === "active") {
      return insights.filter((i) => i.client.status === "active");
    }
    if (filter === "due") {
      return insights.filter((i) => i.outstandingDue > 0);
    }
    return insights;
  }, [insights, filter]);

  // Donut chart calculations
  const statusColors: Record<string, string> = {
    active: "#10b981",
    lead: "#3b82f6",
    proposal_sent: "#f59e0b",
    inactive: "#94a3b8"
  };

  const statusEntries = Object.entries(statusBreakdown).filter(([_, count]) => count > 0);
  const totalCount = statusEntries.reduce((sum, [_, c]) => sum + c, 0) || 1;

  // Compute SVG Donut arc segments
  const size = 160;
  const strokeWidth = 22;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let currentOffset = 0;
  const donutSegments = statusEntries.map(([status, count]) => {
    const percentage = count / totalCount;
    const strokeDasharray = `${percentage * circumference} ${circumference}`;
    const strokeDashoffset = -currentOffset;
    currentOffset += percentage * circumference;

    return {
      status,
      count,
      color: statusColors[status] || "#6366f1",
      strokeDasharray,
      strokeDashoffset,
      percent: Math.round(percentage * 100)
    };
  });

  return (
    <div className="client-portfolio-layout">
      {/* Visual Donut & Breakdown Column */}
      <div className="client-donut-panel">
        <div className="panel-header-compact">
          <h4>Account Portfolio Pulse</h4>
          <span className="count-pill">{totalClients} Accounts</span>
        </div>

        <div className="donut-visual-container">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="donut-svg">
            {/* Background ring */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke="#f1f5f9"
              strokeWidth={strokeWidth}
            />

            {/* Arcs */}
            {donutSegments.map((seg) => (
              <circle
                key={seg.status}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke={seg.color}
                strokeWidth={hoveredStatus === seg.status ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={seg.strokeDasharray}
                strokeDashoffset={seg.strokeDashoffset}
                strokeLinecap="round"
                className="donut-arc-segment"
                onMouseEnter={() => setHoveredStatus(seg.status)}
                onMouseLeave={() => setHoveredStatus(null)}
                style={{
                  transition: "stroke-width 200ms ease, opacity 200ms ease",
                  cursor: "pointer",
                  opacity: hoveredStatus && hoveredStatus !== seg.status ? 0.45 : 1
                }}
              />
            ))}
          </svg>

          {/* Centered Total / Hover Label */}
          <div className="donut-center-label">
            {hoveredStatus ? (
              <>
                <span className="donut-hover-status">{hoveredStatus.replace(/_/g, " ")}</span>
                <strong className="donut-hover-value">
                  {statusBreakdown[hoveredStatus] || 0}
                </strong>
              </>
            ) : (
              <>
                <strong className="donut-big-value">{totalClients}</strong>
                <span className="donut-sub-text">Total Clients</span>
              </>
            )}
          </div>
        </div>

        {/* Status Legend Pills */}
        <div className="donut-legend-grid">
          {donutSegments.map((seg) => (
            <div
              key={seg.status}
              className={`donut-legend-row ${hoveredStatus === seg.status ? "active-hover" : ""}`}
              onMouseEnter={() => setHoveredStatus(seg.status)}
              onMouseLeave={() => setHoveredStatus(null)}
            >
              <span className="legend-dot" style={{ backgroundColor: seg.color }} />
              <span className="legend-name">{seg.status.replace(/_/g, " ")}</span>
              <strong className="legend-val">{seg.count}</strong>
              <small className="legend-pct">({seg.percent}%)</small>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Client Cards Deck */}
      <div className="client-cards-panel">
        <div className="client-cards-toolbar">
          <div className="filter-tab-pills">
            <button
              type="button"
              className={`filter-pill ${filter === "all" ? "active" : ""}`}
              onClick={() => setFilter("all")}
            >
              All Clients ({insights.length})
            </button>
            <button
              type="button"
              className={`filter-pill ${filter === "active" ? "active" : ""}`}
              onClick={() => setFilter("active")}
            >
              Active Accounts ({insights.filter((i) => i.client.status === "active").length})
            </button>
            <button
              type="button"
              className={`filter-pill ${filter === "due" ? "active" : ""}`}
              onClick={() => setFilter("due")}
            >
              With Due Balance ({insights.filter((i) => i.outstandingDue > 0).length})
            </button>
          </div>

          <Link href="/clients" className="browse-all-link">
            Open Directory &rarr;
          </Link>
        </div>

        {filteredInsights.length === 0 ? (
          <div className="client-empty-card">
            <p>No clients matching the selected criteria.</p>
          </div>
        ) : (
          <div className="client-grid-cards">
            {filteredInsights.map((insight) => {
              const { client, totalBilled, outstandingDue, projectCount, health } = insight;
              const initials = client.company_name
                ? client.company_name
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((w) => w[0]?.toUpperCase())
                    .join("")
                : "CL";

              const healthBadge =
                health === "healthy"
                  ? { label: "Good Standing", cls: "health-healthy" }
                  : health === "attention"
                  ? { label: "Payment Due", cls: "health-attention" }
                  : { label: "Prospective", cls: "health-review" };

              return (
                <div key={client.id} className="interactive-client-card">
                  <div className="card-top-header">
                    <div className="client-avatar-pill">
                      <span>{initials}</span>
                    </div>
                    <div className="client-meta">
                      <Link href={`/clients/${client.id}`} className="client-name-link">
                        {client.company_name}
                      </Link>
                      <span className="client-person-sub">
                        {client.contact_person || "Key Stakeholder"}
                      </span>
                    </div>
                    <span className={`client-health-badge ${healthBadge.cls}`}>
                      {healthBadge.label}
                    </span>
                  </div>

                  {/* Financial & Delivery Metrics */}
                  <div className="client-metrics-trio">
                    <div className="metric-chip">
                      <span className="chip-label">Billed Value</span>
                      <strong className="chip-value">{formatCurrency(totalBilled)}</strong>
                    </div>

                    <div className="metric-chip">
                      <span className="chip-label">Outstanding</span>
                      <strong className={`chip-value ${outstandingDue > 0 ? "due-alert" : ""}`}>
                        {formatCurrency(outstandingDue)}
                      </strong>
                    </div>

                    <div className="metric-chip">
                      <span className="chip-label">Projects</span>
                      <strong className="chip-value">{projectCount} Active</strong>
                    </div>
                  </div>

                  {/* Quick Card Footer */}
                  <div className="client-card-footer">
                    <div className="contact-quick-links">
                      {client.email && (
                        <a
                          href={`mailto:${client.email}`}
                          className="footer-icon-link"
                          title={`Email ${client.email}`}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect width="20" height="16" x="2" y="4" rx="2"/>
                            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                          </svg>
                          <span>Email</span>
                        </a>
                      )}
                      {client.phone && (
                        <a
                          href={`tel:${client.phone}`}
                          className="footer-icon-link"
                          title={`Call ${client.phone}`}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                          </svg>
                          <span>Phone</span>
                        </a>
                      )}
                    </div>

                    <Link href={`/clients/${client.id}`} className="view-account-arrow">
                      Details &rarr;
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
