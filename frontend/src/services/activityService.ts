import { isSupabaseConfigured } from "@/lib/supabase/client";
import { clientService } from "@/services/clientService";
import { contactService } from "@/services/contactService";
import { normalizeText, readDemoRecords, requireSupabase, writeDemoRecords } from "@/services/moduleHelpers";
import { projectService } from "@/services/projectService";
import type { Activity, ActivityCreateInput, ActivityFormData, ActivityUpdateInput } from "@/types/activity";
import type { Client } from "@/types/client";
import type { Contact } from "@/types/contact";
import type { Project } from "@/types/project";

const KEY = "business-ops-demo-activities";

function normalizeUuid(value?: string | null) {
  return value && value.trim() ? value.trim() : null;
}

function normalize(data: Partial<ActivityFormData>) {
  return {
    ...("client_id" in data ? { client_id: data.client_id } : {}),
    ...("contact_id" in data ? { contact_id: normalizeUuid(data.contact_id) } : {}),
    ...("project_id" in data ? { project_id: normalizeUuid(data.project_id) } : {}),
    ...("activity_type" in data ? { activity_type: data.activity_type } : {}),
    ...("subject" in data ? { subject: data.subject?.trim() } : {}),
    ...("description" in data ? { description: normalizeText(data.description) } : {}),
    ...("activity_date" in data ? { activity_date: data.activity_date } : {}),
    ...("due_date" in data ? { due_date: data.due_date || null } : {}),
    ...("status" in data ? { status: data.status } : {}),
    ...("priority" in data ? { priority: data.priority } : {}),
    ...("assigned_to" in data ? { assigned_to: normalizeUuid(data.assigned_to) } : {}),
    ...("completed_at" in data ? { completed_at: data.completed_at || null } : {})
  };
}

function sortActivities(records: Activity[]) {
  return [...records].sort((a, b) => b.activity_date.localeCompare(a.activity_date));
}

async function attachRelations(records: Activity[]) {
  if (records.length === 0) return records;

  const [clients, contacts, projects] = await Promise.all([
    clientService.getClients(),
    contactService.getContacts(),
    projectService.getProjects()
  ]);
  const clientsById = new Map(clients.map((client) => [client.id, client]));
  const contactsById = new Map(contacts.map((contact) => [contact.id, contact]));
  const projectsById = new Map(projects.map((project) => [project.id, project]));

  return records.map((record) => ({
    ...record,
    client: clientsById.get(record.client_id) ?? null,
    contact: record.contact_id ? contactsById.get(record.contact_id) ?? null : null,
    project: record.project_id ? projectsById.get(record.project_id) ?? null : null
  }));
}

export const activityService = {
  async getActivities() {
    if (!isSupabaseConfigured) {
      return attachRelations(sortActivities(readDemoRecords<Activity>(KEY)));
    }

    const { data, error } = await requireSupabase()
      .from("activities")
      .select("*, clients(*), contacts(*), projects(*)")
      .order("activity_date", { ascending: false });

    if (error) throw error;
    return (data ?? []).map((record) => ({
      ...record,
      client: record.clients as Client,
      contact: record.contacts as Contact | null,
      project: record.projects as Project | null
    })) as Activity[];
  },
  async getActivitiesByClient(clientId: string, limit?: number) {
    if (!clientId) return [];

    if (!isSupabaseConfigured) {
      const records = sortActivities(
        readDemoRecords<Activity>(KEY).filter((record) => record.client_id === clientId)
      );
      return attachRelations(typeof limit === "number" ? records.slice(0, limit) : records);
    }

    let query = requireSupabase()
      .from("activities")
      .select("*, clients(*), contacts(*), projects(*)")
      .eq("client_id", clientId)
      .order("activity_date", { ascending: false });

    if (typeof limit === "number") {
      query = query.limit(limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((record) => ({
      ...record,
      client: record.clients as Client,
      contact: record.contacts as Contact | null,
      project: record.projects as Project | null
    })) as Activity[];
  },
  async createActivity(data: ActivityCreateInput) {
    const payload = { ...normalize(data), created_by: data.created_by };

    if (!isSupabaseConfigured) {
      const now = new Date().toISOString();
      const record = { id: crypto.randomUUID(), ...payload, created_at: now, updated_at: now } as Activity;
      writeDemoRecords(KEY, [record, ...readDemoRecords<Activity>(KEY)]);
      return record;
    }

    const { data: record, error } = await requireSupabase()
      .from("activities")
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return record as Activity;
  },
  async updateActivity(id: string, data: ActivityUpdateInput) {
    const payload = normalize(data);

    if (!isSupabaseConfigured) {
      const records = readDemoRecords<Activity>(KEY);
      const updated = records.map((record) =>
        record.id === id ? { ...record, ...payload, updated_at: new Date().toISOString() } as Activity : record
      );
      writeDemoRecords(KEY, updated);
      return updated.find((record) => record.id === id) ?? null;
    }

    const { data: record, error } = await requireSupabase()
      .from("activities")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return record as Activity;
  },
  async deleteActivity(id: string) {
    if (!isSupabaseConfigured) {
      writeDemoRecords(KEY, readDemoRecords<Activity>(KEY).filter((record) => record.id !== id));
      return;
    }

    const { error } = await requireSupabase().from("activities").delete().eq("id", id);
    if (error) throw error;
  }
};
