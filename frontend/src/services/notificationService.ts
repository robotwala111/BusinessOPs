import { isSupabaseConfigured } from "@/lib/supabase/client";
import { readDemoRecords, requireSupabase, writeDemoRecords } from "@/services/moduleHelpers";
import type { Notification } from "@/types/workflow";

const KEY = "business-ops-demo-notifications";

export const notificationService = {
  async listUnread(userId: string | null) {
    if (!isSupabaseConfigured) return readDemoRecords<Notification>(KEY)
      .filter((item) => !item.read_at && !item.dismissed_at && (!item.recipient_id || item.recipient_id === userId));
    let query = requireSupabase().from("notifications").select("*").is("read_at", null).is("dismissed_at", null);
    if (userId) query = query.or(`recipient_id.is.null,recipient_id.eq.${userId}`);
    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Notification[];
  },
  async markRead(id: string) {
    const readAt = new Date().toISOString();
    if (!isSupabaseConfigured) {
      writeDemoRecords(KEY, readDemoRecords<Notification>(KEY).map((item) => item.id === id ? { ...item, read_at: readAt } : item));
      return;
    }
    const { error } = await requireSupabase().from("notifications").update({ read_at: readAt }).eq("id", id);
    if (error) throw error;
  },
  async markAllRead(userId: string | null) {
    const readAt = new Date().toISOString();
    if (!isSupabaseConfigured) { writeDemoRecords(KEY, readDemoRecords<Notification>(KEY).map((item) => !item.read_at && (!item.recipient_id || item.recipient_id === userId) ? { ...item, read_at: readAt } : item)); return; }
    let query=requireSupabase().from("notifications").update({read_at:readAt}).is("read_at",null);if(userId)query=query.or(`recipient_id.is.null,recipient_id.eq.${userId}`);const{error}=await query;if(error)throw error;
  }
};
