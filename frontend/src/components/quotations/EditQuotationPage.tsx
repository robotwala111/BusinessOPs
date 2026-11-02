"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { QuotationForm } from "@/components/quotations/QuotationForm";
import { BackButton } from "@/components/ui/BackButton";
import { useQuotations } from "@/hooks/useQuotations";
import { quotationService } from "@/services/quotationService";
import type { Quotation, QuotationFormData } from "@/types/quotation";

type EditQuotationPageProps = {
  quotationId: string;
};

export function EditQuotationPage({ quotationId }: EditQuotationPageProps) {
  const { updateQuotation } = useQuotations({ autoLoad: false });
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function loadQuotation() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        setQuotation(await quotationService.getQuotationById(quotationId));
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

  async function handleSubmit(data: QuotationFormData) {
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      await updateQuotation(quotationId, data);
      router.push(`/quotations/${quotationId}`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to update quotation."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return <div className="route-placeholder">Loading quotation...</div>;
  }

  if (!quotation && !errorMessage) {
    return <div className="route-placeholder">Quotation not found.</div>;
  }

  return (
    <section className="module-page">
      <div className="module-header">
        <div>
          <p className="eyebrow">Quotation Management</p>
          <h1>Edit Quotation</h1>
          <p className="muted">Update pricing, terms, and line items.</p>
        </div>
        <div className="module-actions">
          <BackButton fallbackHref={`/quotations/${quotationId}`} />
        </div>
      </div>
      {errorMessage ? <div className="form-error">{errorMessage}</div> : null}
      {quotation ? (
        <QuotationForm
          quotation={quotation}
          submitLabel="Save Quotation"
          isSubmitting={isSubmitting}
          onSubmit={handleSubmit}
        />
      ) : null}
    </section>
  );
}
