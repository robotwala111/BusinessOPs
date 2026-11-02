export type FinancialNoteType = "credit_note" | "debit_note";
export type FinancialNoteStatus = "draft" | "approved" | "issued" | "cancelled";
export type FinancialNote = { id:string; note_number:string; note_type:FinancialNoteType; invoice_id:string; note_date:string; reason:string; status:FinancialNoteStatus; base_amount:number; tax_rate:number; tax_amount:number; total_amount:number; override_reason:string|null; approved_at:string|null; issued_at:string|null; cancelled_at:string|null; cancellation_reason:string|null; created_by:string|null; updated_by:string|null; created_at:string; updated_at:string };

