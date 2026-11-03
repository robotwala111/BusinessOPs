"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ClientStatusBadge } from "@/components/clients/ClientStatusBadge";
import { BackButton } from "@/components/ui/BackButton";
import { Card } from "@/components/ui/Card";
import { Table } from "@/components/ui/Table";
import { activityService } from "@/services/activityService";
import { clientService } from "@/services/clientService";
import { contactService } from "@/services/contactService";
import { projectService } from "@/services/projectService";
import { client360Service } from "@/services/client360Service";
import { useAuth } from "@/hooks/useAuth";
import type { Activity } from "@/types/activity";
import type { Client } from "@/types/client";
import type { Contact } from "@/types/contact";
import type { Project } from "@/types/project";
import type { Invoice } from "@/types/invoice";
import type { Quotation } from "@/types/quotation";
import type { Contract } from "@/types/contract";
import type { SupportTicket } from "@/types/maintenance";
import type { Client360Data } from "@/services/client360Service";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatDate } from "@/utils/formatDate";

type ClientDetailPageProps = {
  clientId: string;
};

export function ClientDetailPage({ clientId }: ClientDetailPageProps) {
  const { user } = useAuth();
  const [client, setClient] = useState<Client | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [commercialData, setCommercialData] = useState<Client360Data | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "contacts" | "projects" | "quotations" | "invoices" | "contracts" | "support" | "activities" | "legal">("overview");

  useEffect(() => {
    async function loadClient() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const [c, nextProjects, nextContacts, nextActivities, commercial] = await Promise.all([
          clientService.getClientById(clientId),
          projectService.getProjectsByClient(clientId),
          contactService.getContactsByClient(clientId),
          activityService.getActivitiesByClient(clientId, 20),
          client360Service.load(clientId)
        ]);
        setClient(c);
        setProjects(nextProjects);
        setContacts(nextContacts);
        setActivities(nextActivities);
        setCommercialData(commercial);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Unable to load client 360 profile."
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadClient();
  }, [clientId]);

  if (isLoading) {
    return <div className="route-placeholder">Loading Client 360° Profile...</div>;
  }

  if (errorMessage) {
    return <div className="form-error">{errorMessage}</div>;
  }

  if (!client) {
    return <div className="route-placeholder">Client record not found.</div>;
  }

  async function archiveClient() {
    if (!client) return;
    if (!window.confirm("Archive this client? Related commercial records will remain available.")) return;
    try {
      await clientService.archiveClient(client.id, user?.id ?? null);
      setClient({ ...client, status: "archived", archived_at: new Date().toISOString() });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to archive client.");
    }
  }

  const summary = commercialData?.summary ?? {
    totalQuoted: 0,
    acceptedQuoted: 0,
    contractValue: 0,
    totalInvoiced: 0,
    totalCollected: 0,
    outstanding: 0,
    approvedExpenses: 0,
    grossMargin: 0,
    grossMarginPercentage: 0
  };

  const initials = client.company_name
    ? client.company_name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("")
    : "CL";

  return (
    <section className="module-page">
      <BackButton fallbackHref="/clients" label="Clients Directory" />

      {/* 360 Client Header Banner */}
      <div className="client-360-hero-card">
        <div className="hero-left">
          <div className="client-avatar-pill" style={{ width: 52, height: 52, fontSize: "1.1rem" }}>
            <span>{initials}</span>
          </div>
          <div className="hero-meta">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h1 style={{ margin: 0, fontSize: "1.6rem" }}>{client.company_name}</h1>
              {client.client_short_name && (
                <span className="code-tag">{client.client_short_name}</span>
              )}
              <ClientStatusBadge status={client.status} />
            </div>
            <p className="hero-subtext">
              {client.industry || "Enterprise"} • Primary Contact: <strong>{client.contact_person || "Not assigned"}</strong> • {client.city || client.country || "India"}
            </p>
          </div>
        </div>

        <div className="hero-actions">
          <Link href={`/contacts?client_id=${client.id}`}>
            <button type="button" className="wizard-btn-ghost">+ Contact</button>
          </Link>
          <Link href={`/quotations/new?client_id=${client.id}`}>
            <button type="button" className="wizard-btn-ghost">+ Quote</button>
          </Link>
          <Link href={`/invoices?client_id=${client.id}`}>
            <button type="button" className="wizard-btn-ghost">+ Invoice</button>
          </Link>
          <Link href={`/clients/${client.id}/edit`}>
            <button type="button" className="wizard-btn-primary">Edit Profile</button>
          </Link>
          {client.status !== "archived" && (
            <button type="button" className="wizard-btn-secondary" onClick={archiveClient}>
              Archive
            </button>
          )}
        </div>
      </div>

      {/* Financial Pulse Ribbon */}
      <div className="payments-kpi-deck" style={{ margin: "16px 0" }}>
        <div className="payment-stat-card">
          <span className="stat-label">Total Contract Value</span>
          <strong className="stat-value">{formatCurrency(summary.contractValue)}</strong>
          <small className="stat-sub">{commercialData?.contracts.length || 0} SOWs & Contracts</small>
        </div>
        <div className="payment-stat-card">
          <span className="stat-label">Invoiced Billing</span>
          <strong className="stat-value">{formatCurrency(summary.totalInvoiced)}</strong>
          <small className="stat-sub">{commercialData?.invoices.length || 0} Invoices Issued</small>
        </div>
        <div className="payment-stat-card">
          <span className="stat-label">Realized Cash (Paid)</span>
          <strong className="stat-value text-emerald">{formatCurrency(summary.totalCollected)}</strong>
          <small className="stat-sub">Cleared settlements</small>
        </div>
        <div className="payment-stat-card">
          <span className="stat-label">Outstanding Balance</span>
          <strong className={`stat-value ${summary.outstanding > 0 ? "text-amber" : "text-emerald"}`}>
            {formatCurrency(summary.outstanding)}
          </strong>
          <small className="stat-sub">Gross Margin: {summary.grossMarginPercentage}%</small>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="portal-tabs-nav" style={{ marginBottom: 16 }}>
        {[
          { key: "overview", label: "Overview & Pulse", icon: "📊" },
          { key: "contacts", label: `Stakeholders (${contacts.length})`, icon: "👥" },
          { key: "projects", label: `Projects (${projects.length})`, icon: "📁" },
          { key: "quotations", label: `Quotations (${commercialData?.quotations.length || 0})`, icon: "📑" },
          { key: "invoices", label: `Invoices (${commercialData?.invoices.length || 0})`, icon: "🧾" },
          { key: "contracts", label: `Contracts (${commercialData?.contracts.length || 0})`, icon: "⚖️" },
          { key: "support", label: `Support & SLA (${commercialData?.tickets.length || 0})`, icon: "🎫" },
          { key: "activities", label: `Activity Trail (${activities.length})`, icon: "⏱" },
          { key: "legal", label: "Legal & Entity Details", icon: "🏢" }
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

      {/* TAB PANELS */}

      {/* 1. OVERVIEW */}
      {activeTab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="portal-overview-grid">
            {/* Active Projects Box */}
            <Card>
              <div className="card-top-row" style={{ padding: "16px 20px" }}>
                <h4>Active Projects ({projects.length})</h4>
                <Link href="/projects" className="btn-link">All Projects &rarr;</Link>
              </div>
              {projects.length === 0 ? (
                <p style={{ padding: "0 20px 20px", color: "#64748b", margin: 0 }}>No active projects recorded.</p>
              ) : (
                <div style={{ padding: "0 20px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                  {projects.slice(0, 3).map((p) => (
                    <div key={p.id} className="portal-project-mini-item">
                      <div className="mini-item-head">
                        <Link href={`/projects/${p.id}`}><strong>{p.project_name}</strong></Link>
                        <span className={`status-pill pill-${p.status}`}>{p.status}</span>
                      </div>
                      <small style={{ color: "#64748b" }}>
                        Lead: {p.assigned_manager || "Amiro Ops"} • Target: {p.target_end_date ? formatDate(p.target_end_date) : "TBD"}
                      </small>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Primary Contacts Box */}
            <Card>
              <div className="card-top-row" style={{ padding: "16px 20px" }}>
                <h4>Key Stakeholders ({contacts.length})</h4>
                <button type="button" className="btn-link" onClick={() => setActiveTab("contacts")}>
                  Manage All &rarr;
                </button>
              </div>
              {contacts.length === 0 ? (
                <p style={{ padding: "0 20px 20px", color: "#64748b", margin: 0 }}>No contacts added yet.</p>
              ) : (
                <div style={{ padding: "0 20px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                  {contacts.slice(0, 3).map((c) => (
                    <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <strong>{c.full_name}</strong>
                        {c.is_primary && <span style={{ color: "#f59e0b", marginLeft: 6 }}>★ Primary</span>}
                        <br />
                        <small style={{ color: "#64748b" }}>{c.designation || "Stakeholder"} • {c.email || c.phone}</small>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {c.email && <a href={`mailto:${c.email}`} className="contact-pill-btn">Email</a>}
                        {c.phone && <a href={`tel:${c.phone}`} className="contact-pill-btn">Call</a>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Recent Invoices Card */}
          <Card>
            <div className="card-top-row" style={{ padding: "16px 20px" }}>
              <h4>Recent Invoices & Receivables</h4>
              <button type="button" className="btn-link" onClick={() => setActiveTab("invoices")}>
                View All Invoices &rarr;
              </button>
            </div>
            <Table>
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Issue Date</th>
                  <th>Due Date</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Total</th>
                  <th style={{ textAlign: "right" }}>Balance Due</th>
                </tr>
              </thead>
              <tbody>
                {(commercialData?.invoices || []).slice(0, 5).map((inv: Invoice) => (
                  <tr key={inv.id}>
                    <td>
                      <Link href={`/invoices/${inv.id}`} className="table-code-link">
                        <strong>{inv.invoice_number}</strong>
                      </Link>
                    </td>
                    <td>{inv.issue_date ? formatDate(inv.issue_date) : "-"}</td>
                    <td>{inv.due_date ? formatDate(inv.due_date) : "-"}</td>
                    <td><span className={`status-pill pill-${inv.status}`}>{inv.status}</span></td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>{formatCurrency(inv.total_amount)}</td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: inv.balance_due > 0 ? "#d97706" : "#059669" }}>
                      {formatCurrency(inv.balance_due)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </div>
      )}

      {/* 2. CONTACTS */}
      {activeTab === "contacts" && (
        <Card>
          <div className="card-top-row" style={{ padding: "16px 20px" }}>
            <h4>Stakeholders & Contact Persons</h4>
            <Link href={`/contacts?client_id=${client.id}`}>
              <button type="button" className="wizard-btn-primary">+ Add New Contact</button>
            </Link>
          </div>
          <Table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Role / Designation</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Department</th>
                <th>Flags</th>
              </tr>
            </thead>
            <tbody>
              {contacts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="table-empty-cell">No contacts recorded. Add the primary decision-maker.</td>
                </tr>
              ) : (
                contacts.map((c) => (
                  <tr key={c.id}>
                    <td><strong>{c.full_name}</strong></td>
                    <td>{c.designation || "-"}</td>
                    <td>{c.email ? <a href={`mailto:${c.email}`} className="btn-link">{c.email}</a> : "-"}</td>
                    <td>{c.phone || "-"}</td>
                    <td>{c.department || "-"}</td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        {c.is_primary && <span className="count-pill">Primary</span>}
                        {c.is_billing_contact && <span className="count-pill">Billing</span>}
                        {c.is_project_contact && <span className="count-pill">Project</span>}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </Card>
      )}

      {/* 3. PROJECTS */}
      {activeTab === "projects" && (
        <div className="portal-projects-deck">
          {projects.length === 0 ? (
            <Card><p style={{ padding: 20 }}>No projects found for this client.</p></Card>
          ) : (
            projects.map((p) => (
              <div key={p.id} className="portal-project-card">
                <div className="prj-header">
                  <div>
                    <span className="prj-code">#{p.project_code}</span>
                    <Link href={`/projects/${p.id}`}><h4>{p.project_name}</h4></Link>
                    <span className="prj-type">{p.project_type || "Technical Implementation"}</span>
                  </div>
                  <span className={`status-pill pill-${p.status}`}>{p.status}</span>
                </div>
                <p className="prj-description">{p.description || "Project under delivery."}</p>
                <div className="prj-meta-grid">
                  <div>
                    <small>Manager</small>
                    <strong>{p.assigned_manager || "Amiro Ops Lead"}</strong>
                  </div>
                  <div>
                    <small>Target End Date</small>
                    <strong>{p.target_end_date ? formatDate(p.target_end_date) : "TBD"}</strong>
                  </div>
                  <div>
                    <small>Project Value</small>
                    <strong>{formatCurrency(p.project_value)}</strong>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 4. QUOTATIONS */}
      {activeTab === "quotations" && (
        <Card>
          <div className="card-top-row" style={{ padding: "16px 20px" }}>
            <h4>Commercial Proposals & Quotations</h4>
            <Link href={`/quotations/new?client_id=${client.id}`}>
              <button type="button" className="wizard-btn-primary">+ Create Quotation</button>
            </Link>
          </div>
          <Table>
            <thead>
              <tr>
                <th>Quote #</th>
                <th>Subject</th>
                <th>Validity</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Total Amount</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {(commercialData?.quotations || []).map((q: Quotation) => (
                <tr key={q.id}>
                  <td><Link href={`/quotations/${q.id}`} className="table-code-link"><strong>{q.quotation_number}</strong></Link></td>
                  <td>{q.title || "Enterprise Proposal"}</td>
                  <td>{q.valid_until ? formatDate(q.valid_until) : "-"}</td>
                  <td><span className={`status-pill pill-${q.status}`}>{q.status}</span></td>
                  <td style={{ textAlign: "right", fontWeight: 700 }}>{formatCurrency(q.total_amount)}</td>
                  <td><Link href={`/quotations/${q.id}`} className="btn-link">View Details &rarr;</Link></td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {/* 5. INVOICES */}
      {activeTab === "invoices" && (
        <Card>
          <div className="card-top-row" style={{ padding: "16px 20px" }}>
            <h4>Issued Invoices & Ledger</h4>
            <Link href={`/invoices?client_id=${client.id}`}>
              <button type="button" className="wizard-btn-primary">+ Draft Invoice</button>
            </Link>
          </div>
          <Table>
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Issue Date</th>
                <th>Due Date</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Total</th>
                <th style={{ textAlign: "right" }}>Balance Due</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {(commercialData?.invoices || []).map((inv: Invoice) => (
                <tr key={inv.id}>
                  <td><Link href={`/invoices/${inv.id}`} className="table-code-link"><strong>{inv.invoice_number}</strong></Link></td>
                  <td>{inv.issue_date ? formatDate(inv.issue_date) : "-"}</td>
                  <td>{inv.due_date ? formatDate(inv.due_date) : "-"}</td>
                  <td><span className={`status-pill pill-${inv.status}`}>{inv.status}</span></td>
                  <td style={{ textAlign: "right", fontWeight: 700 }}>{formatCurrency(inv.total_amount)}</td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: inv.balance_due > 0 ? "#d97706" : "#059669" }}>
                    {formatCurrency(inv.balance_due)}
                  </td>
                  <td><Link href={`/invoices/${inv.id}`} className="btn-link">Manage &rarr;</Link></td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {/* 6. CONTRACTS */}
      {activeTab === "contracts" && (
        <Card>
          <div className="card-top-row" style={{ padding: "16px 20px" }}>
            <h4>Contracts & Master Service Agreements</h4>
            <Link href="/contracts">
              <button type="button" className="wizard-btn-primary">+ New Contract</button>
            </Link>
          </div>
          <Table>
            <thead>
              <tr>
                <th>Contract #</th>
                <th>Title</th>
                <th>Status</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th style={{ textAlign: "right" }}>Contract Value</th>
              </tr>
            </thead>
            <tbody>
              {(commercialData?.contracts || []).map((con: Contract) => (
                <tr key={con.id}>
                  <td><Link href={`/contracts/${con.id}`} className="table-code-link"><strong>{con.contract_number}</strong></Link></td>
                  <td>{con.title}</td>
                  <td><span className={`status-pill pill-${con.status}`}>{con.status}</span></td>
                  <td>{con.start_date ? formatDate(con.start_date) : "-"}</td>
                  <td>{con.end_date ? formatDate(con.end_date) : "-"}</td>
                  <td style={{ textAlign: "right", fontWeight: 700 }}>{formatCurrency(con.contract_value)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {/* 7. SUPPORT & SLA */}
      {activeTab === "support" && (
        <Card>
          <div className="card-top-row" style={{ padding: "16px 20px" }}>
            <h4>Support Tickets & Maintenance SLA</h4>
            <Link href="/support">
              <button type="button" className="wizard-btn-primary">+ Log Ticket</button>
            </Link>
          </div>
          <Table>
            <thead>
              <tr>
                <th>Ticket #</th>
                <th>Title</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Logged At</th>
              </tr>
            </thead>
            <tbody>
              {(commercialData?.tickets || []).map((t: SupportTicket) => (
                <tr key={t.id}>
                  <td><Link href={`/support/${t.id}`} className="table-code-link"><strong>#{t.ticket_number}</strong></Link></td>
                  <td>{t.title}</td>
                  <td><span className={`priority-pill priority-${t.priority}`}>{t.priority}</span></td>
                  <td><span className={`status-pill pill-${t.status}`}>{t.status}</span></td>
                  <td>{formatDate(t.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {/* 8. ACTIVITIES */}
      {activeTab === "activities" && (
        <Card>
          <div className="card-top-row" style={{ padding: "16px 20px" }}>
            <h4>Communication & Activity Timeline</h4>
            <Link href={`/activities?client_id=${client.id}`}>
              <button type="button" className="wizard-btn-primary">+ Log Activity</button>
            </Link>
          </div>
          <div style={{ padding: "0 20px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
            {activities.length === 0 ? (
              <p style={{ color: "#64748b" }}>No activities recorded yet.</p>
            ) : (
              activities.map((a) => (
                <div key={a.id} className="portal-ticket-card" style={{ padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <strong>{a.subject}</strong>
                    <span className="count-pill uppercase">{a.activity_type}</span>
                  </div>
                  {a.description && <p style={{ margin: "6px 0 0", fontSize: "0.82rem", color: "#475569" }}>{a.description}</p>}
                  <small style={{ color: "#94a3b8", marginTop: 4 }}>Date: {formatDate(a.activity_date)}</small>
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      {/* 9. LEGAL & ENTITY DETAILS */}
      {activeTab === "legal" && (
        <Card>
          <div className="card-top-row" style={{ padding: "16px 20px" }}>
            <h4>Organization Legal Information</h4>
            <Link href={`/clients/${client.id}/edit`}>
              <button type="button" className="wizard-btn-primary">Edit Information</button>
            </Link>
          </div>
          <div className="profile-details-card" style={{ padding: "0 20px 20px" }}>
            <div className="profile-row">
              <span>Legal Entity Name:</span>
              <strong>{client.company_name}</strong>
            </div>
            <div className="profile-row">
              <span>Short Code:</span>
              <strong>{client.client_short_name || "-"}</strong>
            </div>
            <div className="profile-row">
              <span>GSTIN Tax Identifier:</span>
              <strong>{client.gst_number || "Not specified"}</strong>
            </div>
            <div className="profile-row">
              <span>PAN / Registration Number:</span>
              <strong>{client.pan_number || "Not specified"}</strong>
            </div>
            <div className="profile-row">
              <span>Industry Vertical:</span>
              <strong>{client.industry || "Enterprise"}</strong>
            </div>
            <div className="profile-row">
              <span>Payment Terms:</span>
              <strong>{client.payment_terms || "Net 30 Days"}</strong>
            </div>
            <div className="profile-row">
              <span>Registered Address:</span>
              <strong>{client.address ? `${client.address}, ${client.city || ""}, ${client.state || ""}, ${client.country}` : "On file"}</strong>
            </div>
            {client.notes && (
              <div className="profile-row">
                <span>Account Onboarding Notes:</span>
                <p style={{ margin: 0, fontSize: "0.82rem" }}>{client.notes}</p>
              </div>
            )}
          </div>
        </Card>
      )}
    </section>
  );
}
