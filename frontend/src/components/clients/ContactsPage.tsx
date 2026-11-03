"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ModuleScaffold } from "@/components/business/ModuleScaffold";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Table } from "@/components/ui/Table";
import { useClients } from "@/hooks/useClients";
import { useContacts } from "@/hooks/useContacts";
import type { Contact, ContactFormData } from "@/types/contact";

const defaultForm: ContactFormData = {
  client_id: "",
  full_name: "",
  designation: "",
  email: "",
  phone: "",
  whatsapp: "",
  department: "",
  is_primary: false,
  is_billing_contact: false,
  is_project_contact: false,
  notes: ""
};

export function ContactsPage() {
  const searchParams = useSearchParams();
  const urlClientId = searchParams?.get("client_id") || "";

  const { filteredContacts, isLoading, errorMessage, searchTerm, setSearchTerm, saveContact, deleteContact } = useContacts();
  const { clients } = useClients();
  const [form, setForm] = useState<ContactFormData>(() => ({
    ...defaultForm,
    client_id: urlClientId
  }));
  const [editing, setEditing] = useState<Contact | null>(null);
  const [clientFilter, setClientFilter] = useState<string>(urlClientId || "all");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (urlClientId) {
      setForm((prev) => ({ ...prev, client_id: urlClientId }));
      setClientFilter(urlClientId);
    }
  }, [urlClientId]);

  function edit(contact: Contact) {
    setEditing(contact);
    setForm({
      client_id: contact.client_id,
      full_name: contact.full_name,
      designation: contact.designation ?? "",
      email: contact.email ?? "",
      phone: contact.phone ?? "",
      whatsapp: contact.whatsapp ?? "",
      department: contact.department ?? "",
      is_primary: contact.is_primary,
      is_billing_contact: contact.is_billing_contact ?? false,
      is_project_contact: contact.is_project_contact ?? false,
      notes: contact.notes ?? ""
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError("");

    if (!form.client_id || !form.full_name.trim()) {
      setFormError("Client and full name are required.");
      return;
    }

    await saveContact(form, editing?.id);
    setEditing(null);
    setForm({ ...defaultForm, client_id: clientFilter !== "all" ? clientFilter : "" });
  }

  function cancelEdit() {
    setEditing(null);
    setForm({ ...defaultForm, client_id: clientFilter !== "all" ? clientFilter : "" });
    setFormError("");
  }

  const displayedContacts = useMemo(() => {
    if (clientFilter === "all") return filteredContacts;
    return filteredContacts.filter((c) => c.client_id === clientFilter);
  }, [filteredContacts, clientFilter]);

  return (
    <ModuleScaffold
      title="Contacts"
      eyebrow="CRM & Stakeholders"
      description="Manage client stakeholders, billing contacts, project coordinators, and communication channels."
      errorMessage={errorMessage || formError}
      isLoading={isLoading}
      isEmpty={false}
    >
      <Card>
        <form className="client-form" onSubmit={submit}>
          <h2 style={{ margin: "0 0 12px 0", fontSize: "1.1rem" }}>
            {editing ? `Edit Contact: ${editing.full_name}` : "Add New Contact"}
          </h2>
          <div className="form-grid two-columns">
            <label>
              Client
              <select
                value={form.client_id}
                onChange={(event) => setForm({ ...form, client_id: event.target.value })}
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
              Full Name
              <Input
                value={form.full_name}
                onChange={(event) => setForm({ ...form, full_name: event.target.value })}
                placeholder="e.g. John Doe"
                required
              />
            </label>
            <label>
              Designation / Role
              <Input
                value={form.designation}
                onChange={(event) => setForm({ ...form, designation: event.target.value })}
                placeholder="e.g. Head of Procurement"
              />
            </label>
            <label>
              Department
              <Input
                value={form.department}
                onChange={(event) => setForm({ ...form, department: event.target.value })}
                placeholder="e.g. Finance, Engineering"
              />
            </label>
            <label>
              Email Address
              <Input
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                placeholder="john@company.com"
              />
            </label>
            <label>
              Phone Number
              <Input
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
                placeholder="+91 98765 43210"
              />
            </label>
            <label>
              WhatsApp Number
              <Input
                value={form.whatsapp}
                onChange={(event) => setForm({ ...form, whatsapp: event.target.value })}
                placeholder="+91 98765 43210"
              />
            </label>
          </div>

          <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", margin: "14px 0" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={form.is_primary}
                onChange={(event) => setForm({ ...form, is_primary: event.target.checked })}
              />
              Primary Contact
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={form.is_billing_contact}
                onChange={(event) => setForm({ ...form, is_billing_contact: event.target.checked })}
              />
              Billing Contact
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={form.is_project_contact}
                onChange={(event) => setForm({ ...form, is_project_contact: event.target.checked })}
              />
              Project Contact
            </label>
          </div>

          <label>
            Notes & Comments
            <textarea
              rows={2}
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              placeholder="Internal communication preferences or remarks..."
            />
          </label>
          <div className="form-actions" style={{ marginTop: "12px" }}>
            {editing ? (
              <Button type="button" variant="secondary" onClick={cancelEdit}>
                Cancel
              </Button>
            ) : null}
            <Button type="submit">{editing ? "Save Contact" : "Add Contact"}</Button>
          </div>
        </form>
      </Card>

      <Card className="toolbar-card">
        <div className="clients-toolbar" style={{ gridTemplateColumns: "minmax(220px, 1fr) 240px" }}>
          <Input
            placeholder="Search contacts by name, email, department, or phone..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
          <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}>
            <option value="all">All Clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.company_name}
              </option>
            ))}
          </select>
        </div>
      </Card>

      <Card>
        <Table>
          <thead>
            <tr>
              <th>Contact Name</th>
              <th>Client</th>
              <th>Department</th>
              <th>Email</th>
              <th>Phone / WhatsApp</th>
              <th>Roles</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayedContacts.length > 0 ? (
              displayedContacts.map((contact) => (
                <tr key={contact.id}>
                  <td>
                    <strong>{contact.full_name}</strong>
                    <small style={{ display: "block", color: "#64748b" }}>{contact.designation || "-"}</small>
                  </td>
                  <td>{contact.client?.company_name || "-"}</td>
                  <td>{contact.department || "-"}</td>
                  <td>
                    {contact.email ? (
                      <a href={`mailto:${contact.email}`} style={{ color: "#2563eb", textDecoration: "none" }}>
                        {contact.email}
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>
                    <div>{contact.phone || "-"}</div>
                    {contact.whatsapp && contact.whatsapp !== contact.phone && (
                      <small style={{ color: "#059669" }}>WA: {contact.whatsapp}</small>
                    )}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                      {contact.is_primary && (
                        <span style={{ fontSize: "0.68rem", fontWeight: 700, background: "#ecfdf5", color: "#059669", padding: "2px 6px", borderRadius: "4px" }}>
                          PRIMARY
                        </span>
                      )}
                      {contact.is_billing_contact && (
                        <span style={{ fontSize: "0.68rem", fontWeight: 700, background: "#eff6ff", color: "#2563eb", padding: "2px 6px", borderRadius: "4px" }}>
                          BILLING
                        </span>
                      )}
                      {contact.is_project_contact && (
                        <span style={{ fontSize: "0.68rem", fontWeight: 700, background: "#fef3c7", color: "#d97706", padding: "2px 6px", borderRadius: "4px" }}>
                          PROJECT
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button className="link-button" type="button" onClick={() => edit(contact)}>
                        Edit
                      </button>
                      <button className="link-button danger-link" type="button" onClick={() => void deleteContact(contact.id)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="table-empty-cell">
                  No contacts found matching the filters.
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>
    </ModuleScaffold>
  );
}
