"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ModuleScaffold } from "@/components/business/ModuleScaffold";
import { StatusPill } from "@/components/business/StatusPill";
import { AutocompleteInput } from "@/components/ui/AutocompleteInput";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Table } from "@/components/ui/Table";
import { leadSourceOptions, projectTypeOptions } from "@/data/dropdownOptions";
import { useLeads } from "@/hooks/useLeads";
import { leadService } from "@/services/leadService";
import { LEAD_PRIORITIES, LEAD_STATUSES, type Lead, type LeadFormData } from "@/types/lead";
import type { LeadConversionResult } from "@/types/workflow";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatDate } from "@/utils/formatDate";

const defaultForm: LeadFormData = {
  lead_number: "",
  company_name: "",
  contact_person: "",
  email: "",
  phone: "",
  website: "",
  location: "",
  lead_source: "",
  service_interested: "",
  status: "new",
  priority: "medium",
  assigned_to: "",
  estimated_value: 0,
  expected_close_date: "",
  follow_up_date: "",
  campaign: "",
  notes: "",
  lost_reason: ""
};

export default function LeadsPage() {
  const {
    filteredLeads,
    sourceOptions,
    assignedToOptions,
    isLoading,
    errorMessage,
    searchTerm,
    statusFilter,
    priorityFilter,
    sourceFilter,
    assignedToFilter,
    setSearchTerm,
    setStatusFilter,
    setPriorityFilter,
    setSourceFilter,
    setAssignedToFilter,
    saveLead,
    markLeadLost,
    convertLead,
    deleteLead
  } = useLeads();
  const [form, setForm] = useState<LeadFormData>(defaultForm);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [lostLead, setLostLead] = useState<Lead | null>(null);
  const [lostReason, setLostReason] = useState("");
  const [convertingLead, setConvertingLead] = useState<Lead | null>(null);
  const [createProject, setCreateProject] = useState(true);
  const [conversionResult, setConversionResult] = useState<LeadConversionResult | null>(null);
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (!editing) {
      void leadService.generateLeadNumber().then((number) => setForm((current) => ({ ...current, lead_number: number })));
    }
  }, [editing]);

  function edit(lead: Lead) {
    setEditing(lead);
    setForm({
      lead_number: lead.lead_number,
      company_name: lead.company_name,
      contact_person: lead.contact_person ?? "",
      email: lead.email ?? "",
      phone: lead.phone ?? "",
      website: lead.website ?? "",
      location: lead.location ?? "",
      lead_source: lead.lead_source ?? "",
      service_interested: lead.service_interested ?? "",
      status: lead.status,
      priority: lead.priority,
      assigned_to: lead.assigned_to ?? "",
      estimated_value: lead.estimated_value,
      expected_close_date: lead.expected_close_date ?? "",
      follow_up_date: lead.follow_up_date?.slice(0, 16) ?? "",
      campaign: lead.campaign ?? "",
      notes: lead.notes ?? "",
      lost_reason: lead.lost_reason ?? ""
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError("");

    if (!form.lead_number.trim() || !form.company_name.trim()) {
      setFormError("Lead number and company name are required.");
      return;
    }

    await saveLead(form, editing?.id);
    setEditing(null);
    setForm(defaultForm);
  }

  async function handleConvert() {
    if (!convertingLead) return;
    setActionError("");
    try {
      setConversionResult(await convertLead(convertingLead.id, createProject));
      setConvertingLead(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to convert lead.");
    }
  }

  async function submitLost(event: FormEvent) {
    event.preventDefault();
    if (!lostLead) return;
    if (!lostReason.trim()) {
      setActionError("Lost reason is required.");
      return;
    }
    await markLeadLost(lostLead.id, lostReason);
    setLostLead(null);
    setLostReason("");
  }

  function cancelEdit() {
    setEditing(null);
    setForm(defaultForm);
    setFormError("");
  }

  return (
    <ModuleScaffold title="Leads" eyebrow="CRM Lead Management" description="Track incoming opportunities, qualify demand, mark lost leads, and convert qualified leads to clients." errorMessage={errorMessage || formError || actionError} isLoading={isLoading} isEmpty={false}>
      <Card>
        <form className="client-form" onSubmit={submit}>
          <div className="form-grid two-columns">
            <label>Lead number<Input value={form.lead_number} onChange={(event) => setForm({ ...form, lead_number: event.target.value })} /></label>
            <label>Company name<Input value={form.company_name} onChange={(event) => setForm({ ...form, company_name: event.target.value })} /></label>
            <label>Contact person<Input value={form.contact_person} onChange={(event) => setForm({ ...form, contact_person: event.target.value })} /></label>
            <label>Email<Input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
            <label>Phone<Input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
            <label>Website<Input value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} /></label>
            <label>Location<Input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></label>
            <label>Lead source<AutocompleteInput value={form.lead_source} onChange={(event) => setForm({ ...form, lead_source: event.target.value })} options={leadSourceOptions} placeholder="Search source" /></label>
            <label>Service interested<AutocompleteInput value={form.service_interested} onChange={(event) => setForm({ ...form, service_interested: event.target.value })} options={projectTypeOptions} placeholder="Search service" /></label>
            <label>Status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as LeadFormData["status"] })}>{LEAD_STATUSES.map((status) => <option key={status} value={status}>{status.replace(/_/g, " ")}</option>)}</select></label>
            <label>Priority<select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as LeadFormData["priority"] })}>{LEAD_PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select></label>
            <label>Assigned to<Input value={form.assigned_to} onChange={(event) => setForm({ ...form, assigned_to: event.target.value })} placeholder="User id, optional" /></label>
            <label>Estimated value<Input type="number" value={form.estimated_value} onChange={(event) => setForm({ ...form, estimated_value: Number(event.target.value) })} /></label>
            <label>Expected close date<Input type="date" value={form.expected_close_date} onChange={(event) => setForm({ ...form, expected_close_date: event.target.value })} /></label>
            <label>Follow-up date<Input type="datetime-local" value={form.follow_up_date} onChange={(event) => setForm({ ...form, follow_up_date: event.target.value })} /></label>
            <label>Campaign<Input value={form.campaign} onChange={(event) => setForm({ ...form, campaign: event.target.value })} /></label>
          </div>
          <label>Notes<textarea rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
          <label>Lost reason<textarea rows={2} value={form.lost_reason} onChange={(event) => setForm({ ...form, lost_reason: event.target.value })} /></label>
          <div className="form-actions">{editing ? <Button type="button" variant="secondary" onClick={cancelEdit}>Cancel</Button> : null}<Button type="submit">{editing ? "Save Lead" : "Create Lead"}</Button></div>
        </form>
      </Card>

      {lostLead ? (
        <Card>
          <form className="client-form" onSubmit={submitLost}>
            <h2>Mark lead as lost</h2>
            <p className="muted">{lostLead.company_name}</p>
            <label>Lost reason<textarea rows={3} value={lostReason} onChange={(event) => setLostReason(event.target.value)} /></label>
            <div className="form-actions"><Button type="button" variant="secondary" onClick={() => setLostLead(null)}>Cancel</Button><Button type="submit" variant="danger">Mark Lost</Button></div>
          </form>
        </Card>
      ) : null}

      {convertingLead ? (
        <Card>
          <h2>Convert lead</h2>
          <p>Create connected records for <strong>{convertingLead.company_name}</strong>. The primary contact will be {convertingLead.contact_person || "missing"}.</p>
          {!convertingLead.contact_person ? <p className="form-error">Add a contact person before conversion.</p> : null}
          <label><input type="checkbox" checked={createProject} onChange={(event) => setCreateProject(event.target.checked)} /> Create an opportunity project</label>
          <div className="form-actions"><Button type="button" variant="secondary" onClick={() => setConvertingLead(null)}>Cancel</Button><Button type="button" disabled={!convertingLead.contact_person} onClick={() => void handleConvert()}>Convert atomically</Button></div>
        </Card>
      ) : null}

      {conversionResult ? (
        <Card>
          <h2>Conversion completed</h2>
          <div className="module-actions">
            <Link href={`/clients/${conversionResult.client_id}`}><Button type="button">Open client</Button></Link>
            <Link href={`/contacts?client=${conversionResult.client_id}`}><Button type="button" variant="secondary">Open contact</Button></Link>
            {conversionResult.project_id ? <Link href={`/projects/${conversionResult.project_id}`}><Button type="button" variant="secondary">Open project</Button></Link> : null}
          </div>
        </Card>
      ) : null}

      <Card className="toolbar-card">
        <div className="clients-toolbar">
          <Input placeholder="Search company, contact, email, phone, or service" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}><option value="all">All statuses</option>{LEAD_STATUSES.map((status) => <option key={status} value={status}>{status.replace(/_/g, " ")}</option>)}</select>
          <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as typeof priorityFilter)}><option value="all">All priorities</option>{LEAD_PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select>
          <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}><option value="all">All sources</option>{sourceOptions.map((source) => <option key={source} value={source}>{source}</option>)}</select>
          <select value={assignedToFilter} onChange={(event) => setAssignedToFilter(event.target.value)}><option value="all">All assignees</option>{assignedToOptions.map((assignee) => <option key={assignee} value={assignee}>{assignee}</option>)}</select>
        </div>
      </Card>

      <Table>
        <thead><tr><th>Lead</th><th>Contact</th><th>Service</th><th>Status</th><th>Priority</th><th>Value</th><th>Follow-up</th><th>Actions</th></tr></thead>
        <tbody>{filteredLeads.map((lead) => { const overdue = Boolean(lead.follow_up_date && new Date(lead.follow_up_date) < new Date() && !["converted", "lost"].includes(lead.status)); return <tr key={lead.id}><td>{lead.lead_number}<small>{lead.company_name}</small></td><td>{lead.contact_person || "-"}<small>{lead.email || lead.phone || "-"}</small></td><td>{lead.service_interested || "-"}</td><td><StatusPill value={lead.status} /></td><td><StatusPill value={lead.priority} /></td><td>{formatCurrency(lead.estimated_value)}</td><td>{lead.follow_up_date ? formatDate(lead.follow_up_date) : "-"}{overdue ? <small className="form-error">Overdue</small> : null}</td><td><div className="table-actions"><button className="link-button" type="button" disabled={lead.status === "converted"} onClick={() => edit(lead)}>Edit</button><button className="link-button" type="button" disabled={Boolean(lead.converted_client_id)} onClick={() => { setConvertingLead(lead); setConversionResult(null); }}>Convert</button><button className="link-button" type="button" disabled={["lost", "converted"].includes(lead.status)} onClick={() => { setLostLead(lead); setLostReason(lead.lost_reason ?? ""); }}>Lost</button>{lead.converted_client_id ? <Link href={`/clients/${lead.converted_client_id}`}>Client</Link> : null}{lead.converted_project_id ? <Link href={`/projects/${lead.converted_project_id}`}>Project</Link> : null}{lead.status !== "converted" ? <button className="link-button danger-link" type="button" onClick={() => void deleteLead(lead.id)}>Delete</button> : null}</div></td></tr>; })}</tbody>
      </Table>
    </ModuleScaffold>
  );
}
