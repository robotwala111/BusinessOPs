import { isSupabaseConfigured } from "@/lib/supabase/client";
import { assertTransition } from "@/lib/workflowRules";
import { historyService } from "@/services/historyService";
import { normalizeText, readDemoRecords, requireSupabase, writeDemoRecords } from "@/services/moduleHelpers";
import type { ProjectMilestone, ProjectMilestoneFormData, MilestoneStatus } from "@/types/milestone";
import { milestoneInvoiceEligibility } from "@/lib/commercialRules";
import { invoiceService } from "@/services/invoiceService";

const KEY = "business-ops-demo-project-milestones";

export const milestoneService = {
  async listByProject(projectId: string) {
    if (!isSupabaseConfigured) return readDemoRecords<ProjectMilestone>(KEY)
      .filter((item) => item.project_id === projectId && !item.archived_at)
      .sort((a, b) => (a.planned_date ?? "").localeCompare(b.planned_date ?? ""));
    const { data, error } = await requireSupabase().from("project_milestones").select("*")
      .eq("project_id", projectId).is("archived_at", null).order("planned_date");
    if (error) throw error;
    return (data ?? []) as ProjectMilestone[];
  },
  async create(form: ProjectMilestoneFormData, userId: string | null) {
    if (!form.name.trim()) throw new Error("Milestone name is required.");
    if (form.billing_percentage != null && (form.billing_percentage < 0 || form.billing_percentage > 100)) {
      throw new Error("Billing percentage must be between 0 and 100.");
    }
    const now = new Date().toISOString();
    const payload = {
      ...form, name: form.name.trim(), description: normalizeText(form.description),
      deliverable: normalizeText(form.deliverable), owner_id: form.owner_id || null,
      planned_date: form.planned_date || null, completion_evidence: normalizeText(form.completion_evidence),
      internal_notes: normalizeText(form.internal_notes), created_by: userId, updated_by: userId
    };
    if (!isSupabaseConfigured) {
      const record = { id: crypto.randomUUID(), ...payload, actual_completion_date: null,
        client_accepted_at: null, invoice_id: null, override_reason: null, archived_at: null,
        created_at: now, updated_at: now } as ProjectMilestone;
      writeDemoRecords(KEY, [record, ...readDemoRecords<ProjectMilestone>(KEY)]);
      await historyService.record({ entity_type: "milestone", entity_id: record.id,
        event_type: "created", previous_value: null, new_value: { status: record.status },
        description: `Milestone created: ${record.name}`, actor_id: userId, metadata: { project_id: record.project_id } });
      return record;
    }
    const { data, error } = await requireSupabase().from("project_milestones").insert(payload).select().single();
    if (error) throw error;
    await historyService.record({ entity_type: "milestone", entity_id: data.id,
      event_type: "created", previous_value: null, new_value: { status: data.status },
      description: `Milestone created: ${data.name}`, actor_id: userId, metadata: { project_id: data.project_id } });
    return data as ProjectMilestone;
  },
  async transition(record: ProjectMilestone, status: MilestoneStatus, userId: string | null) {
    assertTransition("milestone", record.status, status);
    const now = new Date().toISOString();
    const changes = { status, updated_by: userId,
      ...(status === "accepted" ? { client_accepted_at: now, actual_completion_date: now.slice(0, 10) } : {}) };
    if (!isSupabaseConfigured) {
      const records = readDemoRecords<ProjectMilestone>(KEY);
      const updated = { ...record, ...changes, updated_at: now };
      writeDemoRecords(KEY, records.map((item) => item.id === record.id ? updated : item));
      await historyService.record({ entity_type: "milestone", entity_id: record.id,
        event_type: "status_changed", previous_value: { status: record.status }, new_value: { status },
        description: `Milestone moved from ${record.status} to ${status}`, actor_id: userId,
        metadata: { project_id: record.project_id } });
      return updated;
    }
    const { data, error } = await requireSupabase().from("project_milestones").update(changes)
      .eq("id", record.id).eq("status", record.status).select().single();
    if (error) throw error;
    await historyService.record({ entity_type: "milestone", entity_id: record.id,
      event_type: "status_changed", previous_value: { status: record.status }, new_value: { status },
      description: `Milestone moved from ${record.status} to ${status}`, actor_id: userId,
      metadata: { project_id: record.project_id } });
    return data as ProjectMilestone;
  },
  async createInvoice(record: ProjectMilestone, input: { clientId: string; contractId?: string | null;
    quotationId?: string | null; availableValue: number; overrideReason?: string; userId: string | null }) {
    const amount = Number(record.billing_amount ?? 0);
    milestoneInvoiceEligibility({ status: record.status, invoice_id: record.invoice_id,
      billingAmount: amount, availableValue: input.availableValue, overrideReason: input.overrideReason });
    const invoice = await invoiceService.createInvoice({ invoice_number: await invoiceService.generateInvoiceNumber(),
      client_id: input.clientId, project_id: record.project_id, quotation_id: input.quotationId ?? "",
      contract_id: input.contractId ?? "", milestone_id: record.id, invoice_date: new Date().toISOString().slice(0, 10), due_date: "",
      status: "draft", subtotal: amount, discount_amount: 0, tax_percentage: 18,
      notes: `Generated from milestone: ${record.name}`, created_by: input.userId });
    const now = new Date().toISOString();
    const changes = { invoice_id: invoice.id, status: "invoiced" as const,
      override_reason: input.overrideReason?.trim() || null, updated_by: input.userId };
    if (!isSupabaseConfigured) writeDemoRecords(KEY, readDemoRecords<ProjectMilestone>(KEY).map((item) => item.id === record.id ? { ...item, ...changes, updated_at: now } : item));
    else { const { error } = await requireSupabase().from("project_milestones").update(changes).eq("id", record.id).is("invoice_id", null); if (error) throw error; }
    await historyService.record({ entity_type: "milestone", entity_id: record.id, event_type: "invoice_created",
      previous_value: { invoice_id: null }, new_value: { invoice_id: invoice.id }, description: "Invoice created from milestone",
      actor_id: input.userId, metadata: { invoice_id: invoice.id } });
    return invoice;
  }
};
