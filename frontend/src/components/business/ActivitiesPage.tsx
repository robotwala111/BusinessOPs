"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  const searchParams = useSearchParams();
  const urlClientId = searchParams?.get("client_id") || "";

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

  const [form, setForm] = useState<ActivityFormData>(() => ({
    ...defaultForm,
    client_id: urlClientId
  }));
  const [clientFilter, setClientFilter] = useState<string>(urlClientId || "all");
  const [editing, setEditing] = useState<Activity | null>(null);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (urlClientId) {
      setForm((prev) => ({ ...prev, client_id: urlClientId }));
      setClientFilter(urlClientId);
    }
  }, [urlClientId]);

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
    setForm({ ...defaultForm, client_id: clientFilter !== "all" ? clientFilter : "" });
  }

  function cancelEdit() {
    setEditing(null);
    setForm({ ...defaultForm, client_id: clientFilter !== "all" ? clientFilter : "" });
    setFormError("");
  }

  const displayedActivities = useMemo(() => {
    if (clientFilter === "all") return filteredActivities;
    return filteredActivities.filter((a) => a.client_id === clientFilter);
  }, [filteredActivities, clientFilter]);

  return (
    <ModuleScaffold
      title="Activities & Interactions"
      eyebrow="CRM Operations"
      description="Track calls, emails, client meetings, demos, follow-ups, payment conversations, and internal notes."
      errorMessage={errorMessage || formError}
      isLoading={isLoading}
      isEmpty={false}
    >
      <Card>
        <form className="client-form" onSubmit={submit}>
          <h2 style={{ margin: "0 0 12px 0", fontSize: "1.1rem" }}>
            {editing ? "Edit Interaction Activity" : "Log New Interaction Activity"}
          </h2>
          <div className="form-grid two-columns">
            <label>
              Client
              <select
                value={form.client_id}
                onChange={(event) =>
                  setForm({ ...form, client_id: event.target.value, contact_id: "", project_id: "" })
                }
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
              Contact Person
              <select
                value={form.contact_id}
                onChange={(event) => setForm({ ...form, contact_id: event.target.value })}
                disabled={!form.client_id}
              >
                <option value="">No linked contact</option>
                {clientContacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.full_name} {contact.designation ? `(${contact.designation})` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Project
              <ProjectSelect
                clientId={form.client_id}
                value={form.project_id}
                onChange={(projectId) => setForm({ ...form, project_id: projectId })}
              />
            </label>
            <label>
              Interaction Type
              <select
                value={form.activity_type}
                onChange={(event) =>
                  setForm({ ...form, activity_type: event.target.value as ActivityFormData["activity_type"] })
                }
              >
                {ACTIVITY_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type.replace(/_/g, " ").toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Subject / Topic
              <Input
                value={form.subject}
                onChange={(event) => setForm({ ...form, subject: event.target.value })}
                placeholder="e.g. Scope alignment call or Invoice reminder"
                required
              />
            </label>
            <label>
              Activity Date & Time
              <Input
                type="datetime-local"
                value={form.activity_date}
                onChange={(event) => setForm({ ...form, activity_date: event.target.value })}
              />
            </label>
            <label>
              Next Follow-up Due Date
              <Input
                type="datetime-local"
                value={form.due_date}
                onChange={(event) => setForm({ ...form, due_date: event.target.value })}
              />
            </label>
            <label>
              Status
              <select
                value={form.status}
                onChange={(event) =>
                  setForm({ ...form, status: event.target.value as ActivityFormData["status"] })
                }
              >
                {ACTIVITY_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Priority
              <select
                value={form.priority}
                onChange={(event) =>
                  setForm({ ...form, priority: event.target.value as ActivityFormData["priority"] })
                }
              >
                {ACTIVITY_PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Assigned Representative
              <Input
                value={form.assigned_to}
                onChange={(event) => setForm({ ...form, assigned_to: event.target.value })}
                placeholder="Staff name or email"
              />
            </label>
          </div>
          <label style={{ marginTop: "10px" }}>
            Meeting Notes & Key Takeaways
            <textarea
              rows={3}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="Action items, client feedback, commitments made..."
            />
          </label>
          <div className="form-actions" style={{ marginTop: "12px" }}>
            {editing ? (
              <Button type="button" variant="secondary" onClick={cancelEdit}>
                Cancel
              </Button>
            ) : null}
            <Button type="submit">{editing ? "Save Activity" : "Log Activity"}</Button>
          </div>
        </form>
      </Card>

      <Card className="toolbar-card">
        <div className="clients-toolbar" style={{ gridTemplateColumns: "minmax(200px, 1fr) 200px 160px 160px" }}>
          <Input
            placeholder="Search subject, client, contact, notes..."
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
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
            <option value="all">All statuses</option>
            {ACTIVITY_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <select
            value={priorityFilter}
            onChange={(event) => setPriorityFilter(event.target.value as typeof priorityFilter)}
          >
            <option value="all">All priorities</option>
            {ACTIVITY_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priority.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      </Card>

      <Card>
        <Table>
          <thead>
            <tr>
              <th>Activity</th>
              <th>Client</th>
              <th>Contact</th>
              <th>Project</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Follow-up Due</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayedActivities.length > 0 ? (
              displayedActivities.map((activity) => (
                <tr key={activity.id}>
                  <td>
                    <strong>{activity.subject}</strong>
                    <small style={{ display: "block", color: "#64748b" }}>
                      {activity.activity_type.replace(/_/g, " ").toUpperCase()} · {formatDate(activity.activity_date)}
                    </small>
                  </td>
                  <td>{activity.client?.company_name || "-"}</td>
                  <td>{activity.contact?.full_name || "-"}</td>
                  <td>{activity.project?.project_name || "-"}</td>
                  <td>
                    <StatusPill value={activity.status} />
                  </td>
                  <td>
                    <StatusPill value={activity.priority} />
                  </td>
                  <td>{activity.due_date ? formatDate(activity.due_date) : "-"}</td>
                  <td>
                    <div className="table-actions">
                      <button className="link-button" type="button" onClick={() => edit(activity)}>
                        Edit
                      </button>
                      <button
                        className="link-button danger-link"
                        type="button"
                        onClick={() => void deleteActivity(activity.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="table-empty-cell">
                  No activities found matching the filters.
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>
    </ModuleScaffold>
  );
}
