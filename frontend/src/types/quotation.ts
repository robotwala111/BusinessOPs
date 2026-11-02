import type { Client } from "@/types/client";
import type { Project } from "@/types/project";

export const QUOTATION_STATUSES = [
  "draft",
  "under_review",
  "approved",
  "sent",
  "accepted",
  "rejected",
  "expired",
  "superseded"
] as const;

export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];

export type QuotationItem = {
  id: string;
  quotation_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  unit: string | null;
  hsn_sac: string | null;
  discount_rate: number;
  discount_amount: number;
  taxable_amount: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type Quotation = {
  id: string;
  quotation_number: string;
  client_id: string;
  project_id: string | null;
  title: string;
  quotation_date: string;
  valid_until: string | null;
  status: QuotationStatus;
  revision_number: number;
  parent_quotation_id: string | null;
  reviewed_at: string | null;
  approved_at: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  superseded_at: string | null;
  rejected_reason: string | null;
  return_to_draft_reason: string | null;
  generated_contract_id: string | null;
  generated_project_id: string | null;
  place_of_supply: string | null;
  tax_type: "cgst_sgst" | "igst" | "none" | null;
  rounding_amount: number;
  archived_at: string | null;
  updated_by: string | null;
  subtotal: number;
  discount_rate: number;
  discount_amount: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  project_overview: string | null;
  scope_of_work: string | null;
  tech_stack: string | null;
  project_timeline: string | null;
  payment_terms: string | null;
  support_and_maintenance: string | null;
  notes: string | null;
  terms_and_conditions: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  client?: Client | null;
  project?: Project | null;
  items: QuotationItem[];
};

export type QuotationItemFormData = {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  unit?: string;
  hsn_sac?: string;
  discount_rate?: number;
};

export type QuotationFormData = {
  quotation_number: string;
  client_id: string;
  project_id: string;
  title: string;
  quotation_date: string;
  valid_until: string;
  status: QuotationStatus;
  discount_rate: number;
  tax_rate: number;
  project_overview: string;
  scope_of_work: string;
  tech_stack: string;
  project_timeline: string;
  payment_terms: string;
  support_and_maintenance: string;
  notes: string;
  terms_and_conditions: string;
  items: QuotationItemFormData[];
};

export type QuotationCreateInput = QuotationFormData & {
  created_by: string | null;
};

export type QuotationUpdateInput = Partial<QuotationFormData>;

export type QuotationTotals = {
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
};
