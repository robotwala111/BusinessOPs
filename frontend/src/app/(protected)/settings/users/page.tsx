"use client";

import { useState } from "react";
import { ModuleScaffold } from "@/components/business/ModuleScaffold";
import { Card } from "@/components/ui/Card";
import { Table } from "@/components/ui/Table";
import { useAuth } from "@/hooks/useAuth";

interface OrgUser {
  id: string;
  name: string;
  email: string;
  role: "super_admin" | "admin" | "manager" | "finance" | "support_engineer" | "viewer";
  status: "active" | "invited" | "suspended";
  lastLogin: string;
}

const initialUsers: OrgUser[] = [
  { id: "u-1", name: "Demo Admin", email: "demo-admin@example.local", role: "super_admin", status: "active", lastLogin: "Just now" },
  { id: "u-2", name: "Operations Lead", email: "ops@amirotech.com", role: "manager", status: "active", lastLogin: "2 hours ago" },
  { id: "u-3", name: "Finance Director", email: "finance@amirotech.com", role: "finance", status: "active", lastLogin: "Yesterday" },
  { id: "u-4", name: "SLA Support Specialist", email: "support@amirotech.com", role: "support_engineer", status: "active", lastLogin: "3 days ago" },
  { id: "u-5", name: "Project Coordinator", email: "delivery@amirotech.com", role: "manager", status: "invited", lastLogin: "Invitation pending" }
];

export default function UserManagementPage() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<OrgUser[]>(initialUsers);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrgUser["role"]>("manager");

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim()) return;

    setUsers((prev) => [
      ...prev,
      {
        id: `u-${Date.now()}`,
        name: inviteName.trim(),
        email: inviteEmail.trim(),
        role: inviteRole,
        status: "invited",
        lastLogin: "Invitation pending"
      }
    ]);
    setShowInviteModal(false);
    setInviteName("");
    setInviteEmail("");
  }

  return (
    <ModuleScaffold
      title="User Management & Organization Team"
      eyebrow="Administration & Access"
      description="Manage enterprise staff accounts, assign functional roles, and enforce security policies."
      isLoading={false}
      isEmpty={false}
    >
      <div className="wizard-hero-banner" style={{ marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0 }}>Team Members & Access Control</h3>
          <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "0.85rem" }}>
            Amiro Tech Solutions staff authorized to access commercial CRM, operations, finance, and support desks.
          </p>
        </div>
        <button
          type="button"
          className="wizard-btn-primary"
          onClick={() => setShowInviteModal(true)}
        >
          + Invite Team Member
        </button>
      </div>

      <Card>
        <Table>
          <thead>
            <tr>
              <th>Member Name</th>
              <th>Email Address</th>
              <th>Assigned Role</th>
              <th>Status</th>
              <th>Activity</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  <strong>{u.name}</strong>
                </td>
                <td>{u.email}</td>
                <td>
                  <span className="mode-pill uppercase">{u.role.replace(/_/g, " ")}</span>
                </td>
                <td>
                  <span className={`status-pill ${u.status === "active" ? "pill-active" : "pill-muted"}`}>
                    {u.status}
                  </span>
                </td>
                <td>
                  <span style={{ fontSize: "0.8rem", color: "#64748b" }}>{u.lastLogin}</span>
                </td>
                <td>
                  <button
                    type="button"
                    className="btn-link"
                    onClick={() => {
                      if (u.id === "u-1") return alert("Primary admin cannot be deleted.");
                      if (confirm(`Remove access for ${u.name}?`)) {
                        setUsers(users.filter((item) => item.id !== u.id));
                      }
                    }}
                  >
                    Manage
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="portal-modal-backdrop" onClick={() => setShowInviteModal(false)}>
          <div className="portal-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-top">
              <h3>Invite Team Member</h3>
              <button type="button" className="close-btn" onClick={() => setShowInviteModal(false)}>✕</button>
            </div>

            <form onSubmit={handleInvite} className="modal-form">
              <div>
                <label>Full Name *</label>
                <input
                  type="text"
                  className="input-base"
                  required
                  placeholder="e.g. Priya Sharma"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                />
              </div>

              <div>
                <label>Work Email Address *</label>
                <input
                  type="email"
                  className="input-base"
                  required
                  placeholder="priya@amirotech.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>

              <div>
                <label>System Role & Permissions</label>
                <select
                  className="input-base"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as OrgUser["role"])}
                >
                  <option value="admin">Administrator (Full CRM & Operations)</option>
                  <option value="manager">Operations Manager (Projects & Delivery)</option>
                  <option value="finance">Finance Officer (Invoices, Expenses & Payments)</option>
                  <option value="support_engineer">Support Specialist (SLA & Tickets)</option>
                  <option value="viewer">Read-Only Viewer</option>
                </select>
              </div>

              <div className="modal-actions">
                <button type="button" className="wizard-btn-ghost" onClick={() => setShowInviteModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="wizard-btn-primary">
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ModuleScaffold>
  );
}
