"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { contractService } from "@/services/contractService";
import type { Contract, ContractFormData, ContractStatus, ContractType } from "@/types/contract";

export function useContracts() {
  const { user, profile } = useAuth();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<ContractStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<ContractType | "all">("all");

  async function loadContracts() {
    setIsLoading(true);
    setErrorMessage("");
    try {
      setContracts(await contractService.getContracts());
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load contracts.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadContracts();
  }, []);

  const filteredContracts = useMemo(() => contracts.filter((contract) => {
    const q = searchTerm.toLowerCase();
    return (statusFilter === "all" || contract.status === statusFilter)
      && (typeFilter === "all" || contract.contract_type === typeFilter)
      && (!q || [contract.contract_number, contract.title, contract.client?.company_name].some((value) => value?.toLowerCase().includes(q)));
  }), [contracts, searchTerm, statusFilter, typeFilter]);

  async function saveContract(data: ContractFormData, id?: string) {
    const record = id
      ? await contractService.updateContract(id, data)
      : await contractService.createContract({ ...data, created_by: user?.id ?? null });
    await loadContracts();
    return record;
  }

  async function deleteContract(id: string) {
    if (profile?.role !== "admin") throw new Error("Only admin users can delete contracts.");
    await contractService.deleteContract(id);
    setContracts((current) => current.filter((contract) => contract.id !== id));
  }

  return { contracts, filteredContracts, isLoading, errorMessage, searchTerm, statusFilter, typeFilter, setSearchTerm, setStatusFilter, setTypeFilter, saveContract, deleteContract, loadContracts };
}
