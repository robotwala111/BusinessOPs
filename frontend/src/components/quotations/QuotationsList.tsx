"use client";

import Link from "next/link";
import { useState } from "react";
import { QuotationStatusBadge } from "@/components/quotations/QuotationStatusBadge";
import { quotationStatusLabels } from "@/components/quotations/quotationLabels";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Table } from "@/components/ui/Table";
import { useQuotations } from "@/hooks/useQuotations";
import { QUOTATION_STATUSES, type Quotation } from "@/types/quotation";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatDate } from "@/utils/formatDate";

export function QuotationsList() {
  const {
    quotations,
    filteredQuotations,
    isLoading,
    errorMessage,
    searchTerm,
    statusFilter,
    setSearchTerm,
    setStatusFilter,
    deleteQuotation
  } = useQuotations();
  const [quotationToDelete, setQuotationToDelete] = useState<Quotation | null>(
    null
  );
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    if (!quotationToDelete) {
      return;
    }

    setIsDeleting(true);
    setDeleteError("");

    try {
      await deleteQuotation(quotationToDelete.id);
      setQuotationToDelete(null);
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : "Unable to delete quotation."
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <section className="module-page">
      <div className="module-header">
        <div>
          <p className="eyebrow">Quotation Management</p>
          <h1>Quotations</h1>
          <p className="muted">
            Create, price, track, and download professional client quotations.
          </p>
        </div>
        <Link href="/quotations/new">
          <Button type="button">New Quotation</Button>
        </Link>
      </div>

      <Card className="toolbar-card">
        <div className="clients-toolbar">
          <Input
            placeholder="Search number, title, or client"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as typeof statusFilter)
            }
          >
            <option value="all">All statuses</option>
            {QUOTATION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {quotationStatusLabels[status]}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {errorMessage ? <div className="form-error">{errorMessage}</div> : null}

      {isLoading ? (
        <Card>
          <div className="loading-state">Loading quotations...</div>
        </Card>
      ) : quotations.length === 0 ? (
        <Card>
          <EmptyState
            title="No quotations yet"
            description="Create the first quotation and add line items for a client."
            action={
              <Link href="/quotations/new">
                <Button type="button">New Quotation</Button>
              </Link>
            }
          />
        </Card>
      ) : filteredQuotations.length === 0 ? (
        <Card>
          <EmptyState
            title="No matching quotations"
            description="Adjust the search term or status filter."
          />
        </Card>
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Quotation</th>
              <th>Client</th>
              <th>Date</th>
              <th>Valid until</th>
              <th>Status</th>
              <th>Total</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredQuotations.map((quotation) => (
              <tr key={quotation.id}>
                <td>
                  <Link
                    className="table-link"
                    href={`/quotations/${quotation.id}`}
                  >
                    {quotation.quotation_number}
                  </Link>
                  <small>{quotation.title}</small>
                </td>
                <td>{quotation.client?.company_name || "-"}</td>
                <td>{formatDate(quotation.quotation_date)}</td>
                <td>
                  {quotation.valid_until ? formatDate(quotation.valid_until) : "-"}
                </td>
                <td>
                  <QuotationStatusBadge status={quotation.status} />
                </td>
                <td>{formatCurrency(quotation.total_amount)}</td>
                <td>
                  <div className="table-actions">
                    <Link href={`/quotations/${quotation.id}/edit`}>Edit</Link>
                    <button
                      type="button"
                      className="link-button danger-link"
                      onClick={() => setQuotationToDelete(quotation)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {quotationToDelete ? (
        <Modal>
          <h2>Delete quotation?</h2>
          <p className="muted">
            This will remove {quotationToDelete.quotation_number} from the
            quotation list.
          </p>
          {deleteError ? <div className="form-error">{deleteError}</div> : null}
          <div className="modal-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setQuotationToDelete(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={isDeleting}
              onClick={handleDelete}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
