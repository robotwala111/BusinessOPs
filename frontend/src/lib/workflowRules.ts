export type WorkflowName =
  | "lead"
  | "project"
  | "quotation"
  | "contract"
  | "milestone"
  | "invoice"
  | "expense"
  | "maintenance"
  | "ticket";

const transitions: Record<WorkflowName, Record<string, readonly string[]>> = {
  lead: {
    new: ["contacted", "lost"],
    contacted: ["qualified", "lost"],
    qualified: ["proposal_planned", "lost"],
    proposal_planned: ["converted", "lost"],
    converted: [],
    lost: ["contacted"]
  },
  project: {
    opportunity: ["planned", "cancelled"],
    planned: ["active", "on_hold", "cancelled"],
    active: ["on_hold", "completed", "cancelled"],
    on_hold: ["active", "cancelled"],
    completed: ["closed", "active"],
    closed: ["archived"],
    cancelled: ["archived"],
    archived: []
  },
  quotation: {
    draft: ["under_review"],
    under_review: ["draft", "approved", "rejected"],
    approved: ["sent", "draft"],
    sent: ["accepted", "rejected", "expired", "superseded"],
    accepted: [],
    rejected: ["superseded"],
    expired: ["superseded"],
    superseded: []
  },
  contract: {
    draft: ["internal_review"],
    internal_review: ["draft", "approved"],
    approved: ["sent_for_signature"],
    sent_for_signature: ["active", "draft"],
    active: ["expired", "terminated", "renewed"],
    expired: ["renewed", "archived"],
    terminated: ["archived"],
    renewed: ["archived"],
    archived: []
  },
  milestone: {
    planned: ["in_progress", "cancelled"],
    in_progress: ["ready_for_review", "cancelled"],
    ready_for_review: ["in_progress", "accepted"],
    accepted: ["invoiced"],
    invoiced: [],
    cancelled: []
  },
  invoice: {
    draft: ["approved", "cancelled"],
    approved: ["issued", "draft", "cancelled"],
    issued: ["partially_paid", "paid", "overdue", "cancelled", "written_off"],
    partially_paid: ["paid", "overdue", "written_off"],
    paid: [],
    overdue: ["partially_paid", "paid", "written_off"],
    cancelled: [],
    written_off: []
  },
  expense: {
    draft: ["submitted", "cancelled"],
    submitted: ["approved", "rejected", "draft"],
    approved: ["paid", "cancelled"],
    rejected: ["draft", "cancelled"],
    paid: [],
    cancelled: []
  },
  maintenance: {
    draft: ["active", "cancelled"],
    active: ["expiring", "expired", "cancelled"],
    expiring: ["renewed", "expired", "cancelled"],
    renewed: ["archived"],
    expired: ["renewed", "archived"],
    cancelled: ["archived"],
    archived: []
  },
  ticket: {
    new: ["assigned", "cancelled"],
    assigned: ["in_progress", "cancelled"],
    in_progress: ["waiting_for_client", "resolved", "cancelled"],
    waiting_for_client: ["in_progress", "resolved", "cancelled"],
    resolved: ["closed", "reopened"],
    closed: ["reopened"],
    reopened: ["assigned", "in_progress", "cancelled"],
    cancelled: []
  }
};

export function allowedTransitions(workflow: WorkflowName, currentStatus: string) {
  return transitions[workflow][currentStatus] ?? [];
}

export function canTransition(workflow: WorkflowName, from: string, to: string) {
  return allowedTransitions(workflow, from).includes(to);
}

export function assertTransition(workflow: WorkflowName, from: string, to: string) {
  if (!canTransition(workflow, from, to)) {
    throw new Error(`Invalid ${workflow} status transition: ${from} -> ${to}.`);
  }
}

