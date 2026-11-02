import { isSupabaseConfigured } from "@/lib/supabase/client";
import { validateLeadForConversion } from "@/lib/leadConversion";
import { clientService } from "@/services/clientService";
import { historyService } from "@/services/historyService";
import { generateNumber, normalizeText, readDemoRecords, requireSupabase, toNumber, writeDemoRecords } from "@/services/moduleHelpers";
import { projectService } from "@/services/projectService";
import { settingsService } from "@/services/settingsService";
import type { Client } from "@/types/client";
import type { Contact } from "@/types/contact";
import type { Lead, LeadCreateInput, LeadFormData, LeadUpdateInput } from "@/types/lead";
import type { Project } from "@/types/project";
import type { LeadConversionResult } from "@/types/workflow";

const KEY = "business-ops-demo-leads";
const CLIENT_KEY = "business-ops-demo-clients";
const CONTACT_KEY = "business-ops-demo-contacts";
const PROJECT_KEY = "business-ops-demo-projects";

function normalizeUuid(value?: string | null) {
  return value && value.trim() ? value.trim() : null;
}

function normalize(data: Partial<LeadFormData>) {
  return {
    ...("lead_number" in data ? { lead_number: data.lead_number?.trim() } : {}),
    ...("company_name" in data ? { company_name: data.company_name?.trim() } : {}),
    ...("contact_person" in data ? { contact_person: normalizeText(data.contact_person) } : {}),
    ...("email" in data ? { email: normalizeText(data.email) } : {}),
    ...("phone" in data ? { phone: normalizeText(data.phone) } : {}),
    ...("website" in data ? { website: normalizeText(data.website) } : {}),
    ...("location" in data ? { location: normalizeText(data.location) } : {}),
    ...("lead_source" in data ? { lead_source: normalizeText(data.lead_source) } : {}),
    ...("service_interested" in data ? { service_interested: normalizeText(data.service_interested) } : {}),
    ...("status" in data ? { status: data.status } : {}),
    ...("priority" in data ? { priority: data.priority } : {}),
    ...("assigned_to" in data ? { assigned_to: normalizeUuid(data.assigned_to) } : {}),
    ...("estimated_value" in data ? { estimated_value: toNumber(data.estimated_value) } : {}),
    ...("expected_close_date" in data ? { expected_close_date: data.expected_close_date || null } : {}),
    ...("follow_up_date" in data ? { follow_up_date: data.follow_up_date || null } : {}),
    ...("campaign" in data ? { campaign: normalizeText(data.campaign) } : {}),
    ...("notes" in data ? { notes: normalizeText(data.notes) } : {}),
    ...("lost_reason" in data ? { lost_reason: normalizeText(data.lost_reason) } : {})
  };
}

