import { Badge } from "@/components/ui/Badge";
import { quotationStatusLabels } from "@/components/quotations/quotationLabels";
import type { QuotationStatus } from "@/types/quotation";

export function QuotationStatusBadge({ status }: { status: QuotationStatus }) {
  return (
    <Badge className={`badge-${status}`}>
      {quotationStatusLabels[status]}
    </Badge>
  );
}
