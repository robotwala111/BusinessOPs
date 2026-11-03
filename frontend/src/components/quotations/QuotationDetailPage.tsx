"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { allowedTransitions } from "@/lib/workflowRules";
import { historyService } from "@/services/historyService";
import type { EntityHistory } from "@/types/workflow";
import { QuotationStatusBadge } from "@/components/quotations/QuotationStatusBadge";
import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Table } from "@/components/ui/Table";
import { quotationService } from "@/services/quotationService";
import type { Quotation } from "@/types/quotation";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatDate } from "@/utils/formatDate";

type QuotationDetailPageProps = {
  quotationId: string;
};

function value(val?: string | null) {
  return val || "-";
}

export function QuotationDetailPage({ quotationId }: QuotationDetailPageProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isConvertingInvoice, setIsConvertingInvoice] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [pdfErrorMessage, setPdfErrorMessage] = useState("");
  const [history, setHistory] = useState<EntityHistory[]>([]);

  useEffect(() => {
    async function loadQuotation() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        setQuotation(await quotationService.getQuotationById(quotationId));
        setHistory(await historyService.list("quotation", quotationId));
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Unable to load quotation."
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadQuotation();
  }, [quotationId]);

  async function handleDownloadPdf() {
    if (!quotation) return;

    setIsGeneratingPdf(true);
    setPdfErrorMessage("");

    try {
      const { generateQuotationPdf } = await import("@/utils/pdf/generateQuotationPdf");
      await generateQuotationPdf(quotation);
    } catch (error) {
      setPdfErrorMessage(
        error instanceof Error ? error.message : "Unable to generate PDF."
      );
    } finally {
      setIsGeneratingPdf(false);
    }
  }

  async function transition(status: Quotation["status"]) {
    if (!quotation) return;
    const needsReason = status === "rejected" || status === "draft";
    const promptMsg =
      status === "rejected"
        ? "Please enter the mandatory reason for rejecting this quotation:"
        : "Please enter the reason for returning this quotation to draft:";
    const reason = needsReason ? window.prompt(promptMsg) : "";
    if (needsReason && !reason?.trim()) return;

    try {
      setQuotation(
        await quotationService.transitionQuotation(
          quotation.id,
          status,
          user?.id ?? null,
          reason ?? ""
        )
      );
      setHistory(await historyService.list("quotation", quotation.id));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update quotation.");
    }
  }

  async function createRevision() {
    if (!quotation) return;
    try {
      const revision = await quotationService.createRevision(quotation.id, user?.id ?? null);
      router.push(`/quotations/${revision.id}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create revision.");
    }
  }

  async function convertContract() {
    if (!quotation) return;
    try {
      const id = await quotationService.convertToContract(quotation.id, user?.id ?? null);
      router.push(`/contracts/${id}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create contract.");
    }
  }

  async function convertInvoice() {
    if (!quotation) return;
    setIsConvertingInvoice(true);
    try {
      const invoiceId = await quotationService.convertToInvoice(quotation.id, user?.id ?? null);
      router.push(`/invoices/${invoiceId}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create invoice.");
    } finally {
      setIsConvertingInvoice(false);
    }
  }

  if (isLoading) {
    return <div className="route-placeholder">Loading quotation...</div>;
  }

  if (errorMessage) {
    return <div className="form-error">{errorMessage}</div>;
  }

  if (!quotation) {
    return <div className="route-placeholder">Quotation not found.</div>;
  }

  return (
    <section className="module-page">
      <div className="quotation-hero">
        <div>
          <p className="eyebrow">Quotation Details</p>
          <h1>{quotation.quotation_number}</h1>
          <p className="muted">{quotation.title}</p>
          <div className="quotation-hero-meta">
            <QuotationStatusBadge status={quotation.status} />
            <span>{quotation.client?.company_name || "Client not linked"}</span>
            <span>{formatCurrency(quotation.total_amount)}</span>
          </div>
        </div>
        <div className="module-actions">
          <BackButton fallbackHref="/quotations" />
          <Button
            type="button"
            disabled={isGeneratingPdf}
            onClick={handleDownloadPdf}
          >
            {isGeneratingPdf ? "Generating PDF..." : "Download PDF"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => window.print()}>
            Print
          </Button>

          {quotation.status === "draft" ? (
            <Link href={`/quotations/${quotation.id}/edit`}>
              <Button type="button" variant="secondary">Edit Quotation</Button>
            </Link>
          ) : null}

          {allowedTransitions("quotation", quotation.status).map((status) => (
            <Button
              key={status}
              type="button"
              variant="secondary"
              onClick={() => void transition(status as Quotation["status"])}
            >
              Mark {status.replace(/_/g, " ")}
            </Button>
          ))}

          {["approved", "sent", "rejected", "expired"].includes(quotation.status) ? (
            <Button type="button" variant="secondary" onClick={() => void createRevision()}>
              Create revision
            </Button>
          ) : null}

          {quotation.status === "accepted" ? (
            <>
              <Button type="button" onClick={() => void convertContract()}>
                {quotation.generated_contract_id ? "Open Contract" : "Create Contract"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={isConvertingInvoice}
                onClick={() => void convertInvoice()}
              >
                {isConvertingInvoice ? "Generating..." : "+ Create Invoice"}
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {quotation.rejected_reason && (
        <div className="form-error" style={{ margin: "14px 0" }}>
          <strong>Quotation Rejection Reason:</strong> {quotation.rejected_reason}
        </div>
      )}

      {quotation.return_to_draft_reason && (
        <div className="form-note" style={{ margin: "14px 0" }}>
          <strong>Returned to Draft Reason:</strong> {quotation.return_to_draft_reason}
        </div>
      )}

      <Card>
        <h2>Revision and activity history</h2>
        {history.length === 0 ? (
          <p className="muted">No lifecycle events recorded yet.</p>
        ) : (
          <ul>
            {history.map((entry) => (
              <li key={entry.id}>
                {formatDate(entry.created_at)} — {entry.description}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {pdfErrorMessage ? (
        <div className="form-error">{pdfErrorMessage}</div>
      ) : null}

      <div className="quotation-kpi-grid">
        <Card>
          <DetailItem label="Client" value={quotation.client?.company_name || "-"} />
        </Card>
        <Card>
          <DetailItem label="Quotation date" value={formatDate(quotation.quotation_date)} />
        </Card>
        <Card>
          <DetailItem
            label="Valid until"
            value={quotation.valid_until ? formatDate(quotation.valid_until) : "-"}
          />
        </Card>
        <Card>
          <DetailItem label="Final total" value={formatCurrency(quotation.total_amount)} />
        </Card>
      </div>

      <div className="quote-detail-columns">
        <Card>
          <h2>Client Information</h2>
          <div className="detail-grid">
            <DetailItem label="Contact" value={value(quotation.client?.contact_person)} />
            <DetailItem label="Email" value={value(quotation.client?.email)} />
            <DetailItem label="Phone" value={value(quotation.client?.phone)} />
            <DetailItem label="GST" value={value(quotation.client?.gst_number)} />
          </div>
        </Card>
        <Card className="quote-total-card">
          <span>Enterprise quotation total</span>
          <strong>{formatCurrency(quotation.total_amount)}</strong>
          <p className="muted">
            Includes discount, tax, payment terms, and all listed quotation items.
          </p>
        </Card>
      </div>

      <Table>
        <thead>
          <tr>
            <th>Description</th>
            <th>Qty</th>
            <th>Unit Price</th>
            <th>Line Total</th>
          </tr>
        </thead>
        <tbody>
          {quotation.items.map((item) => (
            <tr key={item.id}>
              <td>{item.description}</td>
              <td>{item.quantity}</td>
              <td>{formatCurrency(item.unit_price)}</td>
              <td>{formatCurrency(item.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </Table>

      <div className="quotation-section-grid">
        <SectionCard title="Project Overview" content={quotation.project_overview} />
        <SectionCard title="Scope of Work" content={quotation.scope_of_work} />
        <SectionCard title="Tech Stack" content={quotation.tech_stack} />
        <SectionCard title="Project Timeline" content={quotation.project_timeline} />
        <SectionCard
          title="Support and Maintenance"
          content={quotation.support_and_maintenance}
        />
      </div>

      <div className="quote-detail-columns">
        <Card>
          <h2>Payment Terms</h2>
          <p>{value(quotation.payment_terms)}</p>
          <h2>Notes</h2>
          <p>{value(quotation.notes)}</p>
          <h2>Terms and Conditions</h2>
          <p>{value(quotation.terms_and_conditions)}</p>
        </Card>
        <Card>
          <div className="quote-summary">
            <div>
              <span>Subtotal</span>
              <strong>{formatCurrency(quotation.subtotal)}</strong>
            </div>
            <div>
              <span>Discount ({quotation.discount_rate}%)</span>
              <strong>{formatCurrency(quotation.discount_amount)}</strong>
            </div>
            <div>
              <span>Tax ({quotation.tax_rate}%)</span>
              <strong>{formatCurrency(quotation.tax_amount)}</strong>
            </div>
            <div>
              <span>Total</span>
              <strong>{formatCurrency(quotation.total_amount)}</strong>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}

function SectionCard({
  title,
  content
}: {
  title: string;
  content?: string | null;
}) {
  if (!content) return null;

  return (
    <Card>
      <h2>{title}</h2>
      <p className="preserve-lines">{content}</p>
    </Card>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
