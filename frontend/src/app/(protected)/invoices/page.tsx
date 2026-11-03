"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ModuleScaffold } from "@/components/business/ModuleScaffold";
import { ProjectSelect } from "@/components/projects/ProjectSelect";
import { AutocompleteInput } from "@/components/ui/AutocompleteInput";
import { StatusPill } from "@/components/business/StatusPill";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Table } from "@/components/ui/Table";
import { paymentModeOptions } from "@/data/dropdownOptions";
import { useClients } from "@/hooks/useClients";
import { useInvoices } from "@/hooks/useInvoices";
import { invoiceService } from "@/services/invoiceService";
import { settingsService } from "@/services/settingsService";
import {
  INVOICE_STATUSES,
  type Invoice,
  type InvoiceFormData,
  type InvoiceStatus,
  type PaymentFormData
} from "@/types/invoice";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatDate } from "@/utils/formatDate";

function createDefaultForm(taxPercentage = 18): InvoiceFormData {
  return {
    invoice_number: "",
    client_id: "",
    project_id: "",
    quotation_id: "",
    contract_id: "",
    invoice_date: new Date().toISOString().slice(0, 10),
    due_date: "",
    status: "draft",
    subtotal: 0,
    discount_amount: 0,
    tax_percentage: taxPercentage,
    notes: ""
  };
}

const defaultPayment: PaymentFormData = {
  payment_date: new Date().toISOString().slice(0, 10),
  amount: 0,
  payment_mode: "",
  transaction_reference: "",
  notes: ""
};

