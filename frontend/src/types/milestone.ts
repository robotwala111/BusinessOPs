export const MILESTONE_STATUSES = [
  "planned", "in_progress", "ready_for_review", "accepted", "invoiced", "cancelled"
] as const;

export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

export type ProjectMilestone = {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  deliverable: string | null;
  owner_id: string | null;
  status: MilestoneStatus;
  planned_date: string | null;
  actual_completion_date: string | null;
  billing_percentage: number | null;
  billing_amount: number | null;
  acceptance_required: boolean;
  completion_evidence: string | null;
  internal_notes: string | null;
  client_accepted_at: string | null;
  invoice_id: string | null;
  override_reason: string | null;
  created_by: string | null;
  updated_by: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectMilestoneFormData = {
  project_id: string;
  name: string;
  description: string;
  deliverable: string;
  owner_id: string;
  status: MilestoneStatus;
  planned_date: string;
  billing_percentage: number | null;
  billing_amount: number | null;
  acceptance_required: boolean;
  completion_evidence: string;
  internal_notes: string;
};

