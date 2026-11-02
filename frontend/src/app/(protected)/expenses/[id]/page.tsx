"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { StatusPill } from "@/components/business/StatusPill";
import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/hooks/useAuth";
import { allowedTransitions } from "@/lib/workflowRules";
import { expenseService } from "@/services/expenseService";
import { historyService } from "@/services/historyService";
import type { Expense, ExpenseStatus } from "@/types/expense";
import type { EntityHistory } from "@/types/workflow";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatDate } from "@/utils/formatDate";

export default function ExpenseDetailPage({ params }: { params: { id: string } }) {
  const { user } = useAuth();
  const [expense, setExpense] = useState<Expense | null>(null);
  const [history, setHistory] = useState<EntityHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => { setLoading(true); setError(""); try { const [record, events] = await Promise.all([expenseService.getExpenseById(params.id), historyService.list("expense", params.id)]); setExpense(record); setHistory(events); } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load expense."); } finally { setLoading(false); } }, [params.id]);
  useEffect(() => { void load(); }, [load]);
  async function transition(status: ExpenseStatus) { if (!expense) return; const needsReason = ["approved", "rejected", "cancelled"].includes(status); const comments = needsReason ? window.prompt(`${status.replace(/_/g, " ")} comments:`) : ""; if (needsReason && !comments?.trim()) return; try { await expenseService.transitionExpense(expense.id, status, user?.id ?? null, comments ?? ""); await load(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to update expense."); } }
  async function uploadReceipt(file?: File) { if (!expense || !file) return; setUploading(true); setError(""); try { const path = await expenseService.uploadReceipt(file); await expenseService.updateExpense(expense.id, { receipt_file_url: path }); await historyService.record({ entity_type: "expense", entity_id: expense.id, event_type: "receipt_uploaded", previous_value: null, new_value: { file_name: file.name, size: file.size }, description: "Expense receipt uploaded", actor_id: user?.id ?? null, metadata: {} }); await load(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to upload receipt."); } finally { setUploading(false); } }
  async function openReceipt() { if (!expense?.receipt_file_url) return; try { window.open(await expenseService.getReceiptUrl(expense.receipt_file_url), "_blank", "noopener,noreferrer"); } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to open receipt."); } }
  if (loading) return <div className="route-placeholder">Loading expense…</div>;
  if (!expense) return <div className="route-placeholder">{error || "Expense not found."}</div>;
  return <section className="module-page">
    <div className="module-header"><div><p className="eyebrow">Expense record</p><h1>{expense.expense_number}</h1><StatusPill value={expense.status} /></div><div className="module-actions"><BackButton fallbackHref="/expenses" />{allowedTransitions("expense", expense.status).map((status) => <Button key={status} variant="secondary" onClick={() => void transition(status as ExpenseStatus)}>{status.replace(/_/g, " ")}</Button>)}</div></div>
    {error ? <p className="form-error">{error}</p> : null}
    <div className="dashboard-grid"><Card className="metric-card"><span>Base amount</span><strong>{formatCurrency(expense.amount)}</strong></Card><Card className="metric-card"><span>GST / tax</span><strong>{formatCurrency(expense.tax_amount)}</strong></Card><Card className="metric-card"><span>Total</span><strong>{formatCurrency(expense.total_amount)}</strong></Card><Card className="metric-card"><span>Classification</span><strong>{expense.category.replace(/_/g, " ")}</strong></Card></div>
    <Card><h2>Expense overview</h2><div className="detail-grid"><Detail label="Vendor" value={expense.vendor_name} /><Detail label="Expense date" value={formatDate(expense.expense_date)} /><Detail label="Payment mode" value={expense.payment_mode} /><Detail label="GST number" value={expense.gst_number} /><Detail label="Reference" value={expense.project_or_reference} /><Detail label="Approval" value={expense.approval_status} /></div><p>{expense.description || expense.notes || "No additional description."}</p></Card>
    <Card><h2>Allocation</h2><div className="detail-grid"><Detail label="Client" value={expense.client?.company_name} /><Detail label="Project" value={expense.project?.project_name} /><Detail label="Billable" value={expense.billable_to_client ? "Yes" : "No"} /><Detail label="Reimbursable" value={expense.reimbursable ? "Yes" : "No"} /></div>{expense.client ? <Link href={`/clients/${expense.client.id}`}>Open Client 360°</Link> : null}{expense.project ? <> · <Link href={`/projects/${expense.project.id}`}>Open Project 360°</Link></> : null}</Card>
    <Card><h2>Receipt evidence</h2>{expense.receipt_file_url ? <Button variant="secondary" onClick={() => void openReceipt()}>Open receipt securely</Button> : <p className="muted">No receipt uploaded.</p>}{expense.status === "draft" ? <label>Upload {expense.receipt_file_url ? "new receipt version" : "receipt"}<input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" disabled={uploading} onChange={(event) => void uploadReceipt(event.target.files?.[0])} /><small>{uploading ? "Uploading…" : "PDF, PNG, JPG or WebP; maximum 10 MB."}</small></label> : null}</Card>
    <Card><h2>Approval and payment</h2><div className="detail-grid"><Detail label="Approved at" value={expense.approved_at ? formatDate(expense.approved_at) : null} /><Detail label="Paid at" value={expense.paid_at ? formatDate(expense.paid_at) : null} /><Detail label="Approval comments" value={expense.approval_comments} /><Detail label="Rejected at" value={expense.rejected_at ? formatDate(expense.rejected_at) : null} /></div></Card>
    <Card><h2>Activity timeline</h2>{history.length ? <ol className="timeline-list">{history.map((event) => <li key={event.id}><strong>{event.description}</strong><span>{formatDate(event.created_at)}</span></li>)}</ol> : <p className="muted">No history events yet.</p>}</Card>
  </section>;
}
function Detail({ label, value }: { label: string; value?: string | null }) { return <div className="detail-item"><span>{label}</span><strong>{value || "-"}</strong></div>; }
