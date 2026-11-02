"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ModuleScaffold } from "@/components/business/ModuleScaffold";
import { StatusPill } from "@/components/business/StatusPill";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CreatableSelect } from "@/components/ui/CreatableSelect";
import { Input } from "@/components/ui/Input";
import { Table } from "@/components/ui/Table";
import { projectTypeOptions } from "@/data/dropdownOptions";
import { useClients } from "@/hooks/useClients";
import { useProjects } from "@/hooks/useProjects";
import { projectService } from "@/services/projectService";
import { settingsService } from "@/services/settingsService";
import { PROJECT_PRIORITIES, PROJECT_STATUSES, type Project, type ProjectFormData } from "@/types/project";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatDate } from "@/utils/formatDate";

const defaultForm: ProjectFormData = {
  client_id: "",
  project_code: "",
  project_name: "",
  project_type: "",
  description: "",
  status: "opportunity",
  start_date: "",
  target_end_date: "",
  actual_end_date: "",
  project_value: 0,
  assigned_manager: "",
  priority: "medium",
  tags: "",
  notes: ""
};

export default function ProjectsPage() {
  const { filteredProjects, isLoading, errorMessage, searchTerm, statusFilter, priorityFilter, setSearchTerm, setStatusFilter, setPriorityFilter, saveProject, deleteProject } = useProjects();
  const { clients } = useClients();
  const [form, setForm] = useState<ProjectFormData>(defaultForm);
  const [editing, setEditing] = useState<Project | null>(null);
  const [projectTypes, setProjectTypes] = useState(projectTypeOptions);

  const allProjectTypes = useMemo(
    () => Array.from(new Set([...projectTypeOptions, ...projectTypes, form.project_type].filter(Boolean))),
    [form.project_type, projectTypes]
  );

  useEffect(() => {
    if (!editing) void projectService.generateProjectCode().then((code) => setForm((current) => ({ ...current, project_code: code })));
  }, [editing]);

  useEffect(() => {
    async function loadProjectTypes() {
      const records = await settingsService.listMaster("project_types");
      setProjectTypes((current) => Array.from(new Set([...current, ...records.map((record) => record.name).filter(Boolean) as string[]])));
    }

    void loadProjectTypes();
  }, []);

  function edit(project: Project) {
    setEditing(project);
    setForm({
      client_id: project.client_id,
      project_code: project.project_code,
      project_name: project.project_name,
      project_type: project.project_type ?? "",
      description: project.description ?? "",
      status: project.status,
      start_date: project.start_date ?? "",
      target_end_date: project.target_end_date ?? "",
      actual_end_date: project.actual_end_date ?? "",
      project_value: project.project_value,
      assigned_manager: project.assigned_manager ?? "",
      priority: project.priority,
      tags: project.tags?.join(", ") ?? "",
      notes: project.notes ?? ""
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    await saveProject(form, editing?.id);
    setEditing(null);
    setForm(defaultForm);
  }

  function cancelEdit() {
    setEditing(null);
    setForm(defaultForm);
  }

  async function addProjectType(projectType: string) {
    await settingsService.createMaster("project_types", {
      name: projectType,
      description: null,
      is_active: true
    });
    setProjectTypes((current) => Array.from(new Set([...current, projectType])));
    setForm((current) => ({ ...current, project_type: projectType }));
  }

  return (
    <ModuleScaffold title="Projects" eyebrow="Project Management" description="Manage multiple projects under each client and connect quotations, contracts, invoices, expenses, and support." errorMessage={errorMessage} isLoading={isLoading} isEmpty={false}>
      <Card>
        <form className="client-form" onSubmit={submit}>
          <div className="form-grid two-columns">
            <label>Project code<Input value={form.project_code} onChange={(event) => setForm({ ...form, project_code: event.target.value })} /></label>
            <label>Client<select value={form.client_id} onChange={(event) => setForm({ ...form, client_id: event.target.value })}><option value="">Select client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.company_name}</option>)}</select></label>
            <label>Project name<Input value={form.project_name} onChange={(event) => setForm({ ...form, project_name: event.target.value })} /></label>
            <label>Project type<CreatableSelect value={form.project_type} onChange={(projectType) => setForm({ ...form, project_type: projectType })} onCreate={addProjectType} options={allProjectTypes} placeholder="Search project type" addLabel="Add project type" createButtonLabel="Add new project type" /></label>
            <label>Status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ProjectFormData["status"] })}>{PROJECT_STATUSES.map((status) => <option key={status} value={status}>{status.replace(/_/g, " ")}</option>)}</select></label>
            <label>Priority<select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as ProjectFormData["priority"] })}>{PROJECT_PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select></label>
            <label>Start date<Input type="date" value={form.start_date} onChange={(event) => setForm({ ...form, start_date: event.target.value })} /></label>
            <label>Target end date<Input type="date" value={form.target_end_date} onChange={(event) => setForm({ ...form, target_end_date: event.target.value })} /></label>
            <label>Project value<Input type="number" value={form.project_value} onChange={(event) => setForm({ ...form, project_value: Number(event.target.value) })} /></label>
            <label>Tags<Input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} placeholder="website, ecommerce, support" /></label>
          </div>
          <label>Description<textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
          <label>Notes<textarea rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
          <div className="form-actions">{editing ? <Button type="button" variant="secondary" onClick={cancelEdit}>Cancel</Button> : null}<Button type="submit">{editing ? "Save Project" : "Add Project"}</Button></div>
        </form>
      </Card>
      <Card className="toolbar-card"><div className="clients-toolbar"><Input placeholder="Search project, code, type, or client" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}><option value="all">All statuses</option>{PROJECT_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select><select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as typeof priorityFilter)}><option value="all">All priorities</option>{PROJECT_PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select></div></Card>
      <Table><thead><tr><th>Project</th><th>Client</th><th>Type</th><th>Status</th><th>Priority</th><th>Value</th><th>Target</th><th>Actions</th></tr></thead><tbody>{filteredProjects.map((project) => <tr key={project.id}><td>{project.project_code}<small>{project.project_name}</small></td><td>{project.client?.company_name || "-"}</td><td>{project.project_type || "-"}</td><td><StatusPill value={project.status} /></td><td>{project.priority}</td><td>{formatCurrency(project.project_value)}</td><td>{project.target_end_date ? formatDate(project.target_end_date) : "-"}</td><td><div className="table-actions"><button className="link-button" type="button" onClick={() => edit(project)}>Edit</button><button className="link-button danger-link" type="button" onClick={() => void deleteProject(project.id)}>Delete</button></div></td></tr>)}</tbody></Table>
    </ModuleScaffold>
  );
}
