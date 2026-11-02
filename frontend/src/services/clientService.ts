import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import type {
  Client,
  ClientCreateInput,
  ClientFormData,
  ClientUpdateInput
} from "@/types/client";
import { historyService } from "@/services/historyService";

const DEMO_CLIENTS_STORAGE_KEY = "business-ops-demo-clients";
let clientsCache: Client[] | null = null;

function clearClientCache() {
  clientsCache = null;
}

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase environment variables are not configured.");
  }

  return supabase;
}

function normalizeClientPayload<T extends Partial<ClientFormData>>(data: T) {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      typeof value === "string" && value.trim() === "" ? null : value
    ])
  );
}

function readDemoClients(): Client[] {
  if (typeof window === "undefined") {
    return [];
  }

  const storedClients = window.localStorage.getItem(DEMO_CLIENTS_STORAGE_KEY);
  return storedClients ? (JSON.parse(storedClients) as Client[]) : [];
}

function writeDemoClients(clients: Client[]) {
  window.localStorage.setItem(DEMO_CLIENTS_STORAGE_KEY, JSON.stringify(clients));
}

export const clientService = {
  invalidateCache() {
    clearClientCache();
  },
  async getClients() {
    if (clientsCache) {
      return clientsCache;
    }

    if (!isSupabaseConfigured) {
      clientsCache = readDemoClients().sort((a, b) =>
        b.created_at.localeCompare(a.created_at)
      );
      return clientsCache;
    }

    const { data, error } = await requireSupabase()
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    clientsCache = data as Client[];
    return clientsCache;
  },

  async getClientById(id: string) {
    if (!isSupabaseConfigured) {
      return readDemoClients().find((client) => client.id === id) ?? null;
    }

    const { data, error } = await requireSupabase()
      .from("clients")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      throw error;
    }

    return data as Client;
  },

  async createClient(data: ClientCreateInput) {
    const payload = normalizeClientPayload(data);

    if (!isSupabaseConfigured) {
      const now = new Date().toISOString();
      const client: Client = {
        id: crypto.randomUUID(),
        company_name: data.company_name.trim(),
        client_short_name: data.client_short_name || null,
        contact_person: data.contact_person || null,
        email: data.email || null,
        phone: data.phone || null,
        gst_number: data.gst_number || null,
        pan_number: data.pan_number || null,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        country: data.country || "India",
        industry: data.industry || null,
        lead_source: data.lead_source || null,
        status: data.status,
        notes: data.notes || null,
        account_owner: data.account_owner || null,
        payment_terms: data.payment_terms || null,
        archived_at: null,
        archived_by: null,
        updated_by: data.created_by,
        created_by: data.created_by,
        created_at: now,
        updated_at: now
      };

      writeDemoClients([client, ...readDemoClients()]);
      clearClientCache();
      return client;
    }

    const { data: createdClient, error } = await requireSupabase()
      .from("clients")
      .insert(payload)
      .select()
      .single();

    if (error) {
      throw error;
    }

    clearClientCache();
    return createdClient as Client;
  },

  async updateClient(id: string, data: ClientUpdateInput) {
    const payload = normalizeClientPayload(data);

    if (!isSupabaseConfigured) {
      const clients = readDemoClients();
      const updatedClients = clients.map((client) =>
        client.id === id
          ? {
              ...client,
              ...payload,
              updated_at: new Date().toISOString()
            }
          : client
      ) as Client[];
      const updatedClient =
        updatedClients.find((client) => client.id === id) ?? null;

      writeDemoClients(updatedClients);
      clearClientCache();
      return updatedClient;
    }

    const { data: updatedClient, error } = await requireSupabase()
      .from("clients")
      .update({
        ...payload,
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    clearClientCache();
    return updatedClient as Client;
  },

  async deleteClient(id: string) {
    if (!isSupabaseConfigured) {
      writeDemoClients(readDemoClients().filter((client) => client.id !== id));
      clearClientCache();
      return;
    }

    const { error } = await requireSupabase()
      .from("clients")
      .delete()
      .eq("id", id);

    if (error) {
      throw error;
    }

    clearClientCache();
  }
  ,
  async archiveClient(id: string, userId: string | null) {
    const archivedAt = new Date().toISOString();
    if (!isSupabaseConfigured) {
      const existing = readDemoClients().find((item) => item.id === id);
      if (!existing) throw new Error("Client not found.");
      writeDemoClients(readDemoClients().map((item) => item.id === id
        ? { ...item, status: "archived", archived_at: archivedAt, archived_by: userId,
            updated_by: userId, updated_at: archivedAt }
        : item));
      clearClientCache();
    } else {
      const { error } = await requireSupabase().from("clients").update({ status: "archived",
        archived_at: archivedAt, archived_by: userId, updated_by: userId }).eq("id", id);
      if (error) throw error;
    }
    await historyService.record({ entity_type: "client", entity_id: id, event_type: "archived",
      previous_value: null, new_value: { status: "archived" }, description: "Client archived",
      actor_id: userId, metadata: {} });
  }
};
