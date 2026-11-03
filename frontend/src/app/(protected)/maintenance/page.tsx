"use client";

import Link from "next/link";
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
import {
  MAINTENANCE_STATUSES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type MaintenanceContractFormData,
  type SupportTicketFormData
} from "@/types/maintenance";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatDate } from "@/utils/formatDate";

const maintenanceDefault: MaintenanceContractFormData = {
  client_id: "",
  project_id: "",
  contract_id: "",
  plan_name: "",
  start_date: "",
  end_date: "",
  monthly_fee: 0,
  yearly_fee: 0,
  included_hours: 0,
  response_sla_hours: 4,
  resolution_sla_hours: 24,
  status: "active",
  renewal_date: "",
  notes: ""
};

const ticketDefault: SupportTicketFormData = {
  ticket_number: "",
  client_id: "",
  project_id: "",
  maintenance_contract_id: "",
  title: "",
  description: "",
  priority: "medium",
  status: "new",
  assigned_to: "",
  resolution_notes: ""
};

export default function MaintenancePage() {
  const {
    contracts,
    filteredTickets,
    isLoading,
    errorMessage,
    ticketSearch,
    ticketStatusFilter,
    setTicketSearch,
    setTicketStatusFilter,
    saveMaintenanceContract,
    saveSupportTicket
  } = useMaintenance();
  const { clients } = useClients();
  const [maintenanceForm, setMaintenanceForm] = useState(maintenanceDefault);
  const [ticketForm, setTicketForm] = useState(ticketDefault);
  const [showAddContract, setShowAddContract] = useState(false);
  const [showAddTicket, setShowAddTicket] = useState(false);

  useEffect(() => {
    void maintenanceService
      .generateTicketNumber()
      .then((number) => setTicketForm((current) => ({ ...current, ticket_number: number })));
  }, []);

  async function submitMaintenance(event: FormEvent) {
    event.preventDefault();
    await saveMaintenanceContract(maintenanceForm);
    setMaintenanceForm(maintenanceDefault);
    setShowAddContract(false);
  }

  async function submitTicket(event: FormEvent) {
    event.preventDefault();
    await saveSupportTicket(ticketForm);
    setTicketForm(ticketDefault);
    setShowAddTicket(false);
  }

  return (
    <ModuleScaffold
      title="Maintenance & SLA"
      eyebrow="Recurring Engagements"
      description="Manage annual maintenance contracts (AMC), included support quotas, and active service requests."
      errorMessage={errorMessage}
      isLoading={isLoading}
      isEmpty={false}
    >
      {/* Quick Action Buttons */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "16px" }}>
        <div style={{ display: "flex", gap: "10px" }}>
          <Button onClick={() => setShowAddContract(!showAddContract)}>
            {showAddContract ? "Cancel Contract Form" : "+ New Maintenance Agreement"}
          </Button>
          <Button variant="secondary" onClick={() => setShowAddTicket(!showAddTicket)}>
            {showAddTicket ? "Cancel Ticket Form" : "+ Log Support Ticket"}
          </Button>
        </div>
        <Link href="/support" style={{ fontWeight: 700, color: "#d97706", fontSize: "0.88rem" }}>
          Go to Dedicated Support Desk &rarr;
        </Link>
      </div>

      {showAddContract && (
        <Card style={{ marginBottom: "20px" }}>
          <form className="client-form" onSubmit={submitMaintenance}>
            <h2 style={{ fontSize: "1.15rem", margin: 0 }}>Add Maintenance Agreement</h2>
            <div className="form-grid two-columns">
              <label>
                Client
                <select
                  value={maintenanceForm.client_id}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, client_id: e.target.value, project_id: "" })}
                  required
                >
                  <option value="">Select client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.company_name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Project
                <ProjectSelect
                  clientId={maintenanceForm.client_id}
                  value={maintenanceForm.project_id}
                  onChange={(projectId) => setMaintenanceForm({ ...maintenanceForm, project_id: projectId })}
                />
              </label>
              <label>
                Plan / Package
                <AutocompleteInput
                  value={maintenanceForm.plan_name}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, plan_name: e.target.value })}
                  options={maintenancePlanOptions}
                  placeholder="e.g. Platinum 24/7 SLA"
                  required
                />
              </label>
              <label>
                Agreement Status
                <select
                  value={maintenanceForm.status}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, status: e.target.value as MaintenanceContractFormData["status"] })}
                >
                  {MAINTENANCE_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status.toUpperCase()}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Monthly Retainer (₹)
                <Input
                  type="number"
                  value={maintenanceForm.monthly_fee}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, monthly_fee: Number(e.target.value) })}
                />
              </label>
              <label>
                Included Hours / Month
                <Input
                  type="number"
                  value={maintenanceForm.included_hours}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, included_hours: Number(e.target.value) })}
                />
              </label>
              <label>
                Response SLA Target (Hours)
                <Input
                  type="number"
                  value={maintenanceForm.response_sla_hours ?? 4}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, response_sla_hours: Number(e.target.value) })}
                />
              </label>
              <label>
                Resolution SLA Target (Hours)
                <Input
                  type="number"
                  value={maintenanceForm.resolution_sla_hours ?? 24}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, resolution_sla_hours: Number(e.target.value) })}
                />
              </label>
              <label>
                Start Date
                <Input
                  type="date"
                  value={maintenanceForm.start_date}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, start_date: e.target.value })}
                />
              </label>
              <label>
                Next Renewal Date
                <Input
                  type="date"
                  value={maintenanceForm.renewal_date}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, renewal_date: e.target.value })}
                />
              </label>
            </div>
            <label style={{ marginTop: "10px" }}>
              Notes & Inclusions
              <textarea
                rows={2}
                value={maintenanceForm.notes}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, notes: e.target.value })}
              />
            </label>
            <div className="form-actions" style={{ marginTop: "12px" }}>
              <Button type="submit">Save Agreement</Button>
            </div>
          </form>
        </Card>
      )}

      {showAddTicket && (
        <Card style={{ marginBottom: "20px" }}>
          <form className="client-form" onSubmit={submitTicket}>
            <h2 style={{ fontSize: "1.15rem", margin: 0 }}>Log New Support Incident</h2>
            <div className="form-grid two-columns">
              <label>
                Ticket Number
                <Input
                  value={ticketForm.ticket_number}
                  onChange={(e) => setTicketForm({ ...ticketForm, ticket_number: e.target.value })}
                  required
                />
              </label>
              <label>
                Client
                <select
                  value={ticketForm.client_id}
                  onChange={(e) => setTicketForm({ ...ticketForm, client_id: e.target.value, project_id: "" })}
                  required
                >
                  <option value="">Select client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.company_name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Project
                <ProjectSelect
                  clientId={ticketForm.client_id}
                  value={ticketForm.project_id}
                  onChange={(projectId) => setTicketForm({ ...ticketForm, project_id: projectId })}
                />
              </label>
              <label>
                Subject / Title
                <Input
                  value={ticketForm.title}
                  onChange={(e) => setTicketForm({ ...ticketForm, title: e.target.value })}
                  required
                />
              </label>
              <label>
                Priority
                <select
                  value={ticketForm.priority}
                  onChange={(e) => setTicketForm({ ...ticketForm, priority: e.target.value as SupportTicketFormData["priority"] })}
                >
                  {TICKET_PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority.toUpperCase()}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Status
                <select
                  value={ticketForm.status}
                  onChange={(e) => setTicketForm({ ...ticketForm, status: e.target.value as SupportTicketFormData["status"] })}
                >
                  {TICKET_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label style={{ marginTop: "10px" }}>
              Incident Details
              <textarea
                rows={3}
                value={ticketForm.description}
                onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })}
              />
            </label>
            <div className="form-actions" style={{ marginTop: "12px" }}>
              <Button type="submit">Submit Ticket</Button>
            </div>
          </form>
        </Card>
      )}

      {/* Maintenance Contracts Register */}
      <Card style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "1.1rem", marginBottom: "14px" }}>Active Maintenance Contracts</h2>
        <Table>
          <thead>
            <tr>
              <th>Plan Name</th>
              <th>Client</th>
              <th>Status</th>
              <th>Included Hours</th>
              <th>Monthly Retainer</th>
              <th>Next Renewal</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {contracts.length > 0 ? (
              contracts.map((contract) => (
                <tr key={contract.id}>
                  <td>
                    <Link href={`/maintenance/${contract.id}`} className="table-code-link">
                      <strong>{contract.plan_name}</strong>
                    </Link>
                  </td>
                  <td>{contract.client?.company_name || "-"}</td>
                  <td>
                    <StatusPill value={contract.status} />
                  </td>
                  <td>{contract.included_hours}h / mo</td>
                  <td style={{ fontWeight: 600 }}>{formatCurrency(contract.monthly_fee)}</td>
                  <td>{contract.renewal_date ? formatDate(contract.renewal_date) : "-"}</td>
                  <td>
                    <Link href={`/maintenance/${contract.id}`} style={{ color: "#d97706", fontWeight: 600, fontSize: "0.82rem" }}>
                      Manage &rarr;
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="table-empty-cell">
                  No maintenance contracts registered yet.
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>

      {/* Support Tickets Section */}
      <Card className="toolbar-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <h2 style={{ fontSize: "1.1rem", margin: 0 }}>Recent Support Incident Tickets</h2>
          <Link href="/support" style={{ fontSize: "0.82rem", fontWeight: 600, color: "#d97706" }}>
            Open Dedicated Tickets Board &rarr;
          </Link>
        </div>
        <div className="clients-toolbar">
          <Input
            placeholder="Search tickets by ID, title, or client..."
            value={ticketSearch}
            onChange={(e) => setTicketSearch(e.target.value)}
          />
          <select
            value={ticketStatusFilter}
            onChange={(e) => setTicketStatusFilter(e.target.value as typeof ticketStatusFilter)}
          >
            <option value="all">All ticket statuses</option>
            {TICKET_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
      </Card>

      <Card>
        <Table>
          <thead>
            <tr>
              <th>Ticket ID</th>
              <th>Subject</th>
              <th>Client</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Opened</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredTickets.length > 0 ? (
              filteredTickets.map((ticket) => (
                <tr key={ticket.id}>
                  <td>
                    <Link href={`/support/${ticket.id}`} className="table-code-link">
                      {ticket.ticket_number}
                    </Link>
                  </td>
                  <td>{ticket.title}</td>
                  <td>{ticket.client?.company_name || "-"}</td>
                  <td>
                    <span style={{ textTransform: "uppercase", fontSize: "0.75rem", fontWeight: 700 }}>
                      {ticket.priority}
                    </span>
                  </td>
                  <td>
                    <StatusPill value={ticket.status} />
                  </td>
                  <td>{formatDate(ticket.opened_at)}</td>
                  <td>
                    <Link href={`/support/${ticket.id}`} style={{ color: "#d97706", fontWeight: 600, fontSize: "0.82rem" }}>
                      View &rarr;
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="table-empty-cell">
                  No support tickets found matching the search.
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>
    </ModuleScaffold>
  );
}
