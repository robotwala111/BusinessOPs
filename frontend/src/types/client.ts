export const CLIENT_STATUSES = [
  "lead",
  "proposal_sent",
  "active",
  "inactive",
  "closed",
  "archived"
] as const;

export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export type Client = {
  id: string;
  company_name: string;
  client_short_name: string | null;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  gst_number: string | null;
  pan_number: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string;
  industry: string | null;
  lead_source: string | null;
  status: ClientStatus;
  notes: string | null;
  account_owner: string | null;
  payment_terms: string | null;
  archived_at: string | null;
  archived_by: string | null;
  updated_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ClientFormData = {
  company_name: string;
  client_short_name: string;
  contact_person: string;
  email: string;
  phone: string;
  gst_number: string;
  pan_number: string;
  address: string;
  city: string;
  state: string;
  country: string;
  industry: string;
  lead_source: string;
  status: ClientStatus;
  notes: string;
  account_owner?: string;
  payment_terms?: string;
  created_by?: string | null;
};

export type ClientCreateInput = Omit<ClientFormData, "created_by"> & {
  created_by: string | null;
};

export type ClientUpdateInput = Partial<ClientFormData>;
