"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { clientService } from "@/services/clientService";
import { client360Service } from "@/services/client360Service";
import { projectService } from "@/services/projectService";
import { maintenanceService } from "@/services/maintenanceService";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatDate } from "@/utils/formatDate";
import type { Client } from "@/types/client";
import type { Project } from "@/types/project";
import type { Invoice } from "@/types/invoice";
import type { Quotation } from "@/types/quotation";
import type { SupportTicket, TicketPriority } from "@/types/maintenance";
import type { Client360Data } from "@/services/client360Service";

export default function ClientPortalPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [portalData, setPortalData] = useState<Client360Data | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "projects" | "invoices" | "quotes" | "support" | "profile">("overview");
  const [isLoading, setIsLoading] = useState(true);

  // New ticket state
  const [showNewTicketModal, setShowNewTicketModal] = useState(false);
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketDescription, setTicketDescription] = useState("");
  const [ticketPriority, setTicketPriority] = useState<TicketPriority>("medium");
  const [ticketMsg, setTicketMsg] = useState("");

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        const clientList = await clientService.getClients();
        setClients(clientList);
        if (clientList.length > 0) {
          const firstId = clientList[0].id;
          setSelectedClientId(firstId);
          const [data, prjs] = await Promise.all([
            client360Service.load(firstId),
            projectService.getProjectsByClient(firstId)
          ]);
          setPortalData(data);
          setProjects(prjs);
        }
      } catch (err) {
        console.error("Portal load error", err);
      } finally {
        setIsLoading(false);
      }
    }
    void init();
  }, []);

  async function handleSwitchClient(clientId: string) {
    setSelectedClientId(clientId);
    setIsLoading(true);
    try {
      const [data, prjs] = await Promise.all([
        client360Service.load(clientId),
        projectService.getProjectsByClient(clientId)
      ]);
      setPortalData(data);
      setProjects(prjs);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!ticketSubject.trim() || !selectedClientId) return;

    try {
      await maintenanceService.saveSupportTicket({
        ticket_number: `TKT-${Date.now().toString().slice(-4)}`,
        client_id: selectedClientId,
        project_id: "",
        maintenance_contract_id: "",
        title: ticketSubject.trim(),
        description: ticketDescription.trim(),
        priority: ticketPriority,
        status: "new",
        assigned_to: "",
        resolution_notes: "",
        created_by: null
      });
      setShowNewTicketModal(false);
      setTicketSubject("");
      setTicketDescription("");
      setTicketMsg("✓ Support ticket logged successfully! Our operations team has been notified.");
      setTimeout(() => setTicketMsg(""), 4000);

      // Reload
      const [data, prjs] = await Promise.all([
        client360Service.load(selectedClientId),
        projectService.getProjectsByClient(selectedClientId)
      ]);
      setPortalData(data);
      setProjects(prjs);
    } catch (err) {
      alert("Unable to create ticket: " + (err instanceof Error ? err.message : "Error"));
    }
  }

  const currentClient = clients.find((c) => c.id === selectedClientId) ?? null;

  if (isLoading && !portalData) {
    return (
      <div className="portal-loading-screen">
        <div className="portal-spinner" />
        <p>Initializing Secure Client Workspace...</p>
      </div>
    );
  }

  return (
    <div className="portal-root-shell">
      {/* Client Portal Header Bar */}
      <header className="portal-header-bar">
        <div className="portal-header-left">
          <div className="portal-brand-badge">
            <span className="brand-dot" />
            CLIENT WORKSPACE
          </div>
          <span className="portal-divider" />
          <h2 className="portal-company-heading">
            {currentClient?.company_name || "Enterprise Account"}
          </h2>
        </div>

        <div className="portal-header-right">
          {/* Account switcher for multi-tenant simulation */}
          {clients.length > 1 && (
            <div className="portal-client-switcher">
              <label>Viewing Account:</label>
              <select
                value={selectedClientId}
                onChange={(e) => handleSwitchClient(e.target.value)}
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Link href="/dashboard" className="portal-exit-btn">
            &larr; Return to Admin Platform
          </Link>
        </div>
      </header>

      {/* Hero Welcome Card */}
      <div className="portal-hero-container">
        <div className="portal-hero-content">
          <span className="portal-eyebrow">Enterprise Client Portal</span>
          <h1>Welcome, {currentClient?.contact_person || currentClient?.company_name}</h1>
          <p>
            Track your delivery milestones, review commercial quotations, access verified tax invoices, and collaborate with your assigned Amiro operations team.
          </p>
        </div>

        <div className="portal-quick-kpis">
          <div className="portal-kpi-chip">
            <span className="chip-label">Active Projects</span>
            <strong>{projects.filter((p) => p.status === "active" || p.status === "planned").length}</strong>
          </div>
          <div className="portal-kpi-chip">
            <span className="chip-label">Outstanding Balance</span>
            <strong className="text-amber">{formatCurrency(portalData?.summary.outstanding || 0)}</strong>
          </div>
          <div className="portal-kpi-chip">
            <span className="chip-label">Open Support Tickets</span>
            <strong>{portalData?.tickets.filter((t: SupportTicket) => t.status === "new" || t.status === "in_progress").length || 0}</strong>
          </div>
        </div>
      </div>

      {ticketMsg && (
        <div className="portal-alert-success" style={{ margin: "16px 28px 0", padding: "12px 18px", borderRadius: 8, background: "#ecfdf5", color: "#065f46", border: "1px solid #a7f3d0" }}>
          {ticketMsg}
        </div>
      )}

      {/* Portal Tabs Bar */}
      <div className="portal-tabs-nav">
        {[
          { key: "overview", label: "Executive Overview", icon: "📊" },
          { key: "projects", label: `Projects (${projects.length})`, icon: "📁" },
          { key: "invoices", label: `Invoices & Billing (${portalData?.invoices.length || 0})`, icon: "🧾" },
          { key: "quotes", label: `Quotations & Proposals (${portalData?.quotations.length || 0})`, icon: "📑" },
          { key: "support", label: `Support Desk (${portalData?.tickets.length || 0})`, icon: "🎫" },
          { key: "profile", label: "Organization Details", icon: "🏢" }
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`portal-tab-btn ${activeTab === tab.key ? "active" : ""}`}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <main className="portal-main-panel">
        {/* TAB 1: OVERVIEW */}
        {activeTab === "overview" && (
          <div className="portal-overview-flow">
            <div className="portal-overview-grid">
              {/* Left Column: Projects & Delivery */}
              <div className="portal-card">
                <div className="card-top-row">
                  <h4>Delivery Progress</h4>
                  <button type="button" className="btn-link" onClick={() => setActiveTab("projects")}>
                    View All Projects &rarr;
                  </button>
                </div>
                {projects.length === 0 ? (
                  <p className="empty-subtext">No delivery projects currently configured.</p>
                ) : (
                  <div className="portal-projects-mini-list">
                    {projects.slice(0, 3).map((prj: Project) => (
                      <div key={prj.id} className="portal-project-mini-item">
                        <div className="mini-item-head">
                          <strong>{prj.project_name}</strong>
                          <span className={`status-pill pill-${prj.status}`}>{prj.status}</span>
                        </div>
                        <div className="mini-item-details">
                          <span>Target: {prj.target_end_date ? formatDate(prj.target_end_date) : "TBD"}</span>
                          <span>Lead: {prj.assigned_manager || "Amiro Operations"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right Column: Invoices & Payment Summary */}
              <div className="portal-card">
                <div className="card-top-row">
                  <h4>Financial Ledger</h4>
                  <button type="button" className="btn-link" onClick={() => setActiveTab("invoices")}>
                    Invoices & Receipts &rarr;
                  </button>
                </div>
                <div className="financial-meters-grid">
                  <div className="ledger-box">
                    <span className="ledger-lbl">Total Billed</span>
                    <strong className="ledger-val">{formatCurrency(portalData?.summary.totalInvoiced || 0)}</strong>
                  </div>
                  <div className="ledger-box">
                    <span className="ledger-lbl">Settled / Paid</span>
                    <strong className="ledger-val text-emerald">{formatCurrency(portalData?.summary.totalCollected || 0)}</strong>
                  </div>
                  <div className="ledger-box highlight">
                    <span className="ledger-lbl">Balance Due</span>
                    <strong className="ledger-val text-amber">{formatCurrency(portalData?.summary.outstanding || 0)}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Support Desk Action Card */}
            <div className="portal-support-action-banner" style={{ marginTop: 20 }}>
              <div className="banner-left">
                <h3>Need Assistance or SLA Support?</h3>
                <p>Submit a request directly to your dedicated Amiro technical support engineers.</p>
              </div>
              <button
                type="button"
                className="portal-raise-ticket-btn"
                onClick={() => setShowNewTicketModal(true)}
              >
                + Raise Support Ticket
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: PROJECTS */}
        {activeTab === "projects" && (
          <div className="portal-tab-content">
            <div className="section-head-row">
              <h3>Client Projects & Delivery Milestones</h3>
              <p>Real-time delivery progress and operational milestone tracking.</p>
            </div>
            {projects.length === 0 ? (
              <div className="portal-card empty-card">
                <p>No projects recorded for this account.</p>
              </div>
            ) : (
              <div className="portal-projects-deck">
                {projects.map((p: Project) => (
                  <div key={p.id} className="portal-project-card">
                    <div className="prj-header">
                      <div>
                        <span className="prj-code">#{p.project_code}</span>
                        <h4>{p.project_name}</h4>
                        <span className="prj-type">{p.project_type || "Technical Implementation"}</span>
                      </div>
                      <span className={`status-pill pill-${p.status}`}>{p.status}</span>
                    </div>

                    <p className="prj-description">{p.description || "Project deliverables under management."}</p>

                    <div className="prj-meta-grid">
                      <div>
                        <small>Delivery Lead</small>
                        <strong>{p.assigned_manager || "Amiro Operations Team"}</strong>
                      </div>
                      <div>
                        <small>Target Delivery</small>
                        <strong>{p.target_end_date ? formatDate(p.target_end_date) : "In Progress"}</strong>
                      </div>
                      <div>
                        <small>Priority Level</small>
                        <strong className="uppercase">{p.priority || "Medium"}</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: INVOICES */}
        {activeTab === "invoices" && (
          <div className="portal-tab-content">
            <div className="section-head-row">
              <h3>Issued Invoices & Billing Statements</h3>
              <p>Tax invoices, payment reconciliation, and downloadable receipts.</p>
            </div>
            {portalData?.invoices.length === 0 ? (
              <div className="portal-card empty-card">
                <p>No invoices currently issued for this account.</p>
              </div>
            ) : (
              <div className="portal-table-wrap">
                <table className="portal-data-table">
                  <thead>
                    <tr>
                      <th>Invoice Number</th>
                      <th>Issue Date</th>
                      <th>Due Date</th>
                      <th>Status</th>
                      <th style={{ textAlign: "right" }}>Total Amount</th>
                      <th style={{ textAlign: "right" }}>Balance Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portalData?.invoices.map((inv: Invoice) => (
                      <tr key={inv.id}>
                        <td>
                          <strong>{inv.invoice_number}</strong>
                        </td>
                        <td>{inv.issue_date ? formatDate(inv.issue_date) : "-"}</td>
                        <td>{inv.due_date ? formatDate(inv.due_date) : "-"}</td>
                        <td>
                          <span className={`status-pill pill-${inv.status}`}>{inv.status}</span>
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 700 }}>
                          {formatCurrency(inv.total_amount)}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 700, color: inv.balance_due > 0 ? "#d97706" : "#059669" }}>
                          {formatCurrency(inv.balance_due)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: QUOTATIONS */}
        {activeTab === "quotes" && (
          <div className="portal-tab-content">
            <div className="section-head-row">
              <h3>Commercial Quotations & Proposals</h3>
              <p>Review active quotes, scope pricing, and approval status.</p>
            </div>
            {portalData?.quotations.length === 0 ? (
              <div className="portal-card empty-card">
                <p>No commercial proposals recorded.</p>
              </div>
            ) : (
              <div className="portal-table-wrap">
                <table className="portal-data-table">
                  <thead>
                    <tr>
                      <th>Quotation #</th>
                      <th>Title / Subject</th>
                      <th>Valid Until</th>
                      <th>Status</th>
                      <th style={{ textAlign: "right" }}>Total Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portalData?.quotations.map((q: Quotation) => (
                      <tr key={q.id}>
                        <td>
                          <strong>{q.quotation_number}</strong>
                        </td>
                        <td>{q.title || "Enterprise Quotation"}</td>
                        <td>{q.valid_until ? formatDate(q.valid_until) : "30 Days"}</td>
                        <td>
                          <span className={`status-pill pill-${q.status}`}>{q.status}</span>
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 700 }}>
                          {formatCurrency(q.total_amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: SUPPORT DESK */}
        {activeTab === "support" && (
          <div className="portal-tab-content">
            <div className="section-head-row-flex" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3>Support & SLA Service Requests</h3>
                <p>Track reported issues, resolution progress, and SLA compliance.</p>
              </div>
              <button
                type="button"
                className="portal-raise-ticket-btn"
                onClick={() => setShowNewTicketModal(true)}
              >
                + New Service Request
              </button>
            </div>

            {portalData?.tickets.length === 0 ? (
              <div className="portal-card empty-card">
                <p>No support tickets logged. Click above to submit a new service request.</p>
              </div>
            ) : (
              <div className="portal-tickets-list" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {portalData?.tickets.map((t: SupportTicket) => (
                  <div key={t.id} className="portal-ticket-card" style={{ padding: 16, border: "1px solid #e2e8f0", borderRadius: 10, background: "#ffffff" }}>
                    <div className="ticket-top" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <span className="ticket-num" style={{ fontSize: "0.74rem", fontWeight: 700, color: "#64748b" }}>#{t.ticket_number}</span>
                        <h4 style={{ margin: "2px 0 0" }}>{t.title}</h4>
                      </div>
                      <div className="ticket-badges" style={{ display: "flex", gap: 8 }}>
                        <span className={`priority-pill priority-${t.priority}`}>{t.priority}</span>
                        <span className={`status-pill pill-${t.status}`}>{t.status}</span>
                      </div>
                    </div>
                    {t.description && <p className="ticket-desc" style={{ margin: "8px 0", fontSize: "0.82rem", color: "#475569" }}>{t.description}</p>}
                    <div className="ticket-foot" style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #f1f5f9", paddingTop: 8, fontSize: "0.72rem", color: "#94a3b8" }}>
                      <span>Logged: {formatDate(t.created_at)}</span>
                      <span>Covered by SLA agreement</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 6: PROFILE */}
        {activeTab === "profile" && (
          <div className="portal-tab-content">
            <div className="section-head-row">
              <h3>Organization Legal Profile</h3>
              <p>Registered business details, tax identification, and billing information.</p>
            </div>

            <div className="portal-card profile-details-card">
              <div className="profile-row">
                <span>Legal Entity Name:</span>
                <strong>{currentClient?.company_name}</strong>
              </div>
              <div className="profile-row">
                <span>Industry Vertical:</span>
                <strong>{currentClient?.industry || "Technology"}</strong>
              </div>
              <div className="profile-row">
                <span>Primary Executive Contact:</span>
                <strong>{currentClient?.contact_person}</strong>
              </div>
              <div className="profile-row">
                <span>Direct Contact Email:</span>
                <strong>{currentClient?.email}</strong>
              </div>
              <div className="profile-row">
                <span>Direct Phone:</span>
                <strong>{currentClient?.phone}</strong>
              </div>
              <div className="profile-row">
                <span>GSTIN Identification:</span>
                <strong>{currentClient?.gst_number || "Not specified"}</strong>
              </div>
              <div className="profile-row">
                <span>CIN / PAN:</span>
                <strong>{currentClient?.pan_number || "Not specified"}</strong>
              </div>
              <div className="profile-row">
                <span>Registered Address:</span>
                <strong>{currentClient?.address ? `${currentClient.address}, ${currentClient.city}, ${currentClient.country}` : "Registered office on file"}</strong>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* New Ticket Modal */}
      {showNewTicketModal && (
        <div className="portal-modal-backdrop" onClick={() => setShowNewTicketModal(false)}>
          <div className="portal-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-top">
              <h3>Submit Support Request</h3>
              <button type="button" className="close-btn" onClick={() => setShowNewTicketModal(false)}>✕</button>
            </div>

            <form onSubmit={handleCreateTicket} className="modal-form">
              <div>
                <label>Subject / Issue Title *</label>
                <input
                  type="text"
                  className="input-base"
                  required
                  placeholder="e.g. Inbound API Webhook latency or Bug in deployment"
                  value={ticketSubject}
                  onChange={(e) => setTicketSubject(e.target.value)}
                />
              </div>

              <div>
                <label>Urgency / SLA Priority</label>
                <select
                  className="input-base"
                  value={ticketPriority}
                  onChange={(e) => setTicketPriority(e.target.value as TicketPriority)}
                >
                  <option value="low">Low - Minor question or general request</option>
                  <option value="medium">Medium - Standard non-blocking inquiry</option>
                  <option value="high">High - Functionality partially degraded</option>
                  <option value="urgent">Urgent - Critical production blocker (1-hr SLA response)</option>
                </select>
              </div>

              <div>
                <label>Detailed Description</label>
                <textarea
                  className="input-base"
                  rows={4}
                  placeholder="Please describe the steps to reproduce or specific error message..."
                  value={ticketDescription}
                  onChange={(e) => setTicketDescription(e.target.value)}
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="wizard-btn-ghost"
                  onClick={() => setShowNewTicketModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="wizard-btn-primary">
                  Submit Service Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
