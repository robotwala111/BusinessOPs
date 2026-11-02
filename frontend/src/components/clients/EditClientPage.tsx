"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ClientForm } from "@/components/clients/ClientForm";
import { BackButton } from "@/components/ui/BackButton";
import { clientService } from "@/services/clientService";
import type { Client, ClientFormData } from "@/types/client";

type EditClientPageProps = {
  clientId: string;
};

export function EditClientPage({ clientId }: EditClientPageProps) {
  const [client, setClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const router = useRouter();

  useEffect(() => {
    async function loadClient() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        setClient(await clientService.getClientById(clientId));
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Unable to load client."
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadClient();
  }, [clientId]);

  async function handleSubmit(data: ClientFormData) {
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      await clientService.updateClient(clientId, data);
      router.push(`/clients/${clientId}`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to update client."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return <div className="route-placeholder">Loading client...</div>;
  }

  if (!client) {
    return <div className="route-placeholder">Client not found.</div>;
  }

  return (
    <section className="module-page">
      <div className="module-header">
        <div>
          <p className="eyebrow">Client Management</p>
          <h1>Edit Client</h1>
          <p className="muted">{client.company_name}</p>
        </div>
        <div className="module-actions">
          <BackButton fallbackHref={`/clients/${clientId}`} />
        </div>
      </div>
      {errorMessage ? <div className="form-error">{errorMessage}</div> : null}
      <ClientForm
        client={client}
        submitLabel="Save Changes"
        isSubmitting={isSubmitting}
        onSubmit={handleSubmit}
      />
    </section>
  );
}
