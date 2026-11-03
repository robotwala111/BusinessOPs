import { isSupabaseConfigured } from "@/lib/supabase/client";
import { generateNumber, normalizeText, readDemoRecords, requireSupabase, toNumber, writeDemoRecords } from "@/services/moduleHelpers";
import { settingsService } from "@/services/settingsService";
import type { MaintenanceContract, MaintenanceContractFormData, SupportTicket, SupportTicketFormData } from "@/types/maintenance";
import { historyService } from "@/services/historyService";
import { assertTransition } from "@/lib/workflowRules";
import { ticketTimeEntryService } from "@/services/ticketTimeEntryService";
import { calculateMaintenanceHours, calculateSlaDeadline } from "@/lib/businessCalculations";

const MAINT_KEY = "business-ops-demo-maintenance-contracts";
const TICKET_KEY = "business-ops-demo-support-tickets";

export const maintenanceService = {
  generateTicketNumber() {
    return settingsService
      .getNumberingPrefix("support_ticket", "TKT")
      .then((prefix) => generateNumber("support_tickets", "ticket_number", TICKET_KEY, prefix));
  },
  async getMaintenanceContracts() {
    if (!isSupabaseConfigured) return readDemoRecords<MaintenanceContract>(MAINT_KEY).sort((a, b) => b.created_at.localeCompare(a.created_at));
    const { data, error } = await requireSupabase().from("maintenance_contracts").select("*, clients(*)").order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((record) => ({ ...record, client: record.clients })) as MaintenanceContract[];
  },
  async getMaintenanceById(id: string) { return (await this.getMaintenanceContracts()).find(item=>item.id===id)??null; },
  async getTicketById(id:string){return(await this.getSupportTickets()).find(item=>item.id===id)??null;},
  async maintenanceHours(id:string){const tickets=(await this.getSupportTickets()).filter(t=>t.maintenance_contract_id===id);const entries=(await Promise.all(tickets.map(t=>ticketTimeEntryService.list(t.id)))).flat();const agreement=await this.getMaintenanceById(id);return calculateMaintenanceHours(agreement?.included_hours??0,entries.filter(e=>e.eligible_for_maintenance).reduce((s,e)=>s+e.hours,0));},
  async saveMaintenanceContract(data: MaintenanceContractFormData & { id?: string; created_by: string | null }) {
    const payload = {
      client_id: data.client_id,
      project_id: data.project_id || null,
      contract_id: data.contract_id || null,
      plan_name: data.plan_name.trim(),
      start_date: data.start_date || null,
      end_date: data.end_date || null,
      monthly_fee: toNumber(data.monthly_fee),
      yearly_fee: toNumber(data.yearly_fee),
      included_hours: toNumber(data.included_hours),
      response_sla_hours: data.response_sla_hours != null ? toNumber(data.response_sla_hours) : null,
      resolution_sla_hours: data.resolution_sla_hours != null ? toNumber(data.resolution_sla_hours) : null,
      status: data.status,
      renewal_date: data.renewal_date || null,
      notes: normalizeText(data.notes),
      created_by: data.created_by
    };
    if (!isSupabaseConfigured) {
      const now = new Date().toISOString();
      const records = readDemoRecords<MaintenanceContract>(MAINT_KEY);
      const record = { id: data.id || crypto.randomUUID(), ...payload, created_at: now, updated_at: now } as MaintenanceContract;
      writeDemoRecords(MAINT_KEY, data.id ? records.map((item) => item.id === data.id ? record : item) : [record, ...records]);
      return record;
    }
    const query = data.id
      ? requireSupabase().from("maintenance_contracts").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", data.id)
      : requireSupabase().from("maintenance_contracts").insert(payload);
    const { data: record, error } = await query.select().single();
    if (error) throw error;
    return record as MaintenanceContract;
  },
  async getSupportTickets() {
    if (!isSupabaseConfigured) return readDemoRecords<SupportTicket>(TICKET_KEY).sort((a, b) => b.created_at.localeCompare(a.created_at));
    const { data, error } = await requireSupabase().from("support_tickets").select("*, clients(*)").order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((record) => ({ ...record, client: record.clients })) as SupportTicket[];
  },
  async saveSupportTicket(data: SupportTicketFormData & { id?: string; created_by: string | null }) {
    const payload = {
      ticket_number: data.ticket_number.trim(),
      client_id: data.client_id,
      project_id: data.project_id || null,
      maintenance_contract_id: data.maintenance_contract_id || null,
      title: data.title.trim(),
      description: normalizeText(data.description),
      priority: data.priority,
      status: data.status,
      assigned_to: data.assigned_to || null,
      resolution_notes: normalizeText(data.resolution_notes),
      closed_at: ["resolved", "closed"].includes(data.status) ? new Date().toISOString() : null,
      created_by: data.created_by,
      response_deadline: data.id ? undefined : calculateSlaDeadline(new Date(), 4),
      resolution_deadline: data.id ? undefined : calculateSlaDeadline(new Date(), 24)
    };
    if (!isSupabaseConfigured) {
      const now = new Date().toISOString();
      const records = readDemoRecords<SupportTicket>(TICKET_KEY);
      const record = { id: data.id || crypto.randomUUID(), ...payload, opened_at: now, created_at: now, updated_at: now } as SupportTicket;
      writeDemoRecords(TICKET_KEY, data.id ? records.map((item) => item.id === data.id ? record : item) : [record, ...records]);
      return record;
    }
    const query = data.id
      ? requireSupabase().from("support_tickets").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", data.id)
      : requireSupabase().from("support_tickets").insert(payload);
    const { data: record, error } = await query.select().single();
    if (error) throw error;
    return record as SupportTicket;
  },
  async transitionTicket(ticket:SupportTicket,status:SupportTicket["status"],userId:string|null,reason="") {assertTransition("ticket",ticket.status,status);if(status==="reopened"&&!reason.trim())throw new Error("Reopening reason is required.");const now=new Date().toISOString();const changes={status,updated_by:userId,...(status==="in_progress"&&!ticket.first_responded_at?{first_responded_at:now}:{}),...(status==="resolved"?{resolved_at:now}:{}),...(status==="closed"?{closed_at:now}:{}),...(status==="reopened"?{reopening_reason:reason.trim(),closed_at:null,resolved_at:null}:{}),updated_at:now};if(!isSupabaseConfigured)writeDemoRecords(TICKET_KEY,readDemoRecords<SupportTicket>(TICKET_KEY).map(t=>t.id===ticket.id?{...t,...changes}:t));else{const{error}=await requireSupabase().from("support_tickets").update(changes).eq("id",ticket.id).eq("status",ticket.status);if(error)throw error;}await historyService.record({entity_type:"ticket",entity_id:ticket.id,event_type:"status_changed",previous_value:{status:ticket.status},new_value:{status},description:`Ticket moved to ${status}${reason?`: ${reason}`:""}`,actor_id:userId,metadata:{maintenance_contract_id:ticket.maintenance_contract_id}});},
  async renewMaintenance(source:MaintenanceContract,userId:string|null){if(source.status==="renewed")throw new Error("Agreement already renewed.");const existing=(await this.getMaintenanceContracts()).find(m=>m.renewed_from_id===source.id);if(existing)return existing;const start=source.end_date??new Date().toISOString().slice(0,10);const end=new Date(start);end.setFullYear(end.getFullYear()+1);const next=await this.saveMaintenanceContract({client_id:source.client_id,project_id:source.project_id??"",contract_id:source.contract_id??"",plan_name:source.plan_name,start_date:start,end_date:end.toISOString().slice(0,10),monthly_fee:source.monthly_fee,yearly_fee:source.yearly_fee,included_hours:source.included_hours,status:"draft",renewal_date:end.toISOString().slice(0,10),notes:source.notes??"",created_by:userId});if(!isSupabaseConfigured){const records=readDemoRecords<MaintenanceContract>(MAINT_KEY);writeDemoRecords(MAINT_KEY,records.map(m=>m.id===next.id?{...m,renewed_from_id:source.id}:m.id===source.id?{...m,status:"renewed"}:m));}else{await requireSupabase().from("maintenance_contracts").update({renewed_from_id:source.id}).eq("id",next.id);await requireSupabase().from("maintenance_contracts").update({status:"renewed"}).eq("id",source.id);await requireSupabase().from("maintenance_renewals").insert({source_maintenance_id:source.id,renewed_maintenance_id:next.id,created_by:userId});}return next;}
};
