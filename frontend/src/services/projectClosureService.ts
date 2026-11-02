import { isSupabaseConfigured } from "@/lib/supabase/client";
import { projectClosureReadiness } from "@/lib/commercialRules";
import { historyService } from "@/services/historyService";
import { readDemoRecords, requireSupabase, writeDemoRecords } from "@/services/moduleHelpers";
import { project360Service } from "@/services/project360Service";
import type { Project } from "@/types/project";

const KEY = "business-ops-demo-projects";

export const projectClosureService = {
  async readiness(project: Project, input: { closureNotes: string; deliverablesAccepted: boolean;
    finalInvoiceWaived: boolean; reimbursableExpensesProcessed: boolean; requiredDocumentsAttached: boolean;
    clientAcceptanceRecorded: boolean }) {
    const data = await project360Service.load(project.id);
    const incompleteMilestones = data.milestones.filter((item) => !["accepted", "invoiced", "cancelled"].includes(item.status)).length;
    const finalInvoiceRaised = data.invoices.some((item) => !["draft", "cancelled"].includes(item.status));
    const unprocessed = data.expenses.filter((item) => item.reimbursable && !["paid", "cancelled"].includes(item.status)).length;
    return { ...projectClosureReadiness({ incompleteMilestones,
      deliverablesAccepted: input.deliverablesAccepted,
      finalInvoiceRaisedOrWaived: finalInvoiceRaised || input.finalInvoiceWaived,
      unprocessedReimbursableExpenses: input.reimbursableExpensesProcessed ? 0 : unprocessed,
      requiredDocumentsAttached: input.requiredDocumentsAttached,
      clientAcceptanceRecorded: input.clientAcceptanceRecorded, closureNotes: input.closureNotes }),
      outstanding: data.summary.outstanding };
  },
  async close(project: Project, input: { closureNotes: string; deliverablesAccepted: boolean;
    finalInvoiceWaived: boolean; reimbursableExpensesProcessed: boolean; requiredDocumentsAttached: boolean;
    clientAcceptanceRecorded: boolean; overrideReason?: string }, userId: string | null) {
    const readiness = await this.readiness(project, input);
    if (!readiness.ready && !input.overrideReason?.trim()) throw new Error(`Project cannot close: ${readiness.blockers.join(" ")}`);
    const now = new Date().toISOString();
    const changes = { status: "closed" as const, closure_notes: input.closureNotes.trim(), closed_at: now,
      closed_by: userId, closure_override_reason: input.overrideReason?.trim() || null,
      deliverables_accepted: input.deliverablesAccepted, final_invoice_waived: input.finalInvoiceWaived,
      reimbursable_expenses_processed: input.reimbursableExpensesProcessed,
      required_documents_attached: input.requiredDocumentsAttached,
      client_accepted_at: input.clientAcceptanceRecorded ? now : project.client_accepted_at,
      updated_by: userId, updated_at: now };
    if (!isSupabaseConfigured) writeDemoRecords(KEY, readDemoRecords<Project>(KEY).map((item) => item.id === project.id ? { ...item, ...changes } : item));
    else { const { error } = await requireSupabase().from("projects").update(changes).eq("id", project.id); if (error) throw error; }
    await historyService.record({ entity_type: "project", entity_id: project.id, event_type: "project_closed",
      previous_value: { status: project.status }, new_value: { status: "closed" },
      description: input.overrideReason ? `Project closed with override: ${input.overrideReason.trim()}` : "Project closure checklist completed",
      actor_id: userId, metadata: { blockers_overridden: readiness.blockers, outstanding: readiness.outstanding } });
    return { ...project, ...changes };
  }
};

