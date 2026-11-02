"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { QuotationForm } from "@/components/quotations/QuotationForm";
import { BackButton } from "@/components/ui/BackButton";
import { useQuotations } from "@/hooks/useQuotations";
import type { QuotationFormData } from "@/types/quotation";

export function NewQuotationPage() {
  const { createQuotation } = useQuotations({ autoLoad: false });
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  async function handleSubmit(data: QuotationFormData) {
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const quotation = await createQuotation(data);
      router.push(`/quotations/${quotation.id}`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to create quotation."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="module-page">
      <div className="module-header">
        <div>
          <p className="eyebrow">Quotation Management</p>
          <h1>New Quotation</h1>
          <p className="muted">Prepare pricing, terms, and quotation items.</p>
        </div>
        <div className="module-actions">
          <BackButton fallbackHref="/quotations" />
        </div>
      </div>
      {errorMessage ? <div className="form-error">{errorMessage}</div> : null}
      <QuotationForm
        submitLabel="Create Quotation"
        isSubmitting={isSubmitting}
        onSubmit={handleSubmit}
      />
    </section>
  );
}
