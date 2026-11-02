import { Card } from "@/components/ui/Card";

export function StatCard({ label, value }: { label: string; value: string | number }) {
  return <Card className="metric-card"><span>{label}</span><strong>{value}</strong></Card>;
}
