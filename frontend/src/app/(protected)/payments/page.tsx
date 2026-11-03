"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ModuleScaffold } from "@/components/business/ModuleScaffold";
import { Card } from "@/components/ui/Card";
import { Table } from "@/components/ui/Table";
import { paymentService } from "@/services/paymentService";
import { invoiceService } from "@/services/invoiceService";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatDate } from "@/utils/formatDate";
import { useAuth } from "@/hooks/useAuth";
import type { Invoice, Payment } from "@/types/invoice";

export default function PaymentsPage() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [modeFilter, setModeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "reversed">("all");

  // Record Payment Modal
  const [showModal, setShowModal] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMode, setPaymentMode] = useState("NEFT / RTGS");
  const [transactionRef, setTransactionRef] = useState("");
  const [bankRef, setBankRef] = useState("");
  const [tdsAmount, setTdsAmount] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [modalError, setModalError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reversal Modal
  const [reversalPayment, setReversalPayment] = useState<Payment | null>(null);
  const [reversalReason, setReversalReason] = useState("");

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setErrorMessage("");
      try {
        const [payList, invList] = await Promise.all([
          paymentService.getAllPayments(),
          invoiceService.getInvoices()
        ]);
        setPayments(payList);
        setInvoices(invList);
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Unable to load payments.");
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, []);

  const invoicesById = useMemo(() => {
    return new Map(invoices.map((inv) => [inv.id, inv]));
  }, [invoices]);

  const unpaidInvoices = useMemo(() => {
    return invoices.filter((inv) => inv.balance_due > 0);
  }, [invoices]);

  function openRecordModal(invoice?: Invoice) {
    if (invoice) {
      setSelectedInvoiceId(invoice.id);
      setAmount(invoice.balance_due);
    } else if (unpaidInvoices.length > 0) {
      setSelectedInvoiceId(unpaidInvoices[0].id);
      setAmount(unpaidInvoices[0].balance_due);
    }
    setModalError("");
    setShowModal(true);
  }

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    setModalError("");

    if (!selectedInvoiceId) {
      setModalError("Please select an invoice.");
      return;
    }
    if (amount <= 0) {
      setModalError("Payment amount must be greater than zero.");
      return;
    }

    setIsSubmitting(true);
    try {
      await paymentService.addPayment({
        invoice_id: selectedInvoiceId,
        payment_date: paymentDate,
        amount,
        payment_mode: paymentMode,
        transaction_reference: transactionRef,
        bank_reference: bankRef,
        withholding_amount: tdsAmount,
        adjustment_amount: 0,
        notes,
        created_by: user?.id || null
      });

      // Reload
      const [payList, invList] = await Promise.all([
        paymentService.getAllPayments(),
        invoiceService.getInvoices()
      ]);
      setPayments(payList);
      setInvoices(invList);
      setShowModal(false);
      setTransactionRef("");
      setBankRef("");
      setNotes("");
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Error recording payment.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReversePayment(e: React.FormEvent) {
    e.preventDefault();
    if (!reversalPayment || !reversalReason.trim()) return;

    try {
      await paymentService.reversePayment(reversalPayment, reversalReason.trim(), user?.id || null);
      setReversalPayment(null);
      setReversalReason("");
      const [payList, invList] = await Promise.all([
        paymentService.getAllPayments(),
        invoiceService.getInvoices()
      ]);
      setPayments(payList);
      setInvoices(invList);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error reversing payment");
    }
  }

  // Filtered payments
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const inv = invoicesById.get(p.invoice_id);
      const clientName = inv?.client?.company_name || "";
      const invNum = inv?.invoice_number || "";
      const q = searchTerm.toLowerCase();

      const matchesSearch =
        !searchTerm ||
        clientName.toLowerCase().includes(q) ||
        invNum.toLowerCase().includes(q) ||
        (p.transaction_reference && p.transaction_reference.toLowerCase().includes(q));

      const matchesMode = modeFilter === "all" || p.payment_mode === modeFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && !p.reversed_at) ||
        (statusFilter === "reversed" && Boolean(p.reversed_at));

      return matchesSearch && matchesMode && matchesStatus;
    });
  }, [payments, invoicesById, searchTerm, modeFilter, statusFilter]);

  // Aggregate stats
  const activePayments = payments.filter((p) => !p.reversed_at);
  const totalCollected = activePayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const totalTds = activePayments.reduce((sum, p) => sum + (Number(p.withholding_amount) || 0), 0);

  function exportCSV() {
    const headers = ["Payment Date", "Invoice #", "Client", "Amount", "TDS Withheld", "Mode", "Reference", "Status"];
    const rows = filteredPayments.map((p) => {
      const inv = invoicesById.get(p.invoice_id);
      return [
        p.payment_date,
        inv?.invoice_number || p.invoice_id,
        `"${inv?.client?.company_name || ""}"`,
        p.amount,
        p.withholding_amount,
        `"${p.payment_mode || ""}"`,
        `"${p.transaction_reference || ""}"`,
        p.reversed_at ? "Reversed" : "Cleared"
      ].join(",");
    });
    const blob = new Blob([[headers.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payments-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <ModuleScaffold
      title="Payments Ledger"
      eyebrow="Finance & Settlements"
      description="Record inward customer settlements, reconcile TDS certificates, and track payment receipts."
      errorMessage={errorMessage}
      isLoading={isLoading}
      isEmpty={false}
    >
      {/* Top Action & KPI Deck */}
      <div className="payments-kpi-deck">
        <div className="payment-stat-card">
          <span className="stat-label">Total Realized Inflow</span>
          <strong className="stat-value text-emerald">{formatCurrency(totalCollected)}</strong>
          <small className="stat-sub">{activePayments.length} Settled Receipts</small>
        </div>

        <div className="payment-stat-card">
          <span className="stat-label">TDS / Tax Withholding</span>
          <strong className="stat-value">{formatCurrency(totalTds)}</strong>
          <small className="stat-sub">Form 16A Credit Ledger</small>
        </div>

        <div className="payment-stat-card">
          <span className="stat-label">Unsettled Receivables</span>
          <strong className="stat-value text-amber">
            {formatCurrency(invoices.reduce((sum, inv) => sum + (Number(inv.balance_due) || 0), 0))}
          </strong>
          <small className="stat-sub">{unpaidInvoices.length} Invoices Pending</small>
        </div>
      </div>

      {/* Toolbar */}
      <Card className="toolbar-card">
        <div className="payments-toolbar-grid">
          <input
            type="text"
            className="input-base"
            placeholder="Search by client, invoice #, or UTR..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <select
            className="input-base"
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value)}
          >
            <option value="all">All Payment Modes</option>
            <option value="NEFT / RTGS">NEFT / RTGS</option>
            <option value="UPI / QR">UPI / QR</option>
            <option value="Wire Transfer">Wire Transfer</option>
            <option value="Cheque">Cheque</option>
          </select>

          <select
            className="input-base"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          >
            <option value="all">All Statuses</option>
            <option value="active">Cleared & Settled</option>
            <option value="reversed">Reversed / Voided</option>
          </select>

          <div className="payments-toolbar-actions">
            <button
              type="button"
              className="wizard-btn-ghost"
              onClick={exportCSV}
              disabled={filteredPayments.length === 0}
            >
              📥 Export CSV
            </button>
            <button
              type="button"
              className="wizard-btn-primary"
              onClick={() => openRecordModal()}
            >
              + Record Inward Payment
            </button>
          </div>
        </div>
      </Card>

      {/* Table of Payments */}
      <Card>
        <Table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Invoice #</th>
              <th>Client</th>
              <th>Payment Mode</th>
              <th>Transaction Reference (UTR)</th>
              <th style={{ textAlign: "right" }}>TDS</th>
              <th style={{ textAlign: "right" }}>Amount Received</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredPayments.length === 0 ? (
              <tr>
                <td colSpan={9} className="table-empty-cell">
                  No payment records found matching your filters.
                </td>
              </tr>
            ) : (
              filteredPayments.map((p) => {
                const inv = invoicesById.get(p.invoice_id);
                const isReversed = Boolean(p.reversed_at);
                return (
                  <tr key={p.id}>
                    <td>{formatDate(p.payment_date)}</td>
                    <td>
                      {inv ? (
                        <Link href={`/invoices/${inv.id}`} className="table-code-link">
                          {inv.invoice_number}
                        </Link>
                      ) : (
                        <span className="muted">{p.invoice_id.slice(0, 8)}</span>
                      )}
                    </td>
                    <td>
                      <strong>{inv?.client?.company_name || "-"}</strong>
                    </td>
                    <td>
                      <span className="mode-pill">{p.payment_mode || "Bank Transfer"}</span>
                    </td>
                    <td>
                      <span className="code-tag">{p.transaction_reference || "N/A"}</span>
                    </td>
                    <td style={{ textAlign: "right", color: "#64748b" }}>
                      {p.withholding_amount > 0 ? formatCurrency(p.withholding_amount) : "-"}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: isReversed ? "#94a3b8" : "#059669" }}>
                      {formatCurrency(p.amount)}
                    </td>
                    <td>
                      {isReversed ? (
                        <span className="badge badge-overdue" title={`Reversal reason: ${p.reversal_reason}`}>
                          Reversed
                        </span>
                      ) : (
                        <span className="badge badge-paid">
                          Cleared
                        </span>
                      )}
                    </td>
                    <td>
                      {!isReversed && (
                        <button
                          type="button"
                          className="btn-link text-danger"
                          onClick={() => setReversalPayment(p)}
                        >
                          Reverse
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </Table>
      </Card>

      {/* Record Inward Payment Modal */}
      {showModal && (
        <div className="portal-modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="portal-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-top">
              <h3>Record Customer Payment</h3>
              <button type="button" className="close-btn" onClick={() => setShowModal(false)}>✕</button>
            </div>

            {modalError && (
              <div className="wizard-error-banner">{modalError}</div>
            )}

            <form onSubmit={handleRecordPayment} className="modal-form">
              <div>
                <label>Select Unpaid Invoice *</label>
                <select
                  className="input-base"
                  value={selectedInvoiceId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedInvoiceId(id);
                    const inv = invoicesById.get(id);
                    if (inv) setAmount(inv.balance_due);
                  }}
                >
                  {unpaidInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoice_number} – {inv.client?.company_name} (Due: {formatCurrency(inv.balance_due)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="modal-two-col">
                <div>
                  <label>Amount Received (INR) *</label>
                  <input
                    type="number"
                    className="input-base"
                    required
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value) || 0)}
                  />
                </div>

                <div>
                  <label>Payment Date *</label>
                  <input
                    type="date"
                    className="input-base"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-two-col">
                <div>
                  <label>Payment Mode</label>
                  <select
                    className="input-base"
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                  >
                    <option value="NEFT / RTGS">NEFT / RTGS</option>
                    <option value="IMPS">IMPS Immediate</option>
                    <option value="UPI / QR">UPI / Google Pay</option>
                    <option value="Wire Transfer">International Wire</option>
                    <option value="Cheque">Cheque Deposit</option>
                  </select>
                </div>

                <div>
                  <label>TDS Withheld (Tax Deducted at Source)</label>
                  <input
                    type="number"
                    className="input-base"
                    placeholder="0"
                    value={tdsAmount}
                    onChange={(e) => setTdsAmount(Number(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div>
                <label>Transaction UTR / Reference Number</label>
                <input
                  type="text"
                  className="input-base"
                  placeholder="e.g. CMS123456789 or UTR987654"
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                />
              </div>

              <div>
                <label>Deposit Account / Bank Reference</label>
                <input
                  type="text"
                  className="input-base"
                  placeholder="e.g. HDFC Current Account"
                  value={bankRef}
                  onChange={(e) => setBankRef(e.target.value)}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="wizard-btn-ghost" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="wizard-btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? "Settling..." : "✓ Confirm Payment Settlement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reverse Payment Modal */}
      {reversalPayment && (
        <div className="portal-modal-backdrop" onClick={() => setReversalPayment(null)}>
          <div className="portal-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-top">
              <h3>Reverse Payment Receipt</h3>
              <button type="button" className="close-btn" onClick={() => setReversalPayment(null)}>✕</button>
            </div>

            <form onSubmit={handleReversePayment} className="modal-form">
              <p className="modal-warning-text">
                Reversing this payment of <strong>{formatCurrency(reversalPayment.amount)}</strong> will reinstate the invoice balance due. Please provide an audit reason.
              </p>

              <div>
                <label>Reversal Reason *</label>
                <input
                  type="text"
                  className="input-base"
                  required
                  placeholder="e.g. Cheque returned / Duplicate entry"
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="wizard-btn-ghost" onClick={() => setReversalPayment(null)}>
                  Cancel
                </button>
                <button type="submit" className="wizard-btn-danger">
                  Confirm Reversal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ModuleScaffold>
  );
}