function sortLeads(records: Lead[]) {
  return [...records].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

async function attachConvertedClients(records: Lead[]) {
  if (records.length === 0) return records;

  const clients = await clientService.getClients();
  const clientsById = new Map(clients.map((client) => [client.id, client]));
  return records.map((record) => ({
    ...record,
    converted_client: record.converted_client_id
      ? clientsById.get(record.converted_client_id) ?? null
      : null
  }));
}

export const leadService = {
  generateLeadNumber() {
    return settingsService
      .getNumberingPrefix("lead", "LEAD")
      .then((prefix) => generateNumber("leads", "lead_number", KEY, prefix));
  },
  async getLeads() {
    if (!isSupabaseConfigured) {
      return attachConvertedClients(sortLeads(readDemoRecords<Lead>(KEY)));
    }

    const { data, error } = await requireSupabase()
      .from("leads")
      .select("*, converted_client:clients(*)")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []).map((lead) => ({
      ...lead,
      converted_client: lead.converted_client as Client | null
    })) as Lead[];
  },
  async createLead(data: LeadCreateInput) {
    const payload = { ...normalize(data), created_by: data.created_by };

    if (!isSupabaseConfigured) {
      const now = new Date().toISOString();
      const record = {
        id: crypto.randomUUID(),
        ...payload,
        converted_client_id: null,
        converted_at: null,
        created_at: now,
        updated_at: now
      } as Lead;
      writeDemoRecords(KEY, [record, ...readDemoRecords<Lead>(KEY)]);
      return record;
    }

    const { data: record, error } = await requireSupabase()
      .from("leads")
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return record as Lead;
  },
  async updateLead(id: string, data: LeadUpdateInput) {
    const payload = normalize(data);

    if (!isSupabaseConfigured) {
      const records = readDemoRecords<Lead>(KEY);
      const updated = records.map((record) =>
        record.id === id ? { ...record, ...payload, updated_at: new Date().toISOString() } as Lead : record
      );
      writeDemoRecords(KEY, updated);
      return updated.find((record) => record.id === id) ?? null;
    }

    const { data: record, error } = await requireSupabase()
      .from("leads")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return record as Lead;
  },
  async markLeadLost(id: string, lostReason: string) {
    return this.updateLead(id, {
      status: "lost",
      lost_reason: lostReason
    });
  },
  async convertLeadToClient(id: string, createdBy: string | null, createProject = true): Promise<LeadConversionResult> {
    const lead = validateLeadForConversion((await this.getLeads()).find((record) => record.id === id));

    if (isSupabaseConfigured) {
      const { data, error } = await requireSupabase().rpc("convert_lead", {
        p_lead_id: id,
        p_create_project: createProject
      });
      if (error) throw error;
      return data as LeadConversionResult;
    }

    const convertedAt = new Date().toISOString();
    const clientId = crypto.randomUUID();
    const contactId = crypto.randomUUID();
    const projectId = createProject ? crypto.randomUUID() : null;
    const projectCode = createProject ? await projectService.generateProjectCode() : null;
    const client = { id: clientId, company_name: lead.company_name, client_short_name: null,
      contact_person: lead.contact_person, email: lead.email, phone: lead.phone, gst_number: null,
      pan_number: null, address: lead.location, city: null, state: null, country: "India",
      industry: null, lead_source: lead.lead_source, status: "active", notes: lead.notes,
      account_owner: lead.assigned_to, payment_terms: null, archived_at: null, archived_by: null,
      updated_by: createdBy, created_by: createdBy, created_at: convertedAt, updated_at: convertedAt } as Client;
    const contact = { id: contactId, client_id: clientId, full_name: lead.contact_person,
      designation: null, email: lead.email, phone: lead.phone, whatsapp: null, department: null,
      is_primary: true, is_billing_contact: true, is_project_contact: true, notes: null,
      archived_at: null, updated_by: createdBy, created_by: createdBy,
      created_at: convertedAt, updated_at: convertedAt } as Contact;
    const project = projectId ? { id: projectId, client_id: clientId, project_code: projectCode!,
      project_name: `${lead.company_name} - ${lead.service_interested || "Opportunity"}`,
      project_type: lead.service_interested, description: lead.notes, status: "opportunity",
      start_date: null, target_end_date: null, actual_end_date: null, project_value: lead.estimated_value,
      assigned_manager: lead.assigned_to, priority: lead.priority, tags: [], notes: lead.notes,
      objectives: null, scope: null, assumptions: null, dependencies: null, exclusions: null,
      budget: 0, closure_notes: null, client_accepted_at: null, closed_at: null,
      closure_override_reason: null, archived_at: null, archived_by: null, updated_by: createdBy,
      closed_by: null, reopened_at: null, reopened_by: null, reopen_reason: null,
      final_invoice_waived: false, deliverables_accepted: false,
      reimbursable_expenses_processed: false, required_documents_attached: false,
      created_by: createdBy, created_at: convertedAt, updated_at: convertedAt } as Project : null;
    const converted = { ...lead, status: "converted", converted_client_id: clientId,
      converted_contact_id: contactId, converted_project_id: projectId, converted_at: convertedAt,
      updated_by: createdBy, updated_at: convertedAt } as Lead;

    // Construct every record before committing the local-storage batch. No partial
    // record is written if validation or number allocation fails above.
    writeDemoRecords(CLIENT_KEY, [client, ...readDemoRecords<Client>(CLIENT_KEY)]);
    writeDemoRecords(CONTACT_KEY, [contact, ...readDemoRecords<Contact>(CONTACT_KEY)]);
    if (project) writeDemoRecords(PROJECT_KEY, [project, ...readDemoRecords<Project>(PROJECT_KEY)]);
    writeDemoRecords(KEY, readDemoRecords<Lead>(KEY).map((item) => item.id === id ? converted : item));
    clientService.invalidateCache();
    projectService.invalidateCache();
    await historyService.record({ entity_type: "lead", entity_id: id, event_type: "lead_converted",
      previous_value: { status: lead.status }, new_value: { status: "converted" },
      description: "Lead converted to connected business records", actor_id: createdBy,
      metadata: { client_id: clientId, contact_id: contactId, project_id: projectId } });
    return { lead_id: id, client_id: clientId, contact_id: contactId, project_id: projectId };
  },
  async deleteLead(id: string) {
    if (!isSupabaseConfigured) {
      writeDemoRecords(KEY, readDemoRecords<Lead>(KEY).filter((record) => record.id !== id));
      return;
    }

    const { error } = await requireSupabase().from("leads").delete().eq("id", id);
    if (error) throw error;
  }
};
