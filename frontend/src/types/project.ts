import type { Client } from "@/types/client";

export const PROJECT_STATUSES = [
  "opportunity",
  "planned",
  "active",
  "on_hold",
  "completed",
  "closed",
  "cancelled",
  "archived"
] as const;

export const PROJECT_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type ProjectPriority = (typeof PROJECT_PRIORITIES)[number];

export type Project = {
  id: string;
  client_id: string;
  project_code: string;
  project_name: string;
  project_type: string | null;
  description: string | null;
  status: ProjectStatus;
  start_date: string | null;
  target_end_date: string | null;
  actual_end_date: string | null;
  project_value: number;
  assigned_manager: string | null;
  priority: ProjectPriority;
  tags: string[] | null;
  notes: string | null;
  objectives: string | null;
  scope: string | null;
  assumptions: string | null;
  dependencies: string | null;
  exclusions: string | null;
  budget: number;
  closure_notes: string | null;
  client_accepted_at: string | null;
  closed_at: string | null;
  closure_override_reason: string | null;
  closed_by: string | null;
  reopened_at: string | null;
  reopened_by: string | null;
  reopen_reason: string | null;
  final_invoice_waived: boolean;
  deliverables_accepted: boolean;
  reimbursable_expenses_processed: boolean;
  required_documents_attached: boolean;
  archived_at: string | null;
  archived_by: string | null;
  updated_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  client?: Client | null;
};

export type ProjectFormData = {
  client_id: string;
  project_code: string;
  project_name: string;
  project_type: string;
  description: string;
  status: ProjectStatus;
  start_date: string;
  target_end_date: string;
  actual_end_date: string;
  project_value: number;
  assigned_manager: string;
  priority: ProjectPriority;
  tags: string;
  notes: string;
};

export type ProjectCreateInput = ProjectFormData & {
  created_by: string | null;
};

export type ProjectUpdateInput = Partial<ProjectFormData>;
