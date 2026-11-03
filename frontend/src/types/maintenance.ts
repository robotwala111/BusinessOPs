import type { Client } from "@/types/client";
import type { Contract } from "@/types/contract";
import type { Profile } from "@/types/auth";
import type { Project } from "@/types/project";

export const MAINTENANCE_STATUSES = ["draft", "active", "expiring", "renewed", "expired", "cancelled"] as const;
export const TICKET_STATUSES = [
  "new",
  "assigned",
  "in_progress",
  "waiting_for_client",
  "resolved",
  "closed",
  "reopened",
  "cancelled"
] as const;
export const TICKET_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export type MaintenanceStatus = (typeof MAINTENANCE_STATUSES)[number];
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export type MaintenanceContract = {
  id: string;
  client_id: string;
  project_id: string | null;
  contract_id: string | null;
  plan_name: string;
  start_date: string | null;
  end_date: string | null;
  monthly_fee: number;
  yearly_fee: number;
  included_hours: number;
  response_sla_hours: number | null;
  resolution_sla_hours: number | null;
  billing_schedule: string | null;
  renewed_from_id: string | null;
  archived_at: string | null;
  updated_by: string | null;
  status: MaintenanceStatus;
  renewal_date: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  client?: Client | null;
  project?: Project | null;
  contract?: Contract | null;
};

export type SupportTicket = {
  id: string;
  ticket_number: string;
  client_id: string;
  project_id: string | null;
  maintenance_contract_id: string | null;
  title: string;
  description: string | null;
  priority: TicketPriority;
  status: TicketStatus;
  assigned_to: string | null;
  resolution_notes: string | null;
  severity: string | null;
  response_deadline: string | null;
  resolution_deadline: string | null;
  first_responded_at: string | null;
  resolved_at: string | null;
  reopening_reason: string | null;
  internal_notes: string | null;
  client_visible_notes: string | null;
  archived_at: string | null;
  updated_by: string | null;
  opened_at: string;
  closed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  client?: Client | null;
  project?: Project | null;
  maintenance_contract?: MaintenanceContract | null;
  assignee?: Profile | null;
};

export type MaintenanceContractFormData = {
  client_id: string;
  project_id: string;
  contract_id: string;
  plan_name: string;
  start_date: string;
  end_date: string;
  monthly_fee: number;
  yearly_fee: number;
  included_hours: number;
  response_sla_hours?: number | null;
  resolution_sla_hours?: number | null;
  status: MaintenanceStatus;
  renewal_date: string;
  notes: string;
};

export type SupportTicketFormData = {
  ticket_number: string;
  client_id: string;
  project_id: string;
  maintenance_contract_id: string;
  title: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  assigned_to: string;
  resolution_notes: string;
};
