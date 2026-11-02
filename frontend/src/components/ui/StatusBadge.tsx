import { StatusPill } from "@/components/business/StatusPill";

export function StatusBadge({ value }: { value: string }) {
  return <StatusPill value={value} />;
}
