import { Badge } from "@/components/ui/Badge";
import { clientStatusLabels } from "@/components/clients/clientLabels";
import type { ClientStatus } from "@/types/client";

type ClientStatusBadgeProps = {
  status: ClientStatus;
};

export function ClientStatusBadge({ status }: ClientStatusBadgeProps) {
  return (
    <Badge className={`badge-status badge-${status}`}>
      {clientStatusLabels[status]}
    </Badge>
  );
}
