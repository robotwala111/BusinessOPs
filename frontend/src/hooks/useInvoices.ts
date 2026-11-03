"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { invoiceService } from "@/services/invoiceService";
import { paymentService } from "@/services/paymentService";
import type { Invoice, InvoiceFormData, InvoiceStatus, PaymentFormData } from "@/types/invoice";

export function useInvoices() {
  const { user, profile } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "all">("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  async function loadInvoices() {
    setIsLoading(true);
    setErrorMessage("");
    try {
      setInvoices(await invoiceService.getInvoices());
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load invoices.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadInvoices();
  }, []);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        !q ||
        [invoice.invoice_number, invoice.client?.company_name, invoice.notes].some((val) =>
          val?.toLowerCase().includes(q)
        );

      const matchesStatus = statusFilter === "all" || invoice.status === statusFilter;
      const matchesClient = clientFilter === "all" || invoice.client_id === clientFilter;
      const matchesStart = !startDate || invoice.invoice_date >= startDate;
      const matchesEnd = !endDate || invoice.invoice_date <= endDate;

      return matchesSearch && matchesStatus && matchesClient && matchesStart && matchesEnd;
    });
  }, [invoices, searchTerm, statusFilter, clientFilter, startDate, endDate]);

  async function saveInvoice(data: InvoiceFormData, id?: string) {
    const record = id
      ? await invoiceService.updateInvoice(id, data)
      : await invoiceService.createInvoice({ ...data, created_by: user?.id ?? null });
    await loadInvoices();
    return record;
  }

  async function deleteInvoice(id: string) {
    if (profile?.role !== "admin") throw new Error("Only admin users can delete invoices.");
    await invoiceService.deleteInvoice(id);
    setInvoices((current) => current.filter((invoice) => invoice.id !== id));
  }

  async function addPayment(invoiceId: string, data: PaymentFormData) {
    await paymentService.addPayment({ ...data, invoice_id: invoiceId, created_by: user?.id ?? null });
    await loadInvoices();
  }

  return {
    invoices,
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
    addPayment,
    loadInvoices
  };
}
