"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { leadService } from "@/services/leadService";
import type { Lead, LeadFormData, LeadPriority, LeadStatus } from "@/types/lead";

export function useLeads() {
  const { user, profile } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<LeadPriority | "all">("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [assignedToFilter, setAssignedToFilter] = useState("all");

  async function loadLeads() {
    setIsLoading(true);
    setErrorMessage("");
    try {
      setLeads(await leadService.getLeads());
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load leads.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadLeads();
  }, []);

  const sourceOptions = useMemo(
    () => Array.from(new Set(leads.map((lead) => lead.lead_source).filter(Boolean) as string[])).sort(),
    [leads]
  );
  const assignedToOptions = useMemo(
    () => Array.from(new Set(leads.map((lead) => lead.assigned_to).filter(Boolean) as string[])).sort(),
    [leads]
  );

  const filteredLeads = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return leads.filter((lead) =>
      (statusFilter === "all" || lead.status === statusFilter) &&
      (priorityFilter === "all" || lead.priority === priorityFilter) &&
      (sourceFilter === "all" || lead.lead_source === sourceFilter) &&
      (assignedToFilter === "all" || lead.assigned_to === assignedToFilter) &&
      (!q ||
        [lead.company_name, lead.contact_person, lead.email, lead.phone, lead.service_interested]
          .some((value) => value?.toLowerCase().includes(q)))
    );
  }, [assignedToFilter, leads, priorityFilter, searchTerm, sourceFilter, statusFilter]);

  async function saveLead(data: LeadFormData, id?: string) {
    const record = id
      ? await leadService.updateLead(id, data)
      : await leadService.createLead({ ...data, created_by: user?.id ?? null });
    await loadLeads();
    return record;
  }

  async function markLeadLost(id: string, lostReason: string) {
    await leadService.markLeadLost(id, lostReason);
    await loadLeads();
  }

  async function convertLead(id: string, createProject = true) {
    const result = await leadService.convertLeadToClient(id, user?.id ?? null, createProject);
    await loadLeads();
    return result;
  }

  async function deleteLead(id: string) {
    if (profile?.role !== "admin") throw new Error("Only admin users can delete leads.");
    await leadService.deleteLead(id);
    setLeads((current) => current.filter((lead) => lead.id !== id));
  }

  return {
    leads,
    filteredLeads,
    sourceOptions,
    assignedToOptions,
    isLoading,
    errorMessage,
    searchTerm,
    statusFilter,
    priorityFilter,
    sourceFilter,
    assignedToFilter,
    setSearchTerm,
    setStatusFilter,
    setPriorityFilter,
    setSourceFilter,
    setAssignedToFilter,
    saveLead,
    markLeadLost,
    convertLead,
    deleteLead,
    loadLeads
  };
}
