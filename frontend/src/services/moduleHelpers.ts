import { isDemoMode, isSupabaseConfigured, supabase } from "@/lib/supabase/client";

export function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase environment variables are not configured.");
  }

  return supabase;
}

export function normalizeText(value?: string | null) {
  return value && value.trim() ? value.trim() : null;
}

export function toNumber(value?: number | null) {
  return Number.isFinite(value ?? 0) ? Number(value ?? 0) : 0;
}

export function readDemoRecords<T>(key: string): T[] {
  if (!isDemoMode()) {
    throw new Error("Demo persistence is disabled. Configure Supabase to use the application.");
  }

  if (typeof window === "undefined") {
    return [];
  }

  const stored = window.localStorage.getItem(key);
  return stored ? (JSON.parse(stored) as T[]) : [];
}

export function writeDemoRecords<T>(key: string, records: T[]) {
  if (!isDemoMode()) {
    throw new Error("Demo persistence is disabled. Configure Supabase to use the application.");
  }

  window.localStorage.setItem(key, JSON.stringify(records));
}

export async function generateNumber(
  table: string,
  column: string,
  demoKey: string,
  prefix: string,
  documentType = table === "support_tickets" ? "support_ticket" : table.replace(/s$/, "")
) {
  const yearPrefix = `${prefix}-${new Date().getFullYear()}-`;

  if (isDemoMode()) {
    const latest = readDemoRecords<Record<string, string>>(demoKey)
      .map((record) => record[column])
      .filter((number) => number?.startsWith(yearPrefix))
      .sort()
      .at(-1);
    const next = latest ? Number(latest.slice(-4)) + 1 : 1;
    return `${yearPrefix}${String(next).padStart(4, "0")}`;
  }

  const { data, error } = await requireSupabase().rpc("next_document_number", {
    p_document_type: documentType
  });

  if (error) {
    throw error;
  }

  return String(data);
}

export function supabaseConfigured() {
  return isSupabaseConfigured;
}
