"use client";

import { FormEvent, useEffect, useState } from "react";
import { ModuleScaffold } from "@/components/business/ModuleScaffold";
import { ProjectSelect } from "@/components/projects/ProjectSelect";
import { StatusPill } from "@/components/business/StatusPill";
import { AutocompleteInput } from "@/components/ui/AutocompleteInput";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Table } from "@/components/ui/Table";
import { maintenancePlanOptions } from "@/data/dropdownOptions";
import { useClients } from "@/hooks/useClients";
import { useMaintenance } from "@/hooks/useMaintenance";
import { maintenanceService } from "@/services/maintenanceService";
import { MAINTENANCE_STATUSES, TICKET_PRIORITIES, TICKET_STATUSES, type MaintenanceContractFormData, type SupportTicketFormData } from "@/types/maintenance";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatDate } from "@/utils/formatDate";

const maintenanceDefault: MaintenanceContractFormData = { client_id: "", project_id: "", contract_id: "", plan_name: "", start_date: "", end_date: "", monthly_fee: 0, yearly_fee: 0, included_hours: 0, status: "active", renewal_date: "", notes: "" };
const ticketDefault: SupportTicketFormData = { ticket_number: "", client_id: "", project_id: "", maintenance_contract_id: "", title: "", description: "", priority: "medium", status: "new", assigned_to: "", resolution_notes: "" };

export default function MaintenancePage() {
  const { contracts, filteredTickets, isLoading, errorMessage, ticketSearch, ticketStatusFilter, setTicketSearch, setTicketStatusFilter, saveMaintenanceContract, saveSupportTicket } = useMaintenance();
  const { clients } = useClients();
  const [maintenanceForm, setMaintenanceForm] = useState(maintenanceDefault);
  const [ticketForm, setTicketForm] = useState(ticketDefault);

  useEffect(() => {
    void maintenanceService.generateTicketNumber().then((number) => setTicketForm((current) => ({ ...current, ticket_number: number })));
  }, []);

  async function submitMaintenance(event: FormEvent) {
    event.preventDefault();
    await saveMaintenanceContract(maintenanceForm);
    setMaintenanceForm(maintenanceDefault);
  }

  async function submitTicket(event: FormEvent) {
    event.preventDefault();
    await saveSupportTicket(ticketForm);
    setTicketForm(ticketDefault);
  }

  return (
    <ModuleScaffold title="Maintenance" eyebrow="Maintenance & Support" description="Track maintenance contracts, renewals, and support tickets." errorMessage={errorMessage} isLoading={isLoading} isEmpty={false}>
      <Card><form className="client-form" onSubmit={submitMaintenance}><h2>Maintenance Contract</h2><div className="form-grid two-columns"><label>Client<select value={maintenanceForm.client_id} onChange={(e) => setMaintenanceForm({ ...maintenanceForm, client_id: e.target.value, project_id: "" })}><option value="">Select client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.company_name}</option>)}</select></label><label>Project<ProjectSelect clientId={maintenanceForm.client_id} value={maintenanceForm.project_id} onChange={(projectId) => setMaintenanceForm({ ...maintenanceForm, project_id: projectId })} /></label><label>Plan<AutocompleteInput value={maintenanceForm.plan_name} onChange={(e) => setMaintenanceForm({ ...maintenanceForm, plan_name: e.target.value })} options={maintenancePlanOptions} placeholder="Search maintenance plan" /></label><label>Status<select value={maintenanceForm.status} onChange={(e) => setMaintenanceForm({ ...maintenanceForm, status: e.target.value as MaintenanceContractFormData["status"] })}>{MAINTENANCE_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></label><label>Renewal date<Input type="date" value={maintenanceForm.renewal_date} onChange={(e) => setMaintenanceForm({ ...maintenanceForm, renewal_date: e.target.value })} /></label><label>Monthly fee<Input type="number" value={maintenanceForm.monthly_fee} onChange={(e) => setMaintenanceForm({ ...maintenanceForm, monthly_fee: Number(e.target.value) })} /></label><label>Included hours<Input type="number" value={maintenanceForm.included_hours} onChange={(e) => setMaintenanceForm({ ...maintenanceForm, included_hours: Number(e.target.value) })} /></label></div><label>Notes<textarea rows={2} value={maintenanceForm.notes} onChange={(e) => setMaintenanceForm({ ...maintenanceForm, notes: e.target.value })} /></label><div className="form-actions"><Button type="submit">Add Maintenance Contract</Button></div></form></Card>
      <Card><form className="client-form" onSubmit={submitTicket}><h2>Support Ticket</h2><div className="form-grid two-columns"><label>Ticket number<Input value={ticketForm.ticket_number} onChange={(e) => setTicketForm({ ...ticketForm, ticket_number: e.target.value })} /></label><label>Client<select value={ticketForm.client_id} onChange={(e) => setTicketForm({ ...ticketForm, client_id: e.target.value, project_id: "" })}><option value="">Select client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.company_name}</option>)}</select></label><label>Project<ProjectSelect clientId={ticketForm.client_id} value={ticketForm.project_id} onChange={(projectId) => setTicketForm({ ...ticketForm, project_id: projectId })} /></label><label>Title<Input value={ticketForm.title} onChange={(e) => setTicketForm({ ...ticketForm, title: e.target.value })} /></label><label>Priority<select value={ticketForm.priority} onChange={(e) => setTicketForm({ ...ticketForm, priority: e.target.value as SupportTicketFormData["priority"] })}>{TICKET_PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select></label><label>Status<select value={ticketForm.status} onChange={(e) => setTicketForm({ ...ticketForm, status: e.target.value as SupportTicketFormData["status"] })}>{TICKET_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></label></div><label>Description<textarea rows={3} value={ticketForm.description} onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })} /></label><label>Resolution notes<textarea rows={2} value={ticketForm.resolution_notes} onChange={(e) => setTicketForm({ ...ticketForm, resolution_notes: e.target.value })} /></label><div className="form-actions"><Button type="submit">Create Ticket</Button></div></form></Card>
      <Card><h2>Maintenance Contracts</h2><Table><thead><tr><th>Plan</th><th>Client</th><th>Status</th><th>Monthly</th><th>Renewal</th></tr></thead><tbody>{contracts.map((contract) => <tr key={contract.id}><td>{contract.plan_name}</td><td>{contract.client?.company_name || "-"}</td><td><StatusPill value={contract.status} /></td><td>{formatCurrency(contract.monthly_fee)}</td><td>{contract.renewal_date ? formatDate(contract.renewal_date) : "-"}</td></tr>)}</tbody></Table></Card>
      <Card className="toolbar-card"><div className="clients-toolbar"><Input placeholder="Search tickets" value={ticketSearch} onChange={(e) => setTicketSearch(e.target.value)} /><select value={ticketStatusFilter} onChange={(e) => setTicketStatusFilter(e.target.value as typeof ticketStatusFilter)}><option value="all">All ticket statuses</option>{TICKET_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></div></Card>
      <Table><thead><tr><th>Ticket</th><th>Client</th><th>Priority</th><th>Status</th><th>Opened</th></tr></thead><tbody>{filteredTickets.map((ticket) => <tr key={ticket.id}><td>{ticket.ticket_number}<small>{ticket.title}</small></td><td>{ticket.client?.company_name || "-"}</td><td>{ticket.priority}</td><td><StatusPill value={ticket.status} /></td><td>{formatDate(ticket.opened_at)}</td></tr>)}</tbody></Table>
    </ModuleScaffold>
  );
}
