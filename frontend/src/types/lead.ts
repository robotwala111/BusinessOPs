import type { Client } from "@/types/client";

export const LEAD_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "proposal_planned",
  "converted",
  "lost"
] as const;

export const LEAD_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];
export type LeadPriority = (typeof LEAD_PRIORITIES)[number];

export type Lead = {
  id: string;
  lead_number: string;
  company_name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  location: string | null;
  lead_source: string | null;
  service_interested: string | null;
  status: LeadStatus;
  priority: LeadPriority;
  assigned_to: string | null;
  estimated_value: number;
  expected_close_date: string | null;
  follow_up_date: string | null;
  campaign: string | null;
  notes: string | null;
  lost_reason: string | null;
  converted_client_id: string | null;
  converted_contact_id: string | null;
  converted_project_id: string | null;
  converted_at: string | null;
  archived_at: string | null;
  archived_by: string | null;
  updated_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  converted_client?: Client | null;
};

export type LeadFormData = {
  lead_number: string;
  company_name: string;
  contact_person: string;
  email: string;
  phone: string;
  website: string;
  location: string;
  lead_source: string;
  service_interested: string;
  status: LeadStatus;
  priority: LeadPriority;
  assigned_to: string;
  estimated_value: number;
  expected_close_date: string;
  follow_up_date: string;
  campaign: string;
  notes: string;
  lost_reason: string;
};

export type LeadCreateInput = LeadFormData & {
  created_by: string | null;
};

export type LeadUpdateInput = Partial<LeadFormData>;
