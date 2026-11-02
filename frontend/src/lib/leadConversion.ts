import type { Lead } from "@/types/lead";

export function validateLeadForConversion(lead: Lead | null | undefined) {
  if (!lead) throw new Error("Lead not found.");
  if (lead.converted_client_id || lead.status === "converted") {
    throw new Error("This lead has already been converted.");
  }
  if (!lead.company_name.trim()) throw new Error("Company name is required before conversion.");
  if (!lead.contact_person?.trim()) throw new Error("A contact name is required before conversion.");
  return lead;
}

