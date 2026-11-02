export type ContractVersion = {
  id: string;
  contract_id: string;
  version_number: number;
  content: string | null;
  terms_and_conditions: string | null;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  signed_at: string | null;
  created_by: string | null;
  created_at: string;
};

