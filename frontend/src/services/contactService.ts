import { isSupabaseConfigured } from "@/lib/supabase/client";
import { clientService } from "@/services/clientService";
import { normalizeText, readDemoRecords, requireSupabase, writeDemoRecords } from "@/services/moduleHelpers";
import type { Client } from "@/types/client";
import type { Contact, ContactCreateInput, ContactFormData, ContactUpdateInput } from "@/types/contact";

const KEY = "business-ops-demo-contacts";

function normalize(data: Partial<ContactFormData>) {
  return {
    ...("client_id" in data ? { client_id: data.client_id } : {}),
    ...("full_name" in data ? { full_name: data.full_name?.trim() } : {}),
    ...("designation" in data ? { designation: normalizeText(data.designation) } : {}),
    ...("email" in data ? { email: normalizeText(data.email) } : {}),
    ...("phone" in data ? { phone: normalizeText(data.phone) } : {}),
    ...("whatsapp" in data ? { whatsapp: normalizeText(data.whatsapp) } : {}),
    ...("department" in data ? { department: normalizeText(data.department) } : {}),
    ...("is_primary" in data ? { is_primary: Boolean(data.is_primary) } : {}),
    ...("notes" in data ? { notes: normalizeText(data.notes) } : {})
  };
}

async function attachClients(records: Contact[]) {
  if (records.length === 0) return records;
  const clients = await clientService.getClients();
  const clientsById = new Map(clients.map((client) => [client.id, client]));
  return records.map((record) => ({ ...record, client: clientsById.get(record.client_id) ?? null }));
}

function sortContacts(records: Contact[]) {
  return [...records].sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
    return a.full_name.localeCompare(b.full_name);
  });
}

export const contactService = {
  async getContacts() {
    if (!isSupabaseConfigured) {
      return attachClients(sortContacts(readDemoRecords<Contact>(KEY)));
    }

    const { data, error } = await requireSupabase()
      .from("contacts")
      .select("*, clients(*)")
      .order("is_primary", { ascending: false })
      .order("full_name", { ascending: true });

    if (error) throw error;
    return (data ?? []).map((record) => ({ ...record, client: record.clients as Client })) as Contact[];
  },
  async getContactsByClient(clientId: string) {
    if (!clientId) return [];

    if (!isSupabaseConfigured) {
      return attachClients(sortContacts(readDemoRecords<Contact>(KEY).filter((record) => record.client_id === clientId)));
    }

    const { data, error } = await requireSupabase()
      .from("contacts")
      .select("*, clients(*)")
      .eq("client_id", clientId)
      .order("is_primary", { ascending: false })
      .order("full_name", { ascending: true });

    if (error) throw error;
    return (data ?? []).map((record) => ({ ...record, client: record.clients as Client })) as Contact[];
  },
  async createContact(data: ContactCreateInput) {
    const payload = { ...normalize(data), created_by: data.created_by };

    if (!isSupabaseConfigured) {
      const now = new Date().toISOString();
      const records = readDemoRecords<Contact>(KEY);
      const record = { id: crypto.randomUUID(), ...payload, created_at: now, updated_at: now } as Contact;
      const nextRecords = data.is_primary
        ? records.map((item) => item.client_id === data.client_id ? { ...item, is_primary: false } : item)
        : records;
      writeDemoRecords(KEY, [record, ...nextRecords]);
      return record;
    }

    if (data.is_primary) {
      await this.clearPrimaryContact(data.client_id);
    }

    const { data: record, error } = await requireSupabase()
      .from("contacts")
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return record as Contact;
  },
  async updateContact(id: string, data: ContactUpdateInput) {
    const payload = normalize(data);

    if (!isSupabaseConfigured) {
      const records = readDemoRecords<Contact>(KEY);
      const existing = records.find((record) => record.id === id);
      const clientId = data.client_id ?? existing?.client_id;
      const updated = records.map((record) => {
        if (record.id === id) {
          return { ...record, ...payload, updated_at: new Date().toISOString() } as Contact;
        }
        if (data.is_primary && clientId && record.client_id === clientId) {
          return { ...record, is_primary: false };
        }
        return record;
      });
      writeDemoRecords(KEY, updated);
      return updated.find((record) => record.id === id) ?? null;
    }

    if (data.is_primary) {
      const current = await requireSupabase().from("contacts").select("client_id").eq("id", id).single();
      if (current.error) throw current.error;
      await this.clearPrimaryContact(data.client_id ?? current.data.client_id);
    }

    const { data: record, error } = await requireSupabase()
      .from("contacts")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return record as Contact;
  },
  async deleteContact(id: string) {
    if (!isSupabaseConfigured) {
      writeDemoRecords(KEY, readDemoRecords<Contact>(KEY).filter((record) => record.id !== id));
      return;
    }

    const { error } = await requireSupabase().from("contacts").delete().eq("id", id);
    if (error) throw error;
  },
  async clearPrimaryContact(clientId: string) {
    if (!clientId) return;

    if (!isSupabaseConfigured) {
      writeDemoRecords(
        KEY,
        readDemoRecords<Contact>(KEY).map((record) =>
          record.client_id === clientId ? { ...record, is_primary: false } : record
        )
      );
      return;
    }

    const { error } = await requireSupabase()
      .from("contacts")
      .update({ is_primary: false })
      .eq("client_id", clientId);

    if (error) throw error;
  }
};
