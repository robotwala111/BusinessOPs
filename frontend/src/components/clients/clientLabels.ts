import type { ClientStatus } from "@/types/client";

export const clientStatusLabels: Record<ClientStatus, string> = {
  lead: "Lead",
  proposal_sent: "Proposal Sent",
  active: "Active",
  inactive: "Inactive",
  closed: "Closed",
  archived: "Archived"
};
