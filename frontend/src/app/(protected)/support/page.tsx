"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ModuleScaffold } from "@/components/business/ModuleScaffold";
import { StatusPill } from "@/components/business/StatusPill";
import { ProjectSelect } from "@/components/projects/ProjectSelect";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Table } from "@/components/ui/Table";
import { useClients } from "@/hooks/useClients";
import { useMaintenance } from "@/hooks/useMaintenance";
import { maintenanceService } from "@/services/maintenanceService";
import {
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type SupportTicketFormData,
  type TicketPriority,
  type TicketStatus
} from "@/types/maintenance";
import { formatDate } from "@/utils/formatDate";

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

export default function SupportTicketsPage() {
  const { tickets, isLoading, errorMessage, saveSupportTicket, loadMaintenance } = useMaintenance();
  const { clients } = useClients();
  const [ticketForm, setTicketForm] = useState(ticketDefault);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | "all">("all");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    void maintenanceService
      .generateTicketNumber()
      .then((number) => setTicketForm((current) => ({ ...current, ticket_number: number })));
  }, []);

  async function handleCreateTicket(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    setIsSubmitting(true);

    try {
      if (!ticketForm.client_id) throw new Error("Please select a client.");
      if (!ticketForm.title.trim()) throw new Error("Please enter a ticket title.");

      await saveSupportTicket(ticketForm);
      setShowCreateForm(false);
      const nextNumber = await maintenanceService.generateTicketNumber();
      setTicketForm({ ...ticketDefault, ticket_number: nextNumber });
      await loadMaintenance();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create support ticket.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        t.ticket_number.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q) ||
        t.client?.company_name.toLowerCase().includes(q) ||
        (t.assigned_to && t.assigned_to.toLowerCase().includes(q));

      const matchesStatus = statusFilter === "all" || t.status === statusFilter;
      const matchesPriority = priorityFilter === "all" || t.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [tickets, searchQuery, statusFilter, priorityFilter]);

  // Statistics
  const openCount = tickets.filter((t) => ["new", "assigned", "in_progress", "reopened"].includes(t.status)).length;
  const inProgressCount = tickets.filter((t) => t.status === "in_progress").length;
  const resolvedCount = tickets.filter((t) => ["resolved", "closed"].includes(t.status)).length;
  const breachedCount = tickets.filter((t) => {
    if (["resolved", "closed", "cancelled"].includes(t.status)) return false;
    return t.resolution_deadline ? new Date(t.resolution_deadline).getTime() < Date.now() : false;
  }).length;

  return (
    <ModuleScaffold
      title="Support Tickets"
      eyebrow="Customer Operations"
      description="Track incident reports, client support requests, SLA compliance, and billable service hours."
      errorMessage={errorMessage}
      isLoading={isLoading}
      isEmpty={false}
    >
      {/* Top Level Summary Cards */}
      <div className="dashboard-grid-secondary" style={{ marginBottom: "20px" }}>
        <div className="secondary-metric-card">
          <div className="secondary-metric-body">
            <span className="secondary-metric-label">Total Tickets</span>
            <strong className="secondary-metric-value">{tickets.length}</strong>
            <span className="secondary-metric-sub">All time</span>
          </div>
        </div>
        <div className="secondary-metric-card">
          <div className="secondary-metric-body">
            <span className="secondary-metric-label">Active / Open</span>
            <strong className="secondary-metric-value" style={{ color: "#d97706" }}>{openCount}</strong>
            <span className="secondary-metric-sub">{inProgressCount} in progress</span>
          </div>
        </div>
        <div className="secondary-metric-card">
          <div className="secondary-metric-body">
            <span className="secondary-metric-label">Resolved / Closed</span>
            <strong className="secondary-metric-value" style={{ color: "#059669" }}>{resolvedCount}</strong>
            <span className="secondary-metric-sub">Completed</span>
          </div>
        </div>
        <div className="secondary-metric-card">
          <div className="secondary-metric-body">
            <span className="secondary-metric-label">SLA Breaches</span>
            <strong className="secondary-metric-value" style={{ color: breachedCount > 0 ? "#dc2626" : "#475569" }}>
              {breachedCount}
            </strong>
            <span className="secondary-metric-sub">Requires urgent attention</span>
          </div>
        </div>
      </div>

      {/* Header Action & Filter Toolbar */}
      <Card className="toolbar-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "14px" }}>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Tickets Directory</h2>
          <Button onClick={() => setShowCreateForm(!showCreateForm)}>
            {showCreateForm ? "Close Form" : "+ Create Support Ticket"}
          </Button>
        </div>

        {showCreateForm && (
          <form className="client-form" onSubmit={handleCreateTicket} style={{ marginBottom: "24px", paddingBottom: "20px", borderBottom: "1px solid #e2e8f0" }}>
            {formError && <div className="form-error">{formError}</div>}
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
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company_name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Project (Optional)
                <ProjectSelect
                  clientId={ticketForm.client_id}
                  value={ticketForm.project_id}
                  onChange={(pId) => setTicketForm({ ...ticketForm, project_id: pId })}
                />
              </label>
              <label>
                Ticket Title
                <Input
                  placeholder="e.g. Production login 500 error"
                  value={ticketForm.title}
                  onChange={(e) => setTicketForm({ ...ticketForm, title: e.target.value })}
                  required
                />
              </label>
              <label>
                Priority
                <select
                  value={ticketForm.priority}
                  onChange={(e) => setTicketForm({ ...ticketForm, priority: e.target.value as TicketPriority })}
                >
                  {TICKET_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p.toUpperCase()}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Initial Status
                <select
                  value={ticketForm.status}
                  onChange={(e) => setTicketForm({ ...ticketForm, status: e.target.value as TicketStatus })}
                >
                  {TICKET_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Assigned Staff / Lead
                <Input
                  placeholder="Name or email"
                  value={ticketForm.assigned_to}
                  onChange={(e) => setTicketForm({ ...ticketForm, assigned_to: e.target.value })}
                />
              </label>
            </div>
            <label style={{ marginTop: "12px" }}>
              Incident Description
              <textarea
                rows={3}
                placeholder="Detailed explanation of the issue or support request..."
                value={ticketForm.description}
                onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })}
              />
            </label>
            <div className="form-actions" style={{ marginTop: "16px" }}>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Save Support Ticket"}
              </Button>
            </div>
          </form>
        )}

        <div className="clients-toolbar" style={{ gridTemplateColumns: "minmax(200px, 1fr) 180px 180px" }}>
          <Input
            placeholder="Search tickets by number, title, or client..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as TicketStatus | "all")}>
            <option value="all">All Statuses</option>
            {TICKET_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as TicketPriority | "all")}>
            <option value="all">All Priorities</option>
            {TICKET_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* Tickets List Table */}
      <Card>
        <Table>
          <thead>
            <tr>
              <th>Ticket ID</th>
              <th>Issue Title</th>
              <th>Client</th>
              <th>Priority</th>
              <th>Status</th>
              <th>SLA Status</th>
              <th>Opened</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredTickets.length > 0 ? (
              filteredTickets.map((ticket) => {
                const isClosed = ["resolved", "closed", "cancelled"].includes(ticket.status);
                const isBreached = !isClosed && ticket.resolution_deadline && new Date(ticket.resolution_deadline).getTime() < Date.now();
                return (
                  <tr key={ticket.id}>
                    <td>
                      <Link href={`/support/${ticket.id}`} className="table-code-link">
                        {ticket.ticket_number}
                      </Link>
                    </td>
                    <td>
                      <strong>{ticket.title}</strong>
                      {ticket.description && (
                        <small style={{ display: "block", color: "#64748b", maxWidth: "320px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {ticket.description}
                        </small>
                      )}
                    </td>
                    <td>{ticket.client?.company_name || "-"}</td>
                    <td>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: "4px",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          backgroundColor:
                            ticket.priority === "urgent"
                              ? "#fee2e2"
                              : ticket.priority === "high"
                              ? "#ffedd5"
                              : ticket.priority === "medium"
                              ? "#fef9c3"
                              : "#f1f5f9",
                          color:
                            ticket.priority === "urgent"
                              ? "#b91c1c"
                              : ticket.priority === "high"
                              ? "#c2410c"
                              : ticket.priority === "medium"
                              ? "#854d0e"
                              : "#475569"
                        }}
                      >
                        {ticket.priority}
                      </span>
                    </td>
                    <td>
                      <StatusPill value={ticket.status} />
                    </td>
                    <td>
                      {isBreached ? (
                        <span style={{ color: "#dc2626", fontWeight: 700, fontSize: "0.75rem", backgroundColor: "#fef2f2", padding: "2px 6px", borderRadius: "4px" }}>
                          ⚠️ SLA Breached
                        </span>
                      ) : ticket.resolution_deadline && !isClosed ? (
                        <span style={{ color: "#059669", fontSize: "0.75rem" }}>
                          Due {formatDate(ticket.resolution_deadline)}
                        </span>
                      ) : (
                        <span style={{ color: "#94a3b8", fontSize: "0.75rem" }}>—</span>
                      )}
                    </td>
                    <td style={{ fontSize: "0.8rem", color: "#64748b" }}>{formatDate(ticket.opened_at)}</td>
                    <td>
                      <Link href={`/support/${ticket.id}`} style={{ fontWeight: 600, color: "#d97706", fontSize: "0.82rem" }}>
                        View &rarr;
                      </Link>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} className="table-empty-cell">
                  No support tickets match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>
    </ModuleScaffold>
  );
}

