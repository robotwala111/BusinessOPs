"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { StatusPill } from "@/components/business/StatusPill";
import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { StatCard } from "@/components/ui/StatCard";
import { Table } from "@/components/ui/Table";
import { useAuth } from "@/hooks/useAuth";
import { allowedTransitions } from "@/lib/workflowRules";
import { milestoneService } from "@/services/milestoneService";
import { project360Service } from "@/services/project360Service";
import { projectService } from "@/services/projectService";
import { projectClosureService } from "@/services/projectClosureService";
import { MILESTONE_STATUSES, type ProjectMilestone, type ProjectMilestoneFormData } from "@/types/milestone";
import type { Project } from "@/types/project";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatDate } from "@/utils/formatDate";

const emptyMilestone: ProjectMilestoneFormData = { project_id: "", name: "", description: "",
  deliverable: "", owner_id: "", status: "planned", planned_date: "",
  billing_percentage: null, billing_amount: null, acceptance_required: true,
  completion_evidence: "", internal_notes: "" };

export function ProjectDetailPage({ projectId }: { projectId: string }) {
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
  const [summary, setSummary] = useState({ quoted: 0, contracted: 0, invoiced: 0, collected: 0,
    outstanding: 0, approvedExpenses: 0, grossMargin: 0, grossMarginPercentage: 0,
    collectionPercentage: 0, milestoneCompletion: 0 });
  const [form, setForm] = useState({ ...emptyMilestone, project_id: projectId });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [closure, setClosure] = useState({ closureNotes: "", deliverablesAccepted: false,
    finalInvoiceWaived: false, reimbursableExpensesProcessed: false,
    requiredDocumentsAttached: false, clientAcceptanceRecorded: false, overrideReason: "" });

  const load = useCallback(async () => {
    setIsLoading(true); setError("");
    try {
      const [record, data] = await Promise.all([projectService.getProjectById(projectId), project360Service.load(projectId)]);
      setProject(record); setMilestones(data.milestones); setSummary(data.summary);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load project."); }
    finally { setIsLoading(false); }
  }, [projectId]);
  useEffect(() => { void load(); }, [load]);

  async function createMilestone(event: FormEvent) {
    event.preventDefault(); setError("");
    try { await milestoneService.create(form, user?.id ?? null); setForm({ ...emptyMilestone, project_id: projectId }); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to create milestone."); }
  }
  async function transition(item: ProjectMilestone, status: ProjectMilestone["status"]) {
    try { await milestoneService.transition(item, status, user?.id ?? null); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to update milestone."); }
  }
  async function bill(item: ProjectMilestone) { if (!project) return; try {
    const invoice = await milestoneService.createInvoice(item, { clientId: project.client_id,
      availableValue: Math.max(summary.contracted, summary.quoted), userId: user?.id ?? null });
    window.location.href = `/invoices/${invoice.id}`;
  } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to create invoice."); } }
  async function closeProject(event: FormEvent) { event.preventDefault(); if (!project) return; try {
    const updated = await projectClosureService.close(project, closure, user?.id ?? null); setProject(updated);
  } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to close project."); } }

  if (isLoading) return <div className="route-placeholder">Loading project...</div>;
  if (!project) return <div className="route-placeholder">{error || "Project not found."}</div>;
  return <section className="module-page">
    <div className="module-header"><div><p className="eyebrow">Project 360°</p><h1>{project.project_name}</h1><StatusPill value={project.status} /></div>
      <div className="module-actions"><BackButton fallbackHref="/projects" /><Link href={`/clients/${project.client_id}`}><Button variant="secondary">Client</Button></Link></div></div>
    {error ? <p className="form-error">{error}</p> : null}
    <div className="dashboard-grid">
      <StatCard label="Accepted quoted" value={formatCurrency(summary.quoted)} /><StatCard label="Contracted" value={formatCurrency(summary.contracted)} />
      <StatCard label="Invoiced" value={formatCurrency(summary.invoiced)} /><StatCard label="Collected" value={formatCurrency(summary.collected)} />
      <StatCard label="Outstanding" value={formatCurrency(summary.outstanding)} /><StatCard label="Approved expenses" value={formatCurrency(summary.approvedExpenses)} />
      <StatCard label="Gross margin" value={`${formatCurrency(summary.grossMargin)} (${summary.grossMarginPercentage}%)`} />
      <StatCard label="Milestones complete" value={`${summary.milestoneCompletion}%`} />
    </div>
    <Card><h2>Overview</h2><div className="detail-grid"><Detail label="Reference" value={project.project_code} /><Detail label="Type" value={project.project_type} />
      <Detail label="Priority" value={project.priority} /><Detail label="Start" value={project.start_date ? formatDate(project.start_date) : null} />
      <Detail label="Target" value={project.target_end_date ? formatDate(project.target_end_date) : null} /><Detail label="Budget" value={formatCurrency(project.budget)} /></div>
      <p>{project.description || "No project description."}</p></Card>
    <Card><form className="client-form" onSubmit={createMilestone}><h2>Add milestone</h2><div className="form-grid two-columns">
      <label>Name<Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
      <label>Planned date<Input type="date" value={form.planned_date} onChange={(e) => setForm({ ...form, planned_date: e.target.value })} /></label>
      <label>Billing amount<Input type="number" value={form.billing_amount ?? ""} onChange={(e) => setForm({ ...form, billing_amount: e.target.value ? Number(e.target.value) : null })} /></label>
      <label>Billing percentage<Input type="number" value={form.billing_percentage ?? ""} onChange={(e) => setForm({ ...form, billing_percentage: e.target.value ? Number(e.target.value) : null })} /></label></div>
      <label>Deliverable<textarea rows={2} value={form.deliverable} onChange={(e) => setForm({ ...form, deliverable: e.target.value })} /></label><div className="form-actions"><Button type="submit">Add milestone</Button></div></form></Card>
    <Card><h2>Milestones</h2>{milestones.length === 0 ? <p className="muted">No milestones yet.</p> : <Table><thead><tr><th>Milestone</th><th>Planned</th><th>Billing</th><th>Status</th><th>Next action</th></tr></thead><tbody>
      {milestones.map((item) => <tr key={item.id}><td>{item.name}<small>{item.deliverable || "-"}</small></td><td>{item.planned_date ? formatDate(item.planned_date) : "-"}</td><td>{item.billing_amount != null ? formatCurrency(item.billing_amount) : `${item.billing_percentage ?? 0}%`}</td><td><StatusPill value={item.status} /></td><td><select value="" onChange={(e) => { if (e.target.value) void transition(item, e.target.value as ProjectMilestone["status"]); }}><option value="">Move to...</option>{allowedTransitions("milestone", item.status).map((status) => <option key={status} value={status}>{status.replace(/_/g, " ")}</option>)}</select>{item.status === "accepted" && !item.invoice_id ? <button type="button" className="link-button" onClick={() => void bill(item)}>Create invoice</button> : null}{item.invoice_id ? <Link href={`/invoices/${item.invoice_id}`}>Invoice</Link> : null}</td></tr>)}
    </tbody></Table>}</Card>
    {!["closed", "archived"].includes(project.status) ? <Card><form className="client-form" onSubmit={closeProject}><h2>Project closure</h2>
      <label><input type="checkbox" checked={closure.deliverablesAccepted} onChange={(e) => setClosure({ ...closure, deliverablesAccepted: e.target.checked })} /> Deliverables accepted</label>
      <label><input type="checkbox" checked={closure.clientAcceptanceRecorded} onChange={(e) => setClosure({ ...closure, clientAcceptanceRecorded: e.target.checked })} /> Client acceptance recorded</label>
      <label><input type="checkbox" checked={closure.finalInvoiceWaived} onChange={(e) => setClosure({ ...closure, finalInvoiceWaived: e.target.checked })} /> Final invoice explicitly waived</label>
      <label><input type="checkbox" checked={closure.reimbursableExpensesProcessed} onChange={(e) => setClosure({ ...closure, reimbursableExpensesProcessed: e.target.checked })} /> Reimbursable expenses processed</label>
      <label><input type="checkbox" checked={closure.requiredDocumentsAttached} onChange={(e) => setClosure({ ...closure, requiredDocumentsAttached: e.target.checked })} /> Required documents attached</label>
      <label>Closure notes<textarea rows={3} value={closure.closureNotes} onChange={(e) => setClosure({ ...closure, closureNotes: e.target.value })} /></label>
      <label>Override reason, only when closing with blockers<textarea rows={2} value={closure.overrideReason} onChange={(e) => setClosure({ ...closure, overrideReason: e.target.value })} /></label>
      <p className="muted">Outstanding receivables remain visible after closure: {formatCurrency(summary.outstanding)}</p><div className="form-actions"><Button type="submit">Close project</Button></div></form></Card> : null}
  </section>;
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return <div className="detail-item"><span>{label}</span><strong>{value || "-"}</strong></div>;
}
