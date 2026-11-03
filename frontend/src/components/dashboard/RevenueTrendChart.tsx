"use client";

import { useState } from "react";
import type { MonthlyTrendPoint } from "@/types/dashboard";
import { formatCurrency } from "@/utils/formatCurrency";

type Props = {
  data: MonthlyTrendPoint[];
};

export function RevenueTrendChart({ data }: Props) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"area" | "bar">("area");

  if (!data || data.length === 0) {
    return (
      <div className="chart-empty-state">
        <p>No historical billing data available yet.</p>
      </div>
    );
  }

  // Dimensions
  const svgWidth = 640;
  const svgHeight = 220;
  const paddingLeft = 60;
  const paddingRight = 30;
  const paddingTop = 25;
  const paddingBottom = 40;

  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  const maxVal = Math.max(
    ...data.map((d) => Math.max(d.revenue, d.expenses, 10000)),
    50000
  );

  const getX = (index: number) => {
    if (data.length <= 1) return paddingLeft + chartWidth / 2;
    return paddingLeft + (index / (data.length - 1)) * chartWidth;
  };

  const getY = (val: number) => {
    const clamped = Math.max(0, val);
    return paddingTop + chartHeight - (clamped / maxVal) * chartHeight;
  };

  // Generate smooth SVG paths
  const revenuePoints = data.map((d, i) => `${getX(i)},${getY(d.revenue)}`).join(" ");
  const expensesPoints = data.map((d, i) => `${getX(i)},${getY(d.expenses)}`).join(" ");

  const areaRevenuePath = data.length > 1
    ? `M ${getX(0)},${getY(data[0].revenue)} ` +
      data.slice(1).map((d, i) => `L ${getX(i + 1)},${getY(d.revenue)}`).join(" ") +
      ` L ${getX(data.length - 1)},${paddingTop + chartHeight} L ${getX(0)},${paddingTop + chartHeight} Z`
    : "";

  const activePoint = hoveredIndex !== null ? data[hoveredIndex] : null;

  return (
    <div className="revenue-trend-container">
      <div className="chart-toolbar">
        <div className="chart-legend-row">
          <span className="chart-legend-item">
            <span className="legend-indicator legend-revenue" />
            Revenue Invoiced
          </span>
          <span className="chart-legend-item">
            <span className="legend-indicator legend-expenses" />
            Expenses Burn
          </span>
          <span className="chart-legend-item">
            <span className="legend-indicator legend-margin" />
            Net Trajectory
          </span>
        </div>

        <div className="chart-toggle-pills">
          <button
            type="button"
            className={`chart-pill-btn ${viewMode === "area" ? "active" : ""}`}
            onClick={() => setViewMode("area")}
          >
            Trend Curve
          </button>
          <button
            type="button"
            className={`chart-pill-btn ${viewMode === "bar" ? "active" : ""}`}
            onClick={() => setViewMode("bar")}
          >
            Bar Volume
          </button>
        </div>
      </div>

      <div className="chart-visual-wrapper">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="revenue-chart-svg"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="barRevenueGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
            <linearGradient id="barExpensesGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f87171" />
              <stop offset="100%" stopColor="#dc2626" />
            </linearGradient>
          </defs>

          {/* Horizontal Gridlines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
            const y = paddingTop + chartHeight * (1 - pct);
            const val = maxVal * pct;
            return (
              <g key={idx}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={svgWidth - paddingRight}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeDasharray={pct === 0 ? "none" : "3,3"}
                  strokeWidth="1"
                />
                <text
                  x={paddingLeft - 10}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="10"
                  fill="#94a3b8"
                  fontWeight="600"
                >
                  {val >= 1000 ? `₹${Math.round(val / 1000)}k` : `₹${Math.round(val)}`}
                </text>
              </g>
            );
          })}

          {/* Render Area or Bar chart */}
          {viewMode === "area" ? (
            <>
              {/* Revenue Area Fill */}
              {areaRevenuePath && (
                <path d={areaRevenuePath} fill="url(#revenueGradient)" />
              )}

              {/* Expenses Line */}
              <polyline
                fill="none"
                stroke="#ef4444"
                strokeWidth="2.5"
                strokeDasharray="4,4"
                points={expensesPoints}
              />

              {/* Revenue Line */}
              <polyline
                fill="none"
                stroke="#10b981"
                strokeWidth="3"
                points={revenuePoints}
              />

              {/* Data Node Points & Interaction Triggers */}
              {data.map((d, i) => {
                const cx = getX(i);
                const cyRev = getY(d.revenue);
                const cyExp = getY(d.expenses);
                const isHovered = hoveredIndex === i;

                return (
                  <g key={i}>
                    {/* Hover vertical guide line */}
                    {isHovered && (
                      <line
                        x1={cx}
                        y1={paddingTop}
                        x2={cx}
                        y2={paddingTop + chartHeight}
                        stroke="#94a3b8"
                        strokeDasharray="2,2"
                        strokeWidth="1.5"
                      />
                    )}

                    {/* Expenses circle */}
                    <circle
                      cx={cx}
                      cy={cyExp}
                      r={isHovered ? 5.5 : 4}
                      fill="#ef4444"
                      stroke="#ffffff"
                      strokeWidth="2"
                    />

                    {/* Revenue circle */}
                    <circle
                      cx={cx}
                      cy={cyRev}
                      r={isHovered ? 6.5 : 4.5}
                      fill="#10b981"
                      stroke="#ffffff"
                      strokeWidth="2.5"
                    />

                    {/* Invisible hover trigger strip */}
                    <rect
                      x={cx - 24}
                      y={paddingTop}
                      width={48}
                      height={chartHeight}
                      fill="transparent"
                      style={{ cursor: "pointer" }}
                      onMouseEnter={() => setHoveredIndex(i)}
                      onMouseLeave={() => setHoveredIndex(null)}
                    />
                  </g>
                );
              })}
            </>
          ) : (
            /* Bar Comparison View */
            data.map((d, i) => {
              const centerX = getX(i);
              const barWidth = 14;
              const revY = getY(d.revenue);
              const expY = getY(d.expenses);
              const baseY = paddingTop + chartHeight;
              const isHovered = hoveredIndex === i;

              return (
                <g key={i}>
                  {/* Revenue Bar */}
                  <rect
                    x={centerX - barWidth - 2}
                    y={revY}
                    width={barWidth}
                    height={Math.max(2, baseY - revY)}
                    rx="3"
                    fill="url(#barRevenueGrad)"
                    opacity={isHovered ? 1 : 0.88}
                  />

                  {/* Expenses Bar */}
                  <rect
                    x={centerX + 2}
                    y={expY}
                    width={barWidth}
                    height={Math.max(2, baseY - expY)}
                    rx="3"
                    fill="url(#barExpensesGrad)"
                    opacity={isHovered ? 1 : 0.88}
                  />

                  {/* Hover detector */}
                  <rect
                    x={centerX - 24}
                    y={paddingTop}
                    width={48}
                    height={chartHeight}
                    fill="transparent"
                    style={{ cursor: "pointer" }}
                    onMouseEnter={() => setHoveredIndex(i)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  />
                </g>
              );
            })
          )}

          {/* Month Labels on X Axis */}
          {data.map((d, i) => (
            <text
              key={i}
              x={getX(i)}
              y={svgHeight - 12}
              textAnchor="middle"
              fontSize="11"
              fill={hoveredIndex === i ? "#0f172a" : "#64748b"}
              fontWeight={hoveredIndex === i ? "700" : "500"}
            >
              {d.month}
            </text>
          ))}
        </svg>

        {/* Floating Tooltip Card */}
        {activePoint && hoveredIndex !== null && (
          <div
            className="chart-tooltip-floating"
            style={{
              left: `${(getX(hoveredIndex) / svgWidth) * 100}%`
            }}
          >
            <div className="tooltip-title">{activePoint.month} Summary</div>
            <div className="tooltip-row green">
              <span>Revenue:</span>
              <strong>{formatCurrency(activePoint.revenue)}</strong>
            </div>
            <div className="tooltip-row red">
              <span>Expenses:</span>
              <strong>{formatCurrency(activePoint.expenses)}</strong>
            </div>
            <div className="tooltip-divider" />
            <div className="tooltip-row net">
              <span>Net Margin:</span>
              <strong>{formatCurrency(activePoint.net)}</strong>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
