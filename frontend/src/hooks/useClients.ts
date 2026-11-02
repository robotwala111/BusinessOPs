"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { clientService } from "@/services/clientService";
import type {
  Client,
  ClientCreateInput,
  ClientFormData,
  ClientStatus,
  ClientUpdateInput
} from "@/types/client";

type UseClientsOptions = {
  autoLoad?: boolean;
};

export function useClients(options: UseClientsOptions = {}) {
  const { autoLoad = true } = options;
  const { user, profile } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(autoLoad);
  const [errorMessage, setErrorMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<ClientStatus | "all">("all");

  const loadClients = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      setClients(await clientService.getClients());
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to load clients."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoLoad) {
      void loadClients();
    }
  }, [autoLoad, loadClients]);

  const filteredClients = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return clients.filter((client) => {
      const matchesStatus =
        statusFilter === "all" || client.status === statusFilter;
      const matchesSearch =
        !normalizedSearch ||
        [
          client.company_name,
          client.contact_person,
          client.email,
          client.phone
        ].some((value) => value?.toLowerCase().includes(normalizedSearch));

      return matchesStatus && matchesSearch;
    });
  }, [clients, searchTerm, statusFilter]);

  async function createClient(data: ClientFormData) {
    const payload: ClientCreateInput = {
      ...data,
      created_by: user?.id ?? null
    };
    const createdClient = await clientService.createClient(payload);
    setClients((currentClients) => [createdClient, ...currentClients]);
    return createdClient;
  }

  async function updateClient(id: string, data: ClientUpdateInput) {
    const updatedClient = await clientService.updateClient(id, data);

    if (updatedClient) {
      setClients((currentClients) =>
        currentClients.map((client) =>
          client.id === id ? updatedClient : client
        )
      );
    }

    return updatedClient;
  }

  async function deleteClient(id: string) {
    if (profile?.role !== "admin") {
      throw new Error("Only admin users can delete clients.");
    }

    await clientService.deleteClient(id);
    setClients((currentClients) =>
      currentClients.filter((client) => client.id !== id)
    );
  }

  return {
    clients,
    filteredClients,
    isLoading,
    errorMessage,
    searchTerm,
    statusFilter,
    setSearchTerm,
    setStatusFilter,
    loadClients,
    createClient,
    updateClient,
    deleteClient
  };
}
