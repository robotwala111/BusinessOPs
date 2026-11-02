import type { QuotationStatus } from "@/types/quotation";

export const quotationStatusLabels: Record<QuotationStatus, string> = {
  draft: "Draft",
  under_review: "Under Review",
  approved: "Approved",
  sent: "Sent",
  accepted: "Accepted",
  rejected: "Rejected",
  expired: "Expired",
  superseded: "Superseded"
};
