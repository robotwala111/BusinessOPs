import { describe, expect, it } from "vitest";
import { validateLeadForConversion } from "./leadConversion";
import type { Lead } from "@/types/lead";

function lead(overrides: Partial<Lead> = {}): Lead {
  return { id: "lead-1", lead_number: "LEAD-2026-0001", company_name: "Amiro Client",
    contact_person: "Primary Contact", email: "client@example.com", phone: null, website: null,
    location: null, lead_source: null, service_interested: "Web Application", status: "qualified",
    priority: "medium", assigned_to: null, estimated_value: 1000, expected_close_date: null,
    follow_up_date: null, campaign: null, notes: null, lost_reason: null,
    converted_client_id: null, converted_contact_id: null, converted_project_id: null,
    converted_at: null, archived_at: null, archived_by: null, updated_by: null,
    created_by: null, created_at: "2026-09-02T00:00:00.000Z", updated_at: "2026-09-02T00:00:00.000Z",
    ...overrides };
}

describe("lead conversion validation", () => {
  it("accepts a complete unconverted lead", () => expect(validateLeadForConversion(lead()).id).toBe("lead-1"));
  it("prevents duplicate conversion", () => expect(() => validateLeadForConversion(lead({ status: "converted", converted_client_id: "client-1" }))).toThrow(/already/));
  it("requires company and primary contact information", () => {
    expect(() => validateLeadForConversion(lead({ company_name: "" }))).toThrow(/Company/);
    expect(() => validateLeadForConversion(lead({ contact_person: null }))).toThrow(/contact name/);
  });
});

