import type { Client } from "@/types/client";
import type { Contract } from "@/types/contract";
import type { Project } from "@/types/project";
import type { Quotation } from "@/types/quotation";

export const INVOICE_STATUSES = [
  "draft",
  "approved",
  "issued",
  "partially_paid",
  "paid",
  "overdue",
  "cancelled",
  "written_off"
] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export type Invoice = {
  id: string;
  invoice_number: string;
  client_id: string;
  project_id: string | null;
  quotation_id: string | null;
  contract_id: string | null;
  invoice_date: string;
  due_date: string | null;
  status: InvoiceStatus;
  subtotal: number;
  discount_amount: number;
  tax_percentage: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  tds_amount: number;
  credit_applied: number;
  debit_applied: number;
  rounding_amount: number;
  document_type: string;
  milestone_id: string | null;
  issue_date: string | null;
  place_of_supply: string | null;
  tax_type: "cgst_sgst" | "igst" | "none" | null;
  cancellation_reason: string | null;
  write_off_reason: string | null;
  archived_at: string | null;
  updated_by: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  client?: Client | null;
  project?: Project | null;
  quotation?: Quotation | null;
  contract?: Contract | null;
  payments?: Payment[];
  items?: InvoiceItem[];
};

export type Payment = {
  id: string;
  invoice_id: string;
  payment_date: string;
  amount: number;
  bank_reference: string | null;
  withholding_amount: number;
  adjustment_amount: number;
  evidence_path: string | null;
  reversed_at: string | null;
  reversal_reason: string | null;
  reversed_by: string | null;
  payment_mode: string | null;
  transaction_reference: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

export type InvoiceItem = {
  id: string; invoice_id: string; description: string; hsn_sac: string | null;
  unit: string | null; quantity: number; unit_price: number; discount_rate: number;
  discount_amount: number; taxable_amount: number; tax_rate: number; tax_amount: number;
  line_total: number; sort_order: number; created_at: string; updated_at: string;
};

export type InvoiceFormData = {
  invoice_number: string;
  client_id: string;
  project_id: string;
  quotation_id: string;
  contract_id: string;
  milestone_id?: string;
  invoice_date: string;
  due_date: string;
  status: InvoiceStatus;
  subtotal: number;
  discount_amount: number;
  tax_percentage: number;
  notes: string;
};

export type PaymentFormData = {
  payment_date: string;
  amount: number;
  payment_mode: string;
  transaction_reference: string;
  bank_reference?: string;
  withholding_amount?: number;
  adjustment_amount?: number;
  evidence_path?: string;
  notes: string;
};

export type InvoiceCreateInput = InvoiceFormData & {
  created_by: string | null;
};

export type InvoiceUpdateInput = Partial<InvoiceFormData>;

export type PaymentCreateInput = PaymentFormData & {
  invoice_id: string;
  created_by: string | null;
};
