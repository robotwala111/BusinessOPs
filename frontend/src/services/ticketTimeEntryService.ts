import { isSupabaseConfigured } from "@/lib/supabase/client";
import { readDemoRecords, requireSupabase, writeDemoRecords } from "@/services/moduleHelpers";
import type { TicketTimeEntry } from "@/types/ticketTimeEntry";

const KEY = "business-ops-demo-ticket-time-entries";

export const ticketTimeEntryService = {
  async list(ticketId: string) {
    if (!isSupabaseConfigured) return readDemoRecords<TicketTimeEntry>(KEY).filter((item) => item.ticket_id === ticketId);
    const { data, error } = await requireSupabase().from("ticket_time_entries").select("*").eq("ticket_id", ticketId).order("entry_date");
    if (error) throw error;
    return (data ?? []) as TicketTimeEntry[];
  },
  async add(input: Omit<TicketTimeEntry, "id" | "created_at">) {
    if (!(input.hours > 0)) throw new Error("Time entry hours must be greater than zero.");
    if (!isSupabaseConfigured) {
      const record = { id: crypto.randomUUID(), ...input, created_at: new Date().toISOString() };
      writeDemoRecords(KEY, [record, ...readDemoRecords<TicketTimeEntry>(KEY)]);
      return record;
    }
    const { data, error } = await requireSupabase().from("ticket_time_entries").insert(input).select().single();
    if (error) throw error;
    return data as TicketTimeEntry;
  }
};

