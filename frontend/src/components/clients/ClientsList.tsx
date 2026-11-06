"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ClientStatusBadge } from "@/components/clients/ClientStatusBadge";
import { clientStatusLabels } from "@/components/clients/clientLabels";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { Table } from "@/components/ui/Table";
import { useClients } from "@/hooks/useClients";
import { CLIENT_STATUSES, type Client } from "@/types/client";

export function ClientsList() {
  const {
    clients,
    filteredClients,
    isLoading,
    errorMessage,
    searchTerm,
    statusFilter,
    setSearchTerm,
    setStatusFilter,
    deleteClient
  } = useClients();

  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [industryFilter, setIndustryFilter] = useState("all");
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Industry options
  const industries = useMemo(() => {
    const set = new Set<string>();
    clients.forEach((c) => {
      if (c.industry) set.add(c.industry);
    });
    return Array.from(set);
  }, [clients]);

  // Combined client filtering
  const displayedClients = useMemo(() => {
    return filteredClients.filter((c) => {
      if (industryFilter !== "all" && c.industry !== industryFilter) return false;
      return true;
    });
  }, [filteredClients, industryFilter]);

  async function handleDelete() {
    if (!clientToDelete) return;
    setIsDeleting(true);
    setDeleteError("");
    try {
      await deleteClient(clientToDelete.id);
      setClientToDelete(null);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Unable to delete client.");
    } finally {
      setIsDeleting(false);
    }
  }

  const activeCount = clients.filter((c) => c.status === "active").length;
  const leadCount = clients.filter((c) => c.status === "lead" || c.status === "proposal_sent").length;

  return (
    <section className="module-page clients-directory">
      {/* Header */}
      <div className="module-header">
        <div>
          <p className="eyebrow">CRM & Accounts</p>
          <h1>Clients Directory</h1>
          <p className="muted">
            Manage organization accounts, commercial portfolios, and stakeholder relationships.
          </p>
        </div>
        <div className="module-header-actions" style={{ display: "flex", gap: 10 }}>
          <Link href="/clients/new">
            <button type="button" className="wizard-btn-ghost">
              + Quick Add
            </button>
          </Link>
        </div>
      </div>

      {/* Top Stat Counters */}
      <div className="payments-kpi-deck" style={{ marginBottom: 16 }}>
        <div className="payment-stat-card">
          <span className="stat-label">Total Accounts</span>
          <strong className="stat-value">{clients.length}</strong>
          <small className="stat-sub">Registered organizations</small>
        </div>
        <div className="payment-stat-card">
          <span className="stat-label">Active Engagements</span>
          <strong className="stat-value text-emerald">{activeCount}</strong>
          <small className="stat-sub">In operational service</small>
        </div>
        <div className="payment-stat-card">
          <span className="stat-label">Pipeline & Leads</span>
          <strong className="stat-value text-amber">{leadCount}</strong>
          <small className="stat-sub">Commercial qualification</small>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <Card className="toolbar-card">
        <div className="clients-toolbar" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="text"
            className="input-base"
            style={{ flex: 1, minWidth: 240 }}
            placeholder="Search company, contact person, email, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <select
            className="input-base"
            style={{ width: "auto" }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          >
            <option value="all">All Statuses</option>
            {CLIENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {clientStatusLabels[status]}
              </option>
            ))}
          </select>

          {industries.length > 0 && (
            <select
              className="input-base"
              style={{ width: "auto" }}
              value={industryFilter}
              onChange={(e) => setIndustryFilter(e.target.value)}
            >
              <option value="all">All Industries</option>
              {industries.map((ind) => (
                <option key={ind} value={ind}>{ind}</option>
              ))}
            </select>
          )}

          {/* Grid vs Table View Mode Switcher */}
          <div className="chart-toggle-pills" style={{ marginLeft: "auto" }}>
            <button
              type="button"
              className={`chart-pill-btn ${viewMode === "grid" ? "active" : ""}`}
              onClick={() => setViewMode("grid")}
            >
              ⊞ Grid
            </button>
            <button
              type="button"
              className={`chart-pill-btn ${viewMode === "table" ? "active" : ""}`}
              onClick={() => setViewMode("table")}
            >
              ☰ Table
            </button>
          </div>
        </div>
      </Card>

      {errorMessage ? <div className="form-error">{errorMessage}</div> : null}

      {isLoading ? (
        <Card>
          <div className="loading-state">Loading accounts directory...</div>
        </Card>
      ) : displayedClients.length === 0 ? (
        <Card>
          <EmptyState
            title="No clients found"
            description="No client accounts match your active search or filters."
            action={
              <Link href="/clients/new">
                <button type="button" className="wizard-btn-primary">Add your first client</button>
              </Link>
            }
          />
        </Card>
      ) : viewMode === "grid" ? (
        /* GRID VIEW */
        <div className="client-grid-cards">
          {displayedClients.map((client) => {
            const initials = client.company_name
              ? client.company_name
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((w) => w[0]?.toUpperCase())
                  .join("")
              : "CL";

            return (
              <div key={client.id} className="interactive-client-card">
                <div className="card-top-header">
                  <div className="client-avatar-pill">
                    <span>{initials}</span>
                  </div>
                  <div className="client-meta">
                    <Link href={`/clients/${client.id}`} className="client-name-link">
                      {client.company_name}
                    </Link>
                    <span className="client-person-sub">
                      {client.contact_person || "Designated Stakeholder"}
                    </span>
                  </div>
                  <ClientStatusBadge status={client.status} />
                </div>

                <div className="client-metrics-trio">
                  <div className="metric-chip">
                    <span className="chip-label">Industry</span>
                    <strong className="chip-value" style={{ fontSize: "0.78rem" }}>
                      {client.industry || "Enterprise"}
                    </strong>
                  </div>
                  <div className="metric-chip">
                    <span className="chip-label">Location</span>
                    <strong className="chip-value" style={{ fontSize: "0.78rem" }}>
                      {client.city || client.country || "India"}
                    </strong>
                  </div>
                  <div className="metric-chip">
                    <span className="chip-label">Payment Terms</span>
                    <strong className="chip-value" style={{ fontSize: "0.78rem" }}>
                      {client.payment_terms || "Net 30"}
                    </strong>
                  </div>
                </div>

                <div className="client-card-footer">
                  <div className="contact-quick-links">
                    {client.email && (
                      <a href={`mailto:${client.email}`} className="footer-icon-link" title={`Email ${client.email}`}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect width="20" height="16" x="2" y="4" rx="2"/>
                          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                        </svg>
                        Email
                      </a>
                    )}
                    {client.phone && (
                      <a href={`tel:${client.phone}`} className="footer-icon-link" title={`Call ${client.phone}`}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                        </svg>
                        Call
                      </a>
                    )}
                  </div>

                  <Link href={`/clients/${client.id}`} className="view-account-arrow">
                    360° Profile &rarr;
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <Card>
          <Table>
            <thead>
              <tr>
                <th>Organization</th>
                <th>Contact Person</th>
                <th>Industry</th>
                <th>City / Country</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedClients.map((client) => (
                <tr key={client.id}>
                  <td>
                    <Link href={`/clients/${client.id}`} className="table-code-link">
                      <strong>{client.company_name}</strong>
                    </Link>
                    {client.client_short_name && (
                      <span className="code-tag" style={{ marginLeft: 6 }}>{client.client_short_name}</span>
                    )}
                  </td>
                  <td>{client.contact_person || "-"}</td>
                  <td>{client.industry || "Enterprise"}</td>
                  <td>{client.city ? `${client.city}, ${client.country}` : client.country}</td>
                  <td>
                    <ClientStatusBadge status={client.status} />
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 10 }}>
                      <Link href={`/clients/${client.id}`} className="btn-link">
                        View
                      </Link>
                      <Link href={`/clients/${client.id}/edit`} className="btn-link">
                        Edit
                      </Link>
                      <button
                        type="button"
                        className="btn-link text-danger"
                        onClick={() => setClientToDelete(client)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {/* Delete Confirmation Modal */}
      {clientToDelete && (
        <Modal>
          <div className="modal-top" style={{ marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Delete {clientToDelete.company_name}?</h3>
            <button type="button" className="close-btn" onClick={() => setClientToDelete(null)}>✕</button>
          </div>
          <p>
            Are you sure you want to remove <strong>{clientToDelete.company_name}</strong>? This action will check for dependent project or invoice records.
          </p>
          {deleteError && <div className="form-error">{deleteError}</div>}
          <div className="modal-actions">
            <button type="button" className="wizard-btn-ghost" onClick={() => setClientToDelete(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="wizard-btn-danger"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Confirm Delete"}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