export default function InvoicesPage() {
  const {
    filteredInvoices,
    isLoading,
    errorMessage,
    searchTerm,
    statusFilter,
    clientFilter,
    startDate,
    endDate,
    setSearchTerm,
    setStatusFilter,
    setClientFilter,
    setStartDate,
    setEndDate,
    saveInvoice,
    deleteInvoice,
    addPayment
  } = useInvoices();

  const { clients } = useClients();
  const [defaultTaxPercentage, setDefaultTaxPercentage] = useState(18);
  const [form, setForm] = useState<InvoiceFormData>(createDefaultForm());
  const [payment, setPayment] = useState<PaymentFormData>(defaultPayment);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [paying, setPaying] = useState<Invoice | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    if (!editing) {
      void invoiceService
        .generateInvoiceNumber()
        .then((number) => setForm((current) => ({ ...current, invoice_number: number })));
    }
  }, [editing]);

  useEffect(() => {
    void settingsService.getEffectiveCompanySettings().then((settings) => {
      setDefaultTaxPercentage(settings.default_tax_percentage);
      setForm((current) => ({ ...current, tax_percentage: settings.default_tax_percentage }));
    });
  }, []);

  function edit(invoice: Invoice) {
    setEditing(invoice);
    setShowCreateForm(true);
    setForm({
      invoice_number: invoice.invoice_number,
      client_id: invoice.client_id,
      project_id: invoice.project_id ?? "",
      quotation_id: invoice.quotation_id ?? "",
      contract_id: invoice.contract_id ?? "",
      invoice_date: invoice.invoice_date,
      due_date: invoice.due_date ?? "",
      status: invoice.status,
      subtotal: invoice.subtotal,
      discount_amount: invoice.discount_amount,
      tax_percentage: invoice.tax_percentage,
      notes: invoice.notes ?? ""
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    await saveInvoice(form, editing?.id);
    setEditing(null);
    setShowCreateForm(false);
    setForm(createDefaultForm(defaultTaxPercentage));
  }

  async function submitPayment(event: FormEvent) {
    event.preventDefault();
    if (!paying) return;
    await addPayment(paying.id, payment);
    setPaying(null);
    setPayment(defaultPayment);
  }

  function cancelEdit() {
    setEditing(null);
    setShowCreateForm(false);
    setForm(createDefaultForm(defaultTaxPercentage));
  }

  function exportCsv() {
    const headers = [
      "Invoice Number",
      "Client",
      "Date",
      "Due Date",
      "Status",
      "Subtotal",
      "Discount",
      "Tax Amount",
      "Total Amount",
      "Amount Paid",
      "Balance Due"
    ];

    const rows = filteredInvoices.map((inv) => [
      `"${inv.invoice_number}"`,
      `"${inv.client?.company_name || ""}"`,
      `"${inv.invoice_date}"`,
      `"${inv.due_date || ""}"`,
      `"${inv.status}"`,
      inv.subtotal,
      inv.discount_amount,
      inv.tax_amount,
      inv.total_amount,
      inv.amount_paid,
      inv.balance_due
    ]);

    const csvContent = [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `invoices_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <ModuleScaffold
      title="Invoices & Collections"
      eyebrow="Financial Operations"
      description="Issue tax invoices, apply adjustments, record customer payments, and track receivables."
      errorMessage={errorMessage}
      isLoading={isLoading}
      isEmpty={false}
    >
      {/* Top Header Buttons */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "16px" }}>
        <div style={{ display: "flex", gap: "10px" }}>
          <Button onClick={() => setShowCreateForm(!showCreateForm)}>
            {showCreateForm ? "Close Form" : "+ Create New Invoice"}
          </Button>
          <Button variant="secondary" onClick={exportCsv} disabled={filteredInvoices.length === 0}>
            📥 Export CSV
          </Button>
        </div>
      </div>

      {showCreateForm && (
        <Card style={{ marginBottom: "20px" }}>
          <form className="client-form" onSubmit={submit}>
            <h2 style={{ fontSize: "1.15rem", margin: "0 0 14px 0" }}>
              {editing ? `Edit Invoice: ${editing.invoice_number}` : "Create New Tax Invoice"}
            </h2>
            <div className="form-grid two-columns">
              <label>
                Invoice Number
                <Input
                  value={form.invoice_number}
                  onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
                  required
                />
              </label>
              <label>
                Client
                <select
                  value={form.client_id}
                  onChange={(e) => setForm({ ...form, client_id: e.target.value, project_id: "" })}
                  required
                >
                  <option value="">Select client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.company_name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Project
                <ProjectSelect
                  clientId={form.client_id}
                  value={form.project_id}
                  onChange={(projectId) => setForm({ ...form, project_id: projectId })}
                />
              </label>
              <label>
                Status
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as InvoiceStatus })}
                >
                  {INVOICE_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Invoice Date
                <Input
                  type="date"
                  value={form.invoice_date}
                  onChange={(e) => setForm({ ...form, invoice_date: e.target.value })}
                  required
                />
              </label>
              <label>
                Payment Due Date
                <Input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                />
              </label>
              <label>
                Subtotal (₹)
                <Input
                  type="number"
                  value={form.subtotal}
                  onChange={(e) => setForm({ ...form, subtotal: Number(e.target.value) })}
                  required
                />
              </label>
              <label>
                Discount Amount (₹)
                <Input
                  type="number"
                  value={form.discount_amount}
                  onChange={(e) => setForm({ ...form, discount_amount: Number(e.target.value) })}
                />
              </label>
              <label>
                Tax Percentage (%)
                <Input
                  type="number"
                  value={form.tax_percentage}
                  onChange={(e) => setForm({ ...form, tax_percentage: Number(e.target.value) })}
                  required
                />
              </label>
            </div>
            <label style={{ marginTop: "12px" }}>
              Terms & Customer Notes
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Bank transfer instructions, purchase order references, or notes..."
              />
            </label>
            <div className="form-actions" style={{ marginTop: "16px" }}>
              {editing ? (
                <Button type="button" variant="secondary" onClick={cancelEdit}>
                  Cancel
                </Button>
              ) : null}
              <Button type="submit">{editing ? "Save Changes" : "Create Invoice"}</Button>
            </div>
          </form>
        </Card>
      )}

      {paying && (
        <Card style={{ marginBottom: "20px", border: "2px solid #f59e0b" }}>
          <form className="client-form" onSubmit={submitPayment}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: "1.15rem", margin: 0 }}>
                Record Payment for Invoice: <strong>{paying.invoice_number}</strong>
              </h2>
              <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
                Balance Due: <strong>{formatCurrency(paying.balance_due)}</strong>
              </span>
            </div>
            <div className="form-grid two-columns" style={{ marginTop: "12px" }}>
              <label>
                Payment Date
                <Input
                  type="date"
                  value={payment.payment_date}
                  onChange={(e) => setPayment({ ...payment, payment_date: e.target.value })}
                  required
                />
              </label>
              <label>
                Received Amount (₹)
                <Input
                  type="number"
                  value={payment.amount || ""}
                  placeholder={String(paying.balance_due)}
                  onChange={(e) => setPayment({ ...payment, amount: Number(e.target.value) })}
                  required
                />
              </label>
              <label>
                Payment Mode
                <AutocompleteInput
                  value={payment.payment_mode}
                  onChange={(e) => setPayment({ ...payment, payment_mode: e.target.value })}
                  options={paymentModeOptions}
                  placeholder="e.g. Bank Transfer, UPI, Cheque"
                  required
                />
              </label>
              <label>
                Transaction / UTR Reference
                <Input
                  value={payment.transaction_reference}
                  onChange={(e) => setPayment({ ...payment, transaction_reference: e.target.value })}
                  placeholder="e.g. IMPS / UTR number"
                />
              </label>
            </div>
            <label style={{ marginTop: "10px" }}>
              Payment Notes
              <textarea
                rows={2}
                value={payment.notes}
                onChange={(e) => setPayment({ ...payment, notes: e.target.value })}
                placeholder="Bank name, cheque clearance notes..."
              />
            </label>
            <div className="form-actions" style={{ marginTop: "12px" }}>
              <Button type="button" variant="secondary" onClick={() => setPaying(null)}>
                Cancel
              </Button>
              <Button type="submit">Confirm & Record Payment</Button>
            </div>
          </form>
        </Card>
      )}

      {/* Comprehensive Filter Toolbar */}
      <Card className="toolbar-card">
        <div
          className="clients-toolbar"
          style={{
            gridTemplateColumns: "minmax(200px, 1fr) 200px 160px 140px 140px",
            alignItems: "end"
          }}
        >
          <label>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Search</span>
            <Input
              placeholder="Search invoice number, client, or notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </label>

          <label>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Client</span>
            <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}>
              <option value="all">All Clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Status</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as InvoiceStatus | "all")}
            >
              <option value="all">All Statuses</option>
              {INVOICE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>From Date</span>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>

          <label>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>To Date</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </label>
        </div>
      </Card>

      {/* Invoices List Table */}
      <Card>
        <Table>
          <thead>
            <tr>
              <th>Invoice ID</th>
              <th>Client</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Total Amount</th>
              <th style={{ textAlign: "right" }}>Paid</th>
              <th style={{ textAlign: "right" }}>Balance Due</th>
              <th>Due Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvoices.length > 0 ? (
              filteredInvoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td>
                    <Link href={`/invoices/${invoice.id}`} className="table-code-link">
                      <strong>{invoice.invoice_number}</strong>
                    </Link>
                    <small style={{ display: "block", color: "#64748b" }}>{formatDate(invoice.invoice_date)}</small>
                  </td>
                  <td>{invoice.client?.company_name || "-"}</td>
                  <td>
                    <StatusPill value={invoice.status} />
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 600 }}>
                    {formatCurrency(invoice.total_amount)}
                  </td>
                  <td style={{ textAlign: "right", color: invoice.amount_paid > 0 ? "#059669" : "#64748b" }}>
                    {formatCurrency(invoice.amount_paid)}
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: invoice.balance_due > 0 ? "#b45309" : "#059669" }}>
                    {formatCurrency(invoice.balance_due)}
                  </td>
                  <td style={{ fontSize: "0.82rem" }}>
                    {invoice.due_date ? formatDate(invoice.due_date) : "-"}
                  </td>
                  <td>
                    <div className="table-actions">
                      <Link href={`/invoices/${invoice.id}`} className="link-button" style={{ textDecoration: "none" }}>
                        View
                      </Link>
                      <button className="link-button" type="button" onClick={() => edit(invoice)}>
                        Edit
                      </button>
                      {invoice.balance_due > 0 && invoice.status !== "cancelled" ? (
                        <button className="link-button" type="button" onClick={() => setPaying(invoice)}>
                          Pay
                        </button>
                      ) : null}
                      <button
                        className="link-button"
                        type="button"
                        onClick={() =>
                          void import("@/utils/pdf/generateInvoicePdf").then(({ generateInvoicePdf }) =>
                            generateInvoicePdf(invoice)
                          )
                        }
                      >
                        PDF
                      </button>
                      <button
                        className="link-button danger-link"
                        type="button"
                        onClick={() => void deleteInvoice(invoice.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="table-empty-cell">
                  No invoices found matching the current search criteria.
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>
    </ModuleScaffold>
  );
}
