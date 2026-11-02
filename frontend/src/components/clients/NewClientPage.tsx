"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ClientForm } from "@/components/clients/ClientForm";
import { BackButton } from "@/components/ui/BackButton";
import { useClients } from "@/hooks/useClients";
import type { ClientFormData } from "@/types/client";

export function NewClientPage() {
  const { createClient } = useClients({ autoLoad: false });
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  async function handleSubmit(data: ClientFormData) {
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const client = await createClient(data);
      router.push(`/clients/${client.id}`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to create client."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="module-page">
      <div className="module-header">
        <div>
          <p className="eyebrow">Client Management</p>
          <h1>New Client</h1>
          <p className="muted">Create a new client or lead record.</p>
        </div>
        <div className="module-actions">
          <BackButton fallbackHref="/clients" />
        </div>
      </div>
      {errorMessage ? <div className="form-error">{errorMessage}</div> : null}
      <ClientForm
        submitLabel="Create Client"
        isSubmitting={isSubmitting}
        onSubmit={handleSubmit}
      />
    </section>
  );
}
