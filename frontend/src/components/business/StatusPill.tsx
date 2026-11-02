import { Badge } from "@/components/ui/Badge";

export function StatusPill({ value }: { value: string }) {
  return <Badge className={`badge-${value}`}>{value.replace(/_/g, " ")}</Badge>;
}
