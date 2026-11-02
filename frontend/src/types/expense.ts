import type { Client } from "@/types/client";
import type { Project } from "@/types/project";

export const EXPENSE_CATEGORIES = [
  "cloud",
  "hosting",
  "domain",
  "software_subscription",
  "freelancer",
  "salary",
  "marketing",
  "travel",
  "hardware",
  "office",
  "miscellaneous"
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export const EXPENSE_STATUSES = ["draft", "submitted", "approved", "rejected", "paid", "cancelled"] as const;
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

export type Expense = {
  id: string;
  expense_number: string;
  expense_date: string;
  category: ExpenseCategory;
  vendor_name: string | null;
  client_id: string | null;
  project_id: string | null;
  project_or_reference: string | null;
  amount: number;
  tax_amount: number;
  total_amount: number;
  payment_mode: string | null;
  receipt_file_url: string | null;
  billable_to_client: boolean;
  reimbursable: boolean;
  approval_status: string;
  status: ExpenseStatus;
  description: string | null;
  gst_number: string | null;
  approval_comments: string | null;
  rejected_at: string | null;
  paid_at: string | null;
  archived_at: string | null;
  updated_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  client?: Client | null;
  project?: Project | null;
};

export type ExpenseFormData = {
  expense_number: string;
  expense_date: string;
  category: ExpenseCategory;
  vendor_name: string;
  client_id: string;
  project_id: string;
  project_or_reference: string;
  amount: number;
  tax_amount: number;
  payment_mode: string;
  receipt_file_url: string;
  billable_to_client: boolean;
  reimbursable: boolean;
  approval_status: string;
  notes: string;
};

export type ExpenseCreateInput = ExpenseFormData & {
  created_by: string | null;
};

export type ExpenseUpdateInput = Partial<ExpenseFormData>;
