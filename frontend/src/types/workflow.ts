export type EntityType =
  | "lead" | "client" | "contact" | "project" | "quotation"
  | "contract" | "milestone" | "invoice" | "payment" | "expense"
  | "maintenance" | "ticket";

export type EntityHistory = {
  id: string;
  entity_type: EntityType;
  entity_id: string;
  event_type: string;
  previous_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  description: string;
  actor_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type Notification = {
  id: string;
  recipient_id: string | null;
  notification_type: string;
  title: string;
  message: string;
  entity_type: EntityType | null;
  entity_id: string | null;
  due_at: string | null;
  read_at: string | null;
  dismissed_at: string | null;
  deduplication_key: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type LeadConversionInput = {
  leadId: string;
  createProject: boolean;
};

export type LeadConversionResult = {
  lead_id: string;
  client_id: string;
  contact_id: string | null;
  project_id: string | null;
};

