import type { Client } from "@/types/client";

export type Contact = {
  id: string;
  client_id: string;
  full_name: string;
  designation: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  department: string | null;
  is_primary: boolean;
  is_billing_contact: boolean;
  is_project_contact: boolean;
  archived_at: string | null;
  updated_by: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  client?: Client | null;
};

export type ContactFormData = {
  client_id: string;
  full_name: string;
  designation: string;
  email: string;
  phone: string;
  whatsapp: string;
  department: string;
  is_primary: boolean;
  is_billing_contact?: boolean;
  is_project_contact?: boolean;
  notes: string;
};

export type ContactCreateInput = ContactFormData & {
  created_by: string | null;
};

export type ContactUpdateInput = Partial<ContactFormData>;
