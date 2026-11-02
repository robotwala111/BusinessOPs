"use client";

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
import { INVOICE_STATUSES, type Invoice, type InvoiceFormData, type PaymentFormData } from "@/types/invoice";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatDate } from "@/utils/formatDate";

function createDefaultForm(taxPercentage = 18): InvoiceFormData {
  return { invoice_number: "", client_id: "", project_id: "", quotation_id: "", contract_id: "", invoice_date: new Date().toISOString().slice(0, 10), due_date: "", status: "draft", subtotal: 0, discount_amount: 0, tax_percentage: taxPercentage, notes: "" };
}
const defaultPayment: PaymentFormData = { payment_date: new Date().toISOString().slice(0, 10), amount: 0, payment_mode: "", transaction_reference: "", notes: "" };

export default function InvoicesPage() {
  const { filteredInvoices, isLoading, errorMessage, searchTerm, statusFilter, setSearchTerm, setStatusFilter, saveInvoice, deleteInvoice, addPayment } = useInvoices();
  const { clients } = useClients();
  const [defaultTaxPercentage, setDefaultTaxPercentage] = useState(18);
  const [form, setForm] = useState<InvoiceFormData>(createDefaultForm());
  const [payment, setPayment] = useState<PaymentFormData>(defaultPayment);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [paying, setPaying] = useState<Invoice | null>(null);

  useEffect(() => {
    if (!editing) void invoiceService.generateInvoiceNumber().then((number) => setForm((current) => ({ ...current, invoice_number: number })));
  }, [editing]);

  useEffect(() => {
    void settingsService.getEffectiveCompanySettings().then((settings) => {
      setDefaultTaxPercentage(settings.default_tax_percentage);
      setForm((current) => ({ ...current, tax_percentage: settings.default_tax_percentage }));
    });
  }, []);

  function edit(invoice: Invoice) {
    setEditing(invoice);
    setForm({ invoice_number: invoice.invoice_number, client_id: invoice.client_id, project_id: invoice.project_id ?? "", quotation_id: invoice.quotation_id ?? "", contract_id: invoice.contract_id ?? "", invoice_date: invoice.invoice_date, due_date: invoice.due_date ?? "", status: invoice.status, subtotal: invoice.subtotal, discount_amount: invoice.discount_amount, tax_percentage: invoice.tax_percentage, notes: invoice.notes ?? "" });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    await saveInvoice(form, editing?.id);
    setEditing(null);
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
    setForm(createDefaultForm(defaultTaxPercentage));
  }

  return (
    <ModuleScaffold title="Invoices" eyebrow="Invoice & Payment Tracking" description="Create invoices, record payments, and track outstanding balances." errorMessage={errorMessage} isLoading={isLoading} isEmpty={false}>
      <Card><form className="client-form" onSubmit={submit}><div className="form-grid two-columns"><label>Invoice number<Input value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} /></label><label>Client<select value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value, project_id: "" })}><option value="">Select client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.company_name}</option>)}</select></label><label>Project<ProjectSelect clientId={form.client_id} value={form.project_id} onChange={(projectId) => setForm({ ...form, project_id: projectId })} /></label><label>Status<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as InvoiceFormData["status"] })}>{INVOICE_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></label><label>Invoice date<Input type="date" value={form.invoice_date} onChange={(e) => setForm({ ...form, invoice_date: e.target.value })} /></label><label>Due date<Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></label><label>Subtotal<Input type="number" value={form.subtotal} onChange={(e) => setForm({ ...form, subtotal: Number(e.target.value) })} /></label><label>Discount<Input type="number" value={form.discount_amount} onChange={(e) => setForm({ ...form, discount_amount: Number(e.target.value) })} /></label><label>Tax %<Input type="number" value={form.tax_percentage} onChange={(e) => setForm({ ...form, tax_percentage: Number(e.target.value) })} /></label></div><label>Notes<textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label><div className="form-actions">{editing ? <Button type="button" variant="secondary" onClick={cancelEdit}>Cancel</Button> : null}<Button type="submit">{editing ? "Save Invoice" : "Create Invoice"}</Button></div></form></Card>
      {paying ? <Card><form className="client-form" onSubmit={submitPayment}><h2>Add payment for {paying.invoice_number}</h2><div className="form-grid two-columns"><label>Date<Input type="date" value={payment.payment_date} onChange={(e) => setPayment({ ...payment, payment_date: e.target.value })} /></label><label>Amount<Input type="number" value={payment.amount} onChange={(e) => setPayment({ ...payment, amount: Number(e.target.value) })} /></label><label>Mode<AutocompleteInput value={payment.payment_mode} onChange={(e) => setPayment({ ...payment, payment_mode: e.target.value })} options={paymentModeOptions} placeholder="Search payment mode" /></label><label>Reference<Input value={payment.transaction_reference} onChange={(e) => setPayment({ ...payment, transaction_reference: e.target.value })} /></label></div><label>Notes<textarea rows={2} value={payment.notes} onChange={(e) => setPayment({ ...payment, notes: e.target.value })} /></label><div className="form-actions"><Button type="button" variant="secondary" onClick={() => setPaying(null)}>Cancel</Button><Button type="submit">Record Payment</Button></div></form></Card> : null}
      <Card className="toolbar-card"><div className="clients-toolbar"><Input placeholder="Search invoices" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}><option value="all">All statuses</option>{INVOICE_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></div></Card>
      <Table><thead><tr><th>Invoice</th><th>Client</th><th>Status</th><th>Total</th><th>Paid</th><th>Balance</th><th>Actions</th></tr></thead><tbody>{filteredInvoices.map((invoice) => <tr key={invoice.id}><td>{invoice.invoice_number}<small>{formatDate(invoice.invoice_date)}</small></td><td>{invoice.client?.company_name || "-"}</td><td><StatusPill value={invoice.status} /></td><td>{formatCurrency(invoice.total_amount)}</td><td>{formatCurrency(invoice.amount_paid)}</td><td>{formatCurrency(invoice.balance_due)}</td><td><div className="table-actions"><button className="link-button" type="button" onClick={() => edit(invoice)}>Edit</button><button className="link-button" type="button" onClick={() => setPaying(invoice)}>Pay</button><button className="link-button" type="button" onClick={() => void import("@/utils/pdf/generateInvoicePdf").then(({ generateInvoicePdf }) => generateInvoicePdf(invoice))}>PDF</button><button className="link-button danger-link" type="button" onClick={() => void deleteInvoice(invoice.id)}>Delete</button></div></td></tr>)}</tbody></Table>
    </ModuleScaffold>
  );
}
