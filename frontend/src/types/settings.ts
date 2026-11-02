export type CompanySettings = {
  id: string;
  company_name: string | null;
  legal_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  gst_number: string | null;
  pan_number: string | null;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  currency: string | null;
  default_tax_percentage: number | null;
  bank_details: string | null;
  authorized_signatory_name: string | null;
  default_footer_text: string | null;
  created_at: string;
  updated_at: string;
};

export type EffectiveCompanySettings = {
  company_name: string;
  legal_name: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  gst_number: string;
  pan_number: string;
  logo_url: string;
  primary_color: string;
  secondary_color: string;
  currency: string;
  default_tax_percentage: number;
  bank_details: string;
  authorized_signatory_name: string;
  default_footer_text: string;
};

export type NumberingFormat = {
  id: string;
  document_type: string;
  prefix: string;
  include_year: boolean;
  separator: string;
  padding: number;
  next_number: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type ConfigurableOption = {
  id: string;
  option_group: string;
  option_key: string;
  label: string;
  color?: string | null;
  sort_order?: number | null;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type MasterRecord = {
  id: string;
  name?: string;
  service_name?: string;
  template_name?: string;
  title?: string;
  description?: string | null;
  is_active?: boolean;
};
