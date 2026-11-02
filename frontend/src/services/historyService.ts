import { isSupabaseConfigured } from "@/lib/supabase/client";
import { readDemoRecords, requireSupabase, writeDemoRecords } from "@/services/moduleHelpers";
import type { EntityHistory, EntityType } from "@/types/workflow";

const KEY = "business-ops-demo-entity-history";

export const historyService = {
  async list(entityType: EntityType, entityId: string) {
    if (!isSupabaseConfigured) {
      return readDemoRecords<EntityHistory>(KEY)
        .filter((entry) => entry.entity_type === entityType && entry.entity_id === entityId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
    }
    const { data, error } = await requireSupabase().from("entity_history").select("*")
      .eq("entity_type", entityType).eq("entity_id", entityId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as EntityHistory[];
  },
  async record(input: Omit<EntityHistory, "id" | "created_at">) {
    if (!isSupabaseConfigured) {
      const entry = { id: crypto.randomUUID(), ...input, created_at: new Date().toISOString() };
      writeDemoRecords(KEY, [entry, ...readDemoRecords<EntityHistory>(KEY)]);
      return entry;
    }
    const { data, error } = await requireSupabase().from("entity_history").insert(input).select().single();
    if (error) throw error;
    return data as EntityHistory;
  }
};

