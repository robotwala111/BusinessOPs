"use client";

type Props = {
  collectionRate: number; // 0 - 100
  quoteWinRate: number; // 0 - 100
  activeSlaCount: number;
};

export function OperationalPulseGauges({ collectionRate, quoteWinRate, activeSlaCount }: Props) {
  return (
    <div className="operational-gauges-grid">
      <RadialGaugeCard
        title="Collection Efficiency"
        value={collectionRate}
        unit="%"
        subtitle="Realized income vs billed receivables"
        color="#10b981"
        badge={collectionRate >= 75 ? "Optimal" : "Follow-up"}
        badgeClass={collectionRate >= 75 ? "badge-success" : "badge-warning"}
      />
      <RadialGaugeCard
        title="Proposal Win Rate"
        value={quoteWinRate}
        unit="%"
        subtitle="Commercial acceptance conversion"
        color="#3b82f6"
        badge={quoteWinRate >= 50 ? "Strong" : "Pipeline Active"}
        badgeClass="badge-info"
      />
      <RadialGaugeCard
        title="Active SLA Health"
        value={activeSlaCount > 0 ? 100 : 0}
        unit="%"
        subtitle={`${activeSlaCount} SLA maintenance contracts covered`}
        color="#8b5cf6"
        badge="100% Up"
        badgeClass="badge-purple"
      />
    </div>
  );
}

function RadialGaugeCard({
  title,
  value,
  unit,
  subtitle,
  color,
  badge,
  badgeClass
}: {
  title: string;
  value: number;
  unit: string;
  subtitle: string;
  color: string;
  badge: string;
  badgeClass: string;
}) {
  const size = 94;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(100, Math.max(0, value));
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="radial-gauge-card">
      <div className="gauge-header">
        <span className="gauge-title">{title}</span>
        <span className={`gauge-badge ${badgeClass}`}>{badge}</span>
      </div>

      <div className="gauge-body">
        <div className="gauge-chart-wrapper">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {/* Background circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke="#f1f5f9"
              strokeWidth={strokeWidth}
            />
            {/* Value circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              style={{ transition: "stroke-dashoffset 800ms ease" }}
            />
          </svg>
          <div className="gauge-center-text">
            <strong>{value}</strong>
            <small>{unit}</small>
          </div>
        </div>

        <div className="gauge-text-side">
          <p className="gauge-subtext">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

