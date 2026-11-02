"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { StatusPill } from "@/components/business/StatusPill";
import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Table } from "@/components/ui/Table";
import { useAuth } from "@/hooks/useAuth";
import { allowedTransitions } from "@/lib/workflowRules";
import { historyService } from "@/services/historyService";
import { financialNoteService } from "@/services/financialNoteService";
import { invoiceService } from "@/services/invoiceService";
import { paymentService } from "@/services/paymentService";
import type { Invoice, PaymentFormData } from "@/types/invoice";
import type { FinancialNote, FinancialNoteType } from "@/types/financialNote";
import type { EntityHistory } from "@/types/workflow";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatDate } from "@/utils/formatDate";

const emptyPayment: PaymentFormData = {
  payment_date: new Date().toISOString().slice(0, 10),
  amount: 0,
  payment_mode: "",
  transaction_reference: "",
  bank_reference: "",
  withholding_amount: 0,
  adjustment_amount: 0,
  evidence_path: "",
  notes: "",
};

export function InvoiceDetailPage({ invoiceId }: { invoiceId: string }) {
  const { user } = useAuth();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [history, setHistory] = useState<EntityHistory[]>([]);
  const [payment, setPayment] = useState(emptyPayment);
  const [paymentEvidence, setPaymentEvidence] = useState<File | null>(null);
  const [savingPayment, setSavingPayment] = useState(false);
  const [notes, setNotes] = useState<FinancialNote[]>([]);
  const [noteForm, setNoteForm] = useState({
    type: "credit_note" as FinancialNoteType,
    reason: "",
    baseAmount: 0,
    taxRate: 18,
    overrideReason: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextInvoice, nextHistory, nextNotes] = await Promise.all([
        invoiceService.getInvoiceById(invoiceId),
        historyService.list("invoice", invoiceId),
        financialNoteService.list(invoiceId),
      ]);
      setInvoice(nextInvoice);
      setHistory(nextHistory);
      setNotes(nextNotes);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to load invoice.",
      );
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);
  useEffect(() => {
    void load();
  }, [load]);
  async function transition(status: Invoice["status"]) {
    if (!invoice) return;
    const reason = ["cancelled", "written_off"].includes(status)
      ? window.prompt("Mandatory reason:")
      : "";
    if (["cancelled", "written_off"].includes(status) && !reason?.trim())
      return;
    try {
      await invoiceService.transitionInvoice(
        invoice.id,
        status,
        user?.id ?? null,
        reason ?? "",
      );
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to update invoice.",
      );
    }
  }
  async function addPayment(event: FormEvent) {
    event.preventDefault();
    if (!invoice) return;
    setSavingPayment(true);
    setError("");
    try {
      const evidencePath = paymentEvidence
        ? await paymentService.uploadEvidence(paymentEvidence)
        : "";
      await paymentService.addPayment({
        ...payment,
        evidence_path: evidencePath,
        invoice_id: invoice.id,
        created_by: user?.id ?? null,
      });
      setPayment(emptyPayment);
      setPaymentEvidence(null);
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to record payment.",
      );
    } finally {
      setSavingPayment(false);
    }
  }
  async function openPaymentEvidence(path: string) {
    try {
      window.open(
        await paymentService.getEvidenceUrl(path),
        "_blank",
        "noopener,noreferrer",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to open payment evidence.",
      );
    }
  }
  async function createNote(event: FormEvent) {
    event.preventDefault();
    if (!invoice) return;
    try {
      await financialNoteService.create({
        invoiceId: invoice.id,
        type: noteForm.type,
        reason: noteForm.reason,
        baseAmount: noteForm.baseAmount,
        taxRate: noteForm.taxRate,
        eligibleBalance: invoice.balance_due,
        overrideReason: noteForm.overrideReason,
        userId: user?.id ?? null,
      });
      setNoteForm({
        type: "credit_note",
        reason: "",
        baseAmount: 0,
        taxRate: 18,
        overrideReason: "",
      });
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to create financial note.",
      );
    }
  }
  async function transitionNote(
    note: FinancialNote,
    status: FinancialNote["status"],
  ) {
    const reason =
      status === "cancelled"
        ? window.prompt("Mandatory cancellation reason:")
        : "";
    if (status === "cancelled" && !reason?.trim()) return;
    try {
      await financialNoteService.transition(
        note,
        status,
        user?.id ?? null,
        reason ?? "",
      );
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to update financial note.",
      );
    }
  }
  if (loading)
    return <div className="route-placeholder">Loading invoice...</div>;
  if (!invoice)
    return (
      <div className="route-placeholder">{error || "Invoice not found."}</div>
    );
  return (
    <section className="module-page">
      <div className="module-header">
        <div>
          <p className="eyebrow">Invoice</p>
          <h1>{invoice.invoice_number}</h1>
          <StatusPill value={invoice.status} />
        </div>
        <div className="module-actions">
          <BackButton fallbackHref="/invoices" />
          <Button
            onClick={() =>
              void import("@/utils/pdf/generateInvoicePdf").then(
                ({ generateInvoicePdf }) => generateInvoicePdf(invoice),
              )
            }
          >
            Download PDF
          </Button>
          {allowedTransitions("invoice", invoice.status).map((status) => (
            <Button
              key={status}
              variant="secondary"
              onClick={() => void transition(status as Invoice["status"])}
            >
              {status.replace(/_/g, " ")}
            </Button>
          ))}
        </div>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="dashboard-grid">
        <Metric label="Total" value={formatCurrency(invoice.total_amount)} />
        <Metric label="Paid" value={formatCurrency(invoice.amount_paid)} />
        <Metric label="TDS" value={formatCurrency(invoice.tds_amount)} />
        <Metric
          label="Credits"
          value={formatCurrency(invoice.credit_applied || 0)}
        />
        <Metric
          label="Debits"
          value={formatCurrency(invoice.debit_applied || 0)}
        />
        <Metric
          label="Outstanding"
          value={formatCurrency(invoice.balance_due)}
        />
      </div>
      <Card>
        <div className="detail-grid">
          <Detail label="Client" value={invoice.client?.company_name} />
          <Detail
            label="Invoice date"
            value={formatDate(invoice.invoice_date)}
          />
          <Detail
            label="Due date"
            value={invoice.due_date ? formatDate(invoice.due_date) : null}
          />
          <Detail
            label="Document type"
            value={invoice.document_type?.replace(/_/g, " ")}
          />
        </div>
      </Card>
      {!["draft", "cancelled", "written_off"].includes(invoice.status) ? (
        <Card>
          <form className="client-form" onSubmit={createNote}>
            <h2>Create invoice correction</h2>
            <p className="muted">
              Issued invoices remain unchanged. Credit and debit notes adjust
              only the outstanding balance after approval and issue.
            </p>
            <div className="form-grid two-columns">
              <label>
                Document type
                <select
                  value={noteForm.type}
                  onChange={(event) =>
                    setNoteForm({
                      ...noteForm,
                      type: event.target.value as FinancialNoteType,
                    })
                  }
                >
                  <option value="credit_note">Credit note</option>
                  <option value="debit_note">Debit note</option>
                </select>
              </label>
              <label>
                Taxable adjustment
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={noteForm.baseAmount}
                  onChange={(event) =>
                    setNoteForm({
                      ...noteForm,
                      baseAmount: Number(event.target.value),
                    })
                  }
                />
              </label>
              <label>
                Tax rate %
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={noteForm.taxRate}
                  onChange={(event) =>
                    setNoteForm({
                      ...noteForm,
                      taxRate: Number(event.target.value),
                    })
                  }
                />
              </label>
              <label>
                Reason
                <Input
                  required
                  value={noteForm.reason}
                  onChange={(event) =>
                    setNoteForm({ ...noteForm, reason: event.target.value })
                  }
                />
              </label>
              {noteForm.type === "credit_note" ? (
                <label>
                  Excess-credit override reason
                  <Input
                    value={noteForm.overrideReason}
                    onChange={(event) =>
                      setNoteForm({
                        ...noteForm,
                        overrideReason: event.target.value,
                      })
                    }
                  />
                </label>
              ) : null}
            </div>
            <div className="form-actions">
              <Button type="submit">Create draft note</Button>
            </div>
          </form>
        </Card>
      ) : null}
      <Card>
        <h2>Credit and debit notes</h2>
        {notes.length ? (
          <Table>
            <thead>
              <tr>
                <th>Number</th>
                <th>Type</th>
                <th>Reason</th>
                <th>Total</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {notes.map((note) => (
                <tr key={note.id}>
                  <td>
                    {note.note_number}
                    <small>{formatDate(note.note_date)}</small>
                  </td>
                  <td>{note.note_type.replace("_", " ")}</td>
                  <td>{note.reason}</td>
                  <td>{formatCurrency(note.total_amount)}</td>
                  <td>
                    <StatusPill value={note.status} />
                  </td>
                  <td>
                    <div className="table-actions">
                      {note.status === "draft" ? (
                        <button
                          className="link-button"
                          onClick={() => void transitionNote(note, "approved")}
                        >
                          Approve
                        </button>
                      ) : null}
                      {note.status === "approved" ? (
                        <button
                          className="link-button"
                          onClick={() => void transitionNote(note, "issued")}
                        >
                          Issue
                        </button>
                      ) : null}
                      {note.status !== "cancelled" ? (
                        <button
                          className="link-button danger-link"
                          onClick={() => void transitionNote(note, "cancelled")}
                        >
                          Cancel
                        </button>
                      ) : null}
                      <button
                        className="link-button"
                        onClick={() =>
                          void import(
                            "@/utils/pdf/generateFinancialNotePdf"
                          ).then(({ generateFinancialNotePdf }) =>
                            generateFinancialNotePdf(note, invoice),
                          )
                        }
                      >
                        PDF
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <p className="muted">No correction documents.</p>
        )}
      </Card>
      {!["draft", "cancelled", "written_off", "paid"].includes(
        invoice.status,
      ) ? (
        <Card>
          <form className="client-form" onSubmit={addPayment}>
            <h2>Record immutable payment</h2>
            <div className="form-grid two-columns">
              <label>
                Date
                <Input
                  type="date"
                  value={payment.payment_date}
                  onChange={(e) =>
                    setPayment({ ...payment, payment_date: e.target.value })
                  }
                />
              </label>
              <label>
                Amount
                <Input
                  type="number"
                  value={payment.amount}
                  onChange={(e) =>
                    setPayment({ ...payment, amount: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                TDS/Input withholding
                <Input
                  type="number"
                  value={payment.withholding_amount}
                  onChange={(e) =>
                    setPayment({
                      ...payment,
                      withholding_amount: Number(e.target.value),
                    })
                  }
                />
              </label>
              <label>
                Method
                <Input
                  value={payment.payment_mode}
                  onChange={(e) =>
                    setPayment({ ...payment, payment_mode: e.target.value })
                  }
                />
              </label>
              <label>
                Transaction reference
                <Input
                  value={payment.transaction_reference}
                  onChange={(e) =>
                    setPayment({
                      ...payment,
                      transaction_reference: e.target.value,
                    })
                  }
                />
              </label>
              <label>
                Bank reference
                <Input
                  value={payment.bank_reference}
                  onChange={(e) =>
                    setPayment({ ...payment, bank_reference: e.target.value })
                  }
                />
              </label>
              <label>
                Payment evidence
                <input
                  type="file"
                  accept="application/pdf,image/png,image/jpeg,image/webp"
                  onChange={(event) =>
                    setPaymentEvidence(event.target.files?.[0] ?? null)
                  }
                />
                <small>Optional PDF, PNG, JPG or WebP; maximum 10 MB.</small>
              </label>
              <label>
                Notes
                <Input
                  value={payment.notes}
                  onChange={(event) =>
                    setPayment({ ...payment, notes: event.target.value })
                  }
                />
              </label>
            </div>
            <div className="form-actions">
              <Button type="submit" disabled={savingPayment}>
                {savingPayment ? "Recording…" : "Record payment"}
              </Button>
            </div>
          </form>
        </Card>
      ) : null}
      <Card>
        <h2>Payment history</h2>
        {invoice.payments?.length ? (
          <Table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Amount</th>
                <th>TDS</th>
                <th>Reference</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {invoice.payments.map((item) => (
                <tr key={item.id}>
                  <td>{formatDate(item.payment_date)}</td>
                  <td>{formatCurrency(item.amount)}</td>
                  <td>{formatCurrency(item.withholding_amount)}</td>
                  <td>
                    {item.transaction_reference || item.bank_reference || "-"}
                  </td>
                  <td>{item.reversed_at ? "Reversed" : "Valid"}</td>
                  <td>
                    <div className="table-actions">
                      {item.evidence_path ? (
                        <button
                          className="link-button"
                          onClick={() =>
                            void openPaymentEvidence(item.evidence_path!)
                          }
                        >
                          Evidence
                        </button>
                      ) : null}
                      {!item.reversed_at ? (
                        <button
                          className="link-button danger-link"
                          onClick={() => {
                            const reason = window.prompt(
                              "Mandatory reversal reason:",
                            );
                            if (reason?.trim())
                              void paymentService
                                .reversePayment(item, reason, user?.id ?? null)
                                .then(load)
                                .catch((caught) =>
                                  setError(
                                    caught instanceof Error
                                      ? caught.message
                                      : "Unable to reverse payment.",
                                  ),
                                );
                          }}
                        >
                          Reverse
                        </button>
                      ) : (
                        "-"
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <p className="muted">No payments.</p>
        )}
      </Card>
      <Card>
        <h2>History</h2>
        {history.length ? (
          <ul>
            {history.map((item) => (
              <li key={item.id}>
                {formatDate(item.created_at)} — {item.description}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No events recorded.</p>
        )}
      </Card>
    </section>
  );
}
function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="detail-item">
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </Card>
  );
}
