"use client";

import { FormEvent, useState } from "react";
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
  notes: ""
};

export function ContactsPage() {
  const { filteredContacts, isLoading, errorMessage, searchTerm, setSearchTerm, saveContact, deleteContact } = useContacts();
  const { clients } = useClients();
  const [form, setForm] = useState<ContactFormData>(defaultForm);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [formError, setFormError] = useState("");

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
    setForm(defaultForm);
  }

  function cancelEdit() {
    setEditing(null);
    setForm(defaultForm);
    setFormError("");
  }

  return (
    <ModuleScaffold title="Contacts" eyebrow="CRM" description="Manage client stakeholders, departments, and primary contact ownership." errorMessage={errorMessage || formError} isLoading={isLoading} isEmpty={false}>
      <Card>
        <form className="client-form" onSubmit={submit}>
          <div className="form-grid two-columns">
            <label>Client<select value={form.client_id} onChange={(event) => setForm({ ...form, client_id: event.target.value })}><option value="">Select client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.company_name}</option>)}</select></label>
            <label>Full name<Input value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} /></label>
            <label>Designation<Input value={form.designation} onChange={(event) => setForm({ ...form, designation: event.target.value })} /></label>
            <label>Department<Input value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} /></label>
            <label>Email<Input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
            <label>Phone<Input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
            <label>WhatsApp<Input value={form.whatsapp} onChange={(event) => setForm({ ...form, whatsapp: event.target.value })} /></label>
          </div>
          <label><input type="checkbox" checked={form.is_primary} onChange={(event) => setForm({ ...form, is_primary: event.target.checked })} /> Primary contact</label>
          <label>Notes<textarea rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
          <div className="form-actions">{editing ? <Button type="button" variant="secondary" onClick={cancelEdit}>Cancel</Button> : null}<Button type="submit">{editing ? "Save Contact" : "Add Contact"}</Button></div>
        </form>
      </Card>

      <Card className="toolbar-card"><div className="clients-toolbar"><Input placeholder="Search contacts, clients, departments, email, or phone" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} /></div></Card>

      <Table>
        <thead><tr><th>Contact</th><th>Client</th><th>Department</th><th>Email</th><th>Phone</th><th>Primary</th><th>Actions</th></tr></thead>
        <tbody>{filteredContacts.map((contact) => <tr key={contact.id}><td>{contact.full_name}<small>{contact.designation || "-"}</small></td><td>{contact.client?.company_name || "-"}</td><td>{contact.department || "-"}</td><td>{contact.email || "-"}</td><td>{contact.phone || contact.whatsapp || "-"}</td><td>{contact.is_primary ? "Yes" : "No"}</td><td><div className="table-actions"><button className="link-button" type="button" onClick={() => edit(contact)}>Edit</button><button className="link-button danger-link" type="button" onClick={() => void deleteContact(contact.id)}>Delete</button></div></td></tr>)}</tbody>
      </Table>
    </ModuleScaffold>
  );
}
