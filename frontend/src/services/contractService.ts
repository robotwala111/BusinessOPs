import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { Contract, ContractCreateInput, ContractFormData, ContractUpdateInput } from "@/types/contract";
import { generateNumber, normalizeText, readDemoRecords, requireSupabase, toNumber, writeDemoRecords } from "@/services/moduleHelpers";
import { settingsService } from "@/services/settingsService";
import { historyService } from "@/services/historyService";
import { contractVersionService } from "@/services/contractVersionService";
import { assertTransition } from "@/lib/workflowRules";

const KEY = "business-ops-demo-contracts";

function normalize(data: ContractFormData) {
  return {
    contract_number: data.contract_number.trim(),
    client_id: data.client_id,
    project_id: data.project_id || null,
    quotation_id: data.quotation_id || null,
    contract_type: data.contract_type,
    title: data.title.trim(),
    start_date: data.start_date || null,
    end_date: data.end_date || null,
    status: data.status,
    contract_value: toNumber(data.contract_value),
    renewal_required: data.renewal_required,
    renewal_date: data.renewal_date || null,
    content: normalizeText(data.content),
    terms_and_conditions: normalizeText(data.terms_and_conditions),
    signed_file_url: normalizeText(data.signed_file_url)
    ,billing_schedule: normalizeText(data.billing_schedule),
    scope: normalizeText(data.scope), deliverables: normalizeText(data.deliverables)
  };
}

export const contractService = {
  generateContractNumber() {
    return settingsService
      .getNumberingPrefix("contract", "CON")
      .then((prefix) => generateNumber("contracts", "contract_number", KEY, prefix));
  },
  async getContracts() {
    if (!isSupabaseConfigured) {
      return readDemoRecords<Contract>(KEY).sort((a, b) => b.created_at.localeCompare(a.created_at));
    }
    const { data, error } = await requireSupabase().from("contracts").select("*, clients(*)").order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((contract) => ({ ...contract, client: contract.clients })) as Contract[];
  },
  async getContractById(id: string) {
    if (!isSupabaseConfigured) return readDemoRecords<Contract>(KEY).find((item) => item.id === id) ?? null;
    const { data, error } = await requireSupabase().from("contracts").select("*, clients(*), projects(*), quotations(*)").eq("id", id).single();
    if (error) throw error;
    return { ...data, client: data.clients, project: data.projects, quotation: data.quotations } as Contract;
  },
  async createContract(data: ContractCreateInput) {
    const payload = { ...normalize(data), created_by: data.created_by };
    if (!isSupabaseConfigured) {
      const now = new Date().toISOString();
      const record = { id: crypto.randomUUID(), ...payload, approved_at: null, sent_for_signature_at: null,
        signed_at: null, termination_reason: null, notice_period_days: null, renewal_period_months: null,
        archived_at: null, updated_by: data.created_by, created_at: now, updated_at: now } as Contract;
      writeDemoRecords(KEY, [record, ...readDemoRecords<Contract>(KEY)]);
      return record;
    }
    const { data: record, error } = await requireSupabase().from("contracts").insert(payload).select().single();
    if (error) throw error;
    return record as Contract;
  },
  async transitionContract(id: string, status: Contract["status"], userId: string | null, reason = "") {
    const existing = await this.getContractById(id);
    if (!existing) throw new Error("Contract not found.");
    assertTransition("contract", existing.status, status);
    if (status === "terminated" && !reason.trim()) throw new Error("Termination reason is required.");
    const now = new Date().toISOString();
    const changes = { status, updated_by: userId,
      ...(status === "approved" ? { approved_at: now } : {}),
      ...(status === "sent_for_signature" ? { sent_for_signature_at: now } : {}),
      ...(status === "terminated" ? { termination_reason: reason.trim() } : {}),
      ...(status === "archived" ? { archived_at: now } : {}) };
    let result: Contract;
    if (!isSupabaseConfigured) {
      result = { ...existing, ...changes, updated_at: now };
      writeDemoRecords(KEY, readDemoRecords<Contract>(KEY).map((item) => item.id === id ? result : item));
    } else {
      const { data, error } = await requireSupabase().from("contracts").update(changes).eq("id", id).eq("status", existing.status).select().single();
      if (error) throw error; result = { ...existing, ...data } as Contract;
    }
    await historyService.record({ entity_type: "contract", entity_id: id, event_type: "status_changed",
      previous_value: { status: existing.status }, new_value: { status }, description: `Contract moved from ${existing.status} to ${status}${reason ? `: ${reason}` : ""}`,
      actor_id: userId, metadata: {} });
    return result;
  },
  async uploadContractVersion(contract: Contract, file: File, userId: string | null) {
    const versions = await contractVersionService.list(contract.id);
    const version = (versions[0]?.version_number ?? 0) + 1;
    let filePath: string;
    if (!isSupabaseConfigured) {
      filePath = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
    } else {
      filePath = `${contract.id}/v${version}-${crypto.randomUUID()}-${file.name}`;
      const { error } = await requireSupabase().storage.from("signed-contracts").upload(filePath, file, { upsert: false });
      if (error) throw error;
    }
    const record = await contractVersionService.create({ contract_id: contract.id, content: contract.content,
      terms_and_conditions: contract.terms_and_conditions, file_path: filePath, file_name: file.name,
      file_size: file.size, mime_type: file.type, signed_at: new Date().toISOString(), created_by: userId });
    const now = new Date().toISOString();
    const changes = { signed_file_url: filePath, signed_at: now, updated_by: userId };
    if (!isSupabaseConfigured) writeDemoRecords(KEY, readDemoRecords<Contract>(KEY).map((item) => item.id === contract.id ? { ...item, ...changes, updated_at: now } : item));
    else { const { error } = await requireSupabase().from("contracts").update(changes).eq("id", contract.id); if (error) throw error; }
    await historyService.record({ entity_type: "contract", entity_id: contract.id, event_type: "signed_version_uploaded",
      previous_value: null, new_value: { version_number: record.version_number }, description: `Signed contract version ${record.version_number} uploaded`,
      actor_id: userId, metadata: { version_id: record.id, file_name: file.name } });
    return record;
  },
  async updateContract(id: string, data: ContractUpdateInput) {
    if (!isSupabaseConfigured) {
      const records = readDemoRecords<Contract>(KEY);
      const updated = records.map((record) => record.id === id ? { ...record, ...data, updated_at: new Date().toISOString() } as Contract : record);
      writeDemoRecords(KEY, updated);
      return updated.find((record) => record.id === id) ?? null;
    }
    const { data: record, error } = await requireSupabase().from("contracts").update({ ...data, updated_at: new Date().toISOString() }).eq("id", id).select().single();
    if (error) throw error;
    return record as Contract;
  },
  async deleteContract(id: string) {
    if (!isSupabaseConfigured) {
      writeDemoRecords(KEY, readDemoRecords<Contract>(KEY).filter((record) => record.id !== id));
      return;
    }
    const { error } = await requireSupabase().from("contracts").delete().eq("id", id);
    if (error) throw error;
  },
  async uploadSignedFile(file: File) {
    if (!isSupabaseConfigured) {
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }
    const path = `${crypto.randomUUID()}-${file.name}`;
    const { error } = await requireSupabase().storage.from("signed-contracts").upload(path, file, { upsert: true });
    if (error) throw error;
    const { data, error: signedError } = await requireSupabase().storage.from("signed-contracts").createSignedUrl(path, 60 * 60 * 24 * 7);
    if (signedError) throw signedError;
    return data.signedUrl;
  }
};
