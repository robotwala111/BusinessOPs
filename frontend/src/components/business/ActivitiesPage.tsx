"use client";

import { FormEvent, useMemo, useState } from "react";
import { ModuleScaffold } from "@/components/business/ModuleScaffold";
import { ProjectSelect } from "@/components/projects/ProjectSelect";
import { StatusPill } from "@/components/business/StatusPill";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Table } from "@/components/ui/Table";
import { useActivities } from "@/hooks/useActivities";
import { useClients } from "@/hooks/useClients";
import { useContacts } from "@/hooks/useContacts";
import {
  ACTIVITY_PRIORITIES,
  ACTIVITY_STATUSES,
  ACTIVITY_TYPES,
  type Activity,
  type ActivityFormData
} from "@/types/activity";
import { formatDate } from "@/utils/formatDate";

const nowLocal = () => new Date().toISOString().slice(0, 16);

const defaultForm: ActivityFormData = {
  client_id: "",
  contact_id: "",
  project_id: "",
  activity_type: "follow_up",
  subject: "",
  description: "",
  activity_date: nowLocal(),
  due_date: "",
  status: "pending",
  priority: "medium",
  assigned_to: "",
  completed_at: ""
};

export function ActivitiesPage() {
  const {
    filteredActivities,
    isLoading,
    errorMessage,
    searchTerm,
    statusFilter,
    priorityFilter,
    setSearchTerm,
    setStatusFilter,
    setPriorityFilter,
    saveActivity,
    deleteActivity
  } = useActivities();
  const { clients } = useClients();
  const { contacts } = useContacts();
  const [form, setForm] = useState<ActivityFormData>(defaultForm);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [formError, setFormError] = useState("");
  const clientContacts = useMemo(
    () => contacts.filter((contact) => contact.client_id === form.client_id),
    [contacts, form.client_id]
  );

  function edit(activity: Activity) {
    setEditing(activity);
    setForm({
      client_id: activity.client_id,
      contact_id: activity.contact_id ?? "",
      project_id: activity.project_id ?? "",
      activity_type: activity.activity_type,
      subject: activity.subject,
      description: activity.description ?? "",
      activity_date: activity.activity_date.slice(0, 16),
      due_date: activity.due_date?.slice(0, 16) ?? "",
      status: activity.status,
      priority: activity.priority,
      assigned_to: activity.assigned_to ?? "",
      completed_at: activity.completed_at?.slice(0, 16) ?? ""
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError("");

    if (!form.client_id || !form.subject.trim()) {
      setFormError("Client and subject are required.");
      return;
    }

    await saveActivity(form, editing?.id);
    setEditing(null);
    setForm(defaultForm);
  }

  function cancelEdit() {
    setEditing(null);
    setForm(defaultForm);
    setFormError("");
  }

  return (
    <ModuleScaffold title="Activities" eyebrow="CRM Follow-ups" description="Track calls, meetings, follow-ups, payment conversations, support discussions, and notes." errorMessage={errorMessage || formError} isLoading={isLoading} isEmpty={false}>
      <Card>
        <form className="client-form" onSubmit={submit}>
          <div className="form-grid two-columns">
            <label>Client<select value={form.client_id} onChange={(event) => setForm({ ...form, client_id: event.target.value, contact_id: "", project_id: "" })}><option value="">Select client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.company_name}</option>)}</select></label>
            <label>Contact<select value={form.contact_id} onChange={(event) => setForm({ ...form, contact_id: event.target.value })} disabled={!form.client_id}><option value="">No linked contact</option>{clientContacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.full_name}</option>)}</select></label>
            <label>Project<ProjectSelect clientId={form.client_id} value={form.project_id} onChange={(projectId) => setForm({ ...form, project_id: projectId })} /></label>
            <label>Type<select value={form.activity_type} onChange={(event) => setForm({ ...form, activity_type: event.target.value as ActivityFormData["activity_type"] })}>{ACTIVITY_TYPES.map((type) => <option key={type} value={type}>{type.replace(/_/g, " ")}</option>)}</select></label>
            <label>Subject<Input value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} /></label>
            <label>Activity date<Input type="datetime-local" value={form.activity_date} onChange={(event) => setForm({ ...form, activity_date: event.target.value })} /></label>
            <label>Due date<Input type="datetime-local" value={form.due_date} onChange={(event) => setForm({ ...form, due_date: event.target.value })} /></label>
            <label>Status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ActivityFormData["status"] })}>{ACTIVITY_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
            <label>Priority<select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as ActivityFormData["priority"] })}>{ACTIVITY_PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select></label>
            <label>Assigned to<Input value={form.assigned_to} onChange={(event) => setForm({ ...form, assigned_to: event.target.value })} placeholder="User id, optional" /></label>
          </div>
          <label>Description<textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
          <div className="form-actions">{editing ? <Button type="button" variant="secondary" onClick={cancelEdit}>Cancel</Button> : null}<Button type="submit">{editing ? "Save Activity" : "Add Activity"}</Button></div>
        </form>
      </Card>

      <Card className="toolbar-card">
        <div className="clients-toolbar">
          <Input placeholder="Search subject, client, contact, project, or notes" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}><option value="all">All statuses</option>{ACTIVITY_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select>
          <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as typeof priorityFilter)}><option value="all">All priorities</option>{ACTIVITY_PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select>
        </div>
      </Card>

      <Table>
        <thead><tr><th>Activity</th><th>Client</th><th>Contact</th><th>Project</th><th>Status</th><th>Priority</th><th>Due</th><th>Actions</th></tr></thead>
        <tbody>{filteredActivities.map((activity) => <tr key={activity.id}><td>{activity.subject}<small>{activity.activity_type.replace(/_/g, " ")}</small></td><td>{activity.client?.company_name || "-"}</td><td>{activity.contact?.full_name || "-"}</td><td>{activity.project?.project_name || "-"}</td><td><StatusPill value={activity.status} /></td><td><StatusPill value={activity.priority} /></td><td>{activity.due_date ? formatDate(activity.due_date) : "-"}</td><td><div className="table-actions"><button className="link-button" type="button" onClick={() => edit(activity)}>Edit</button><button className="link-button danger-link" type="button" onClick={() => void deleteActivity(activity.id)}>Delete</button></div></td></tr>)}</tbody>
      </Table>
    </ModuleScaffold>
  );
}
