import type { Client } from "@/types/client";
import type { Project } from "@/types/project";
import type { Quotation } from "@/types/quotation";

export const CONTRACT_TYPES = [
  "onboarding",
  "maintenance",
  "sow",
  "nda",
  "change_request",
  "project_closure"
] as const;

export const CONTRACT_STATUSES = [
  "draft",
  "internal_review",
  "approved",
  "sent_for_signature",
  "active",
  "expired",
  "terminated",
  "renewed",
  "archived"
] as const;

export type ContractType = (typeof CONTRACT_TYPES)[number];
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export type Contract = {
  id: string;
  contract_number: string;
  client_id: string;
  project_id: string | null;
  quotation_id: string | null;
  contract_type: ContractType;
  title: string;
  start_date: string | null;
  end_date: string | null;
  status: ContractStatus;
  contract_value: number;
  renewal_required: boolean;
  renewal_date: string | null;
  content: string | null;
  terms_and_conditions: string | null;
  signed_file_url: string | null;
  approved_at: string | null;
  sent_for_signature_at: string | null;
  signed_at: string | null;
  termination_reason: string | null;
  notice_period_days: number | null;
  renewal_period_months: number | null;
  billing_schedule: string | null;
  scope: string | null;
  deliverables: string | null;
  archived_at: string | null;
  updated_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  client?: Client | null;
  project?: Project | null;
  quotation?: Quotation | null;
};

export type ContractFormData = {
  contract_number: string;
  client_id: string;
  project_id: string;
  quotation_id: string;
  contract_type: ContractType;
  title: string;
  start_date: string;
  end_date: string;
  status: ContractStatus;
  contract_value: number;
  renewal_required: boolean;
  renewal_date: string;
  content: string;
  terms_and_conditions: string;
  signed_file_url: string;
  billing_schedule?: string;
  scope?: string;
  deliverables?: string;
};

export type ContractCreateInput = ContractFormData & {
  created_by: string | null;
};

export type ContractUpdateInput = Partial<ContractFormData>;
