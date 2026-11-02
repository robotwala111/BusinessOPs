"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { maintenanceService } from "@/services/maintenanceService";
import type { MaintenanceContract, MaintenanceContractFormData, SupportTicket, SupportTicketFormData, TicketStatus } from "@/types/maintenance";

export function useMaintenance() {
  const { user } = useAuth();
  const [contracts, setContracts] = useState<MaintenanceContract[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [ticketSearch, setTicketSearch] = useState("");
  const [ticketStatusFilter, setTicketStatusFilter] = useState<TicketStatus | "all">("all");

  async function loadMaintenance() {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const [nextContracts, nextTickets] = await Promise.all([
        maintenanceService.getMaintenanceContracts(),
        maintenanceService.getSupportTickets()
      ]);
      setContracts(nextContracts);
      setTickets(nextTickets);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load maintenance records.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadMaintenance();
  }, []);

  const filteredTickets = useMemo(() => tickets.filter((ticket) => {
    const q = ticketSearch.toLowerCase();
    return (ticketStatusFilter === "all" || ticket.status === ticketStatusFilter)
      && (!q || [ticket.ticket_number, ticket.title, ticket.client?.company_name].some((value) => value?.toLowerCase().includes(q)));
  }), [tickets, ticketSearch, ticketStatusFilter]);

  async function saveMaintenanceContract(data: MaintenanceContractFormData, id?: string) {
    await maintenanceService.saveMaintenanceContract({ ...data, id, created_by: user?.id ?? null });
    await loadMaintenance();
  }

  async function saveSupportTicket(data: SupportTicketFormData, id?: string) {
    await maintenanceService.saveSupportTicket({ ...data, id, created_by: user?.id ?? null });
    await loadMaintenance();
  }

  return { contracts, tickets, filteredTickets, isLoading, errorMessage, ticketSearch, ticketStatusFilter, setTicketSearch, setTicketStatusFilter, saveMaintenanceContract, saveSupportTicket, loadMaintenance };
}
