"use client";

import { ModuleScaffold } from "@/components/business/ModuleScaffold";
import { Card } from "@/components/ui/Card";
import { Table } from "@/components/ui/Table";

const roleDefinitions = [
  {
    role: "Super Administrator",
    badge: "Full Governance",
    desc: "Complete system ownership: security policies, company settings, user provisioning, database backups, and payment reversal authorization.",
    crm: "Full (Create, Read, Update, Delete, Archive)",
    operations: "Full (Milestones, SOW, Contract signing, Ticket escalation)",
    finance: "Full (Issue Invoices, Settle Payments, Authorize Write-offs)",
    admin: "Full (Tenant branding, API keys, User roles)"
  },
  {
    role: "Operations Manager",
    badge: "Delivery & Projects",
    desc: "Oversees client deliverables, resource allocation, project deadlines, SOW scope, and SLA maintenance tracking.",
    crm: "Read, Update, Log Activities",
    operations: "Full (Projects, Milestones, Contracts, Maintenance)",
    finance: "Read Quotes, View Billing Status",
    admin: "None"
  },
  {
    role: "Commercial / Sales Lead",
    badge: "Pipeline & Quotations",
    desc: "Manages prospective accounts, qualifies leads, issues commercial quotations, and negotiates contract terms.",
    crm: "Full (Leads, Contacts, Clients, Follow-ups)",
    operations: "View Projects, Create Quotations",
    finance: "Create Quotes, View Invoices",
    admin: "None"
  },
  {
    role: "Finance Officer",
    badge: "Billing & Collections",
    desc: "Responsible for issuing GST invoices, recording inward payments, reconciling bank statements, and reporting P&L statements.",
    crm: "View Accounts, Manage Billing Contacts",
    operations: "View Projects & Milestones",
    finance: "Full (Invoices, Expenses, Payments, Credit Notes, Reports)",
    admin: "Audit Logs (Read-only)"
  },
  {
    role: "Client Stakeholder (Portal)",
    badge: "External Portal",
    desc: "Restricted client-facing access limited strictly to their own organization's projects, quotations, invoices, and support desk.",
    crm: "Own Profile Only",
    operations: "View Assigned Projects & Milestones",
    finance: "View & Download Own Invoices & Quotes",
    admin: "None"
  }
];

export default function RolesPermissionsPage() {
  return (
    <ModuleScaffold
      title="Roles & Security Permissions Matrix"
      eyebrow="Security & Governance"
      description="Role-based access control (RBAC) governing data access, commercial approvals, and functional boundaries."
      isLoading={false}
      isEmpty={false}
    >
      <div className="wizard-hero-banner" style={{ marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0 }}>RBAC Authorization Policy</h3>
          <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "0.85rem" }}>
            Enforces strict principle-of-least-privilege across CRM, Operations, Financial Ledgers, and Client Portals.
          </p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {roleDefinitions.map((def) => (
          <Card key={def.role}>
            <div style={{ padding: "16px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: "1rem", color: "#0f172a" }}>{def.role}</h4>
                  <p style={{ margin: "4px 0 0", fontSize: "0.82rem", color: "#64748b" }}>{def.desc}</p>
                </div>
                <span className="count-pill">{def.badge}</span>
              </div>

              <div className="client-metrics-trio" style={{ marginTop: 12 }}>
                <div className="metric-chip">
                  <span className="chip-label">CRM & Pipeline</span>
                  <strong className="chip-value" style={{ fontSize: "0.8rem" }}>{def.crm}</strong>
                </div>
                <div className="metric-chip">
                  <span className="chip-label">Business Operations</span>
                  <strong className="chip-value" style={{ fontSize: "0.8rem" }}>{def.operations}</strong>
                </div>
                <div className="metric-chip">
                  <span className="chip-label">Finance & Ledgers</span>
                  <strong className="chip-value" style={{ fontSize: "0.8rem" }}>{def.finance}</strong>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </ModuleScaffold>
  );
}
