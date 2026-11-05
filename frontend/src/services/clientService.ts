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

async function localRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const result = await response.json().catch(() => null);
    throw new Error(result?.error ?? `Local PostgreSQL request failed (${response.status}).`);
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
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

    clientsCache = await localRequest<Client[]>("/api/clients");
    if (clientsCache.length === 0) {
      const legacyClients = readDemoClients();
      if (legacyClients.length) {
        await localRequest("/api/clients/import-demo", {
          method: "POST",
          body: JSON.stringify(legacyClients),
        });
        clientsCache = await localRequest<Client[]>("/api/clients");
        window.localStorage.removeItem(DEMO_CLIENTS_STORAGE_KEY);
      }
    }
    return clientsCache;
  },

  async getClientById(id: string) {
    return localRequest<Client>(`/api/clients/${encodeURIComponent(id)}`);
  },

  async createClient(data: ClientCreateInput) {
    const payload = normalizeClientPayload(data);

    const createdClient = await localRequest<Client>("/api/clients", { method: "POST", body: JSON.stringify(payload) });
    clearClientCache();
    return createdClient;
  },

  async updateClient(id: string, data: ClientUpdateInput) {
    const payload = normalizeClientPayload(data);

    const updatedClient = await localRequest<Client>(`/api/clients/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) });
    clearClientCache();
    return updatedClient;
  },

  async deleteClient(id: string) {
    await localRequest<void>(`/api/clients/${encodeURIComponent(id)}`, { method: "DELETE" });
    clearClientCache();
  }
  ,
  async archiveClient(id: string, userId: string | null) {
    const archivedAt = new Date().toISOString();
    await localRequest<Client>(`/api/clients/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ status: "archived", archived_at: archivedAt, archived_by: userId, updated_by: userId }) });
    clearClientCache();
    await historyService.record({ entity_type: "client", entity_id: id, event_type: "archived",
      previous_value: null, new_value: { status: "archived" }, description: "Client archived",
      actor_id: userId, metadata: {} });
  }
};
