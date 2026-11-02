"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { quotationService } from "@/services/quotationService";
import type {
  Quotation,
  QuotationCreateInput,
  QuotationFormData,
  QuotationStatus,
  QuotationUpdateInput
} from "@/types/quotation";

type UseQuotationsOptions = {
  autoLoad?: boolean;
};

export function useQuotations(options: UseQuotationsOptions = {}) {
  const { autoLoad = true } = options;
  const { user, profile } = useAuth();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [isLoading, setIsLoading] = useState(autoLoad);
  const [errorMessage, setErrorMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<QuotationStatus | "all">(
    "all"
  );

  const loadQuotations = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      setQuotations(await quotationService.getQuotations());
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to load quotations."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoLoad) {
      void loadQuotations();
    }
  }, [autoLoad, loadQuotations]);

  const filteredQuotations = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return quotations.filter((quotation) => {
      const matchesStatus =
        statusFilter === "all" || quotation.status === statusFilter;
      const matchesSearch =
        !normalizedSearch ||
        [
          quotation.quotation_number,
          quotation.title,
          quotation.client?.company_name
        ].some((value) => value?.toLowerCase().includes(normalizedSearch));

      return matchesStatus && matchesSearch;
    });
  }, [quotations, searchTerm, statusFilter]);

  async function createQuotation(data: QuotationFormData) {
    const payload: QuotationCreateInput = {
      ...data,
      created_by: user?.id ?? null
    };
    const createdQuotation = await quotationService.createQuotation(payload);
    setQuotations((currentQuotations) => [
      createdQuotation,
      ...currentQuotations
    ]);
    return createdQuotation;
  }

  async function updateQuotation(id: string, data: QuotationUpdateInput) {
    const updatedQuotation = await quotationService.updateQuotation(id, data);

    if (updatedQuotation) {
      setQuotations((currentQuotations) =>
        currentQuotations.map((quotation) =>
          quotation.id === id ? updatedQuotation : quotation
        )
      );
    }

    return updatedQuotation;
  }

  async function deleteQuotation(id: string) {
    if (profile?.role !== "admin") {
      throw new Error("Only admin users can delete quotations.");
    }

    await quotationService.deleteQuotation(id);
    setQuotations((currentQuotations) =>
      currentQuotations.filter((quotation) => quotation.id !== id)
    );
  }

  return {
    quotations,
    filteredQuotations,
    isLoading,
    errorMessage,
    searchTerm,
    statusFilter,
    setSearchTerm,
    setStatusFilter,
    loadQuotations,
    createQuotation,
    updateQuotation,
    deleteQuotation
  };
}
