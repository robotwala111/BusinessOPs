import { isSupabaseConfigured } from "@/lib/supabase/client";
import { readDemoRecords, requireSupabase, writeDemoRecords } from "@/services/moduleHelpers";
import type { ContractVersion } from "@/types/contractVersion";

const KEY = "business-ops-demo-contract-versions";

export const contractVersionService = {
  async list(contractId: string) {
    if (!isSupabaseConfigured) return readDemoRecords<ContractVersion>(KEY)
      .filter((item) => item.contract_id === contractId)
      .sort((a, b) => b.version_number - a.version_number);
    const { data, error } = await requireSupabase().from("contract_versions").select("*")
      .eq("contract_id", contractId).order("version_number", { ascending: false });
    if (error) throw error;
    return (data ?? []) as ContractVersion[];
  },
  async create(input: Omit<ContractVersion, "id" | "created_at" | "version_number">) {
    const versions = await this.list(input.contract_id);
    const payload = { ...input, version_number: (versions[0]?.version_number ?? 0) + 1 };
    if (!isSupabaseConfigured) {
      const record = { id: crypto.randomUUID(), ...payload, created_at: new Date().toISOString() };
      writeDemoRecords(KEY, [record, ...readDemoRecords<ContractVersion>(KEY)]);
      return record;
    }
    const { data, error } = await requireSupabase().from("contract_versions").insert(payload).select().single();
    if (error) throw error;
    return data as ContractVersion;
  }
};

