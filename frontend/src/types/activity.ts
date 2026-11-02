import type { Client } from "@/types/client";
import type { Contact } from "@/types/contact";
import type { Project } from "@/types/project";

export const ACTIVITY_TYPES = [
  "call",
  "email",
  "meeting",
  "follow_up",
  "demo",
  "proposal_discussion",
  "payment_follow_up",
  "support_discussion",
  "general_note"
] as const;

export const ACTIVITY_STATUSES = ["pending", "completed", "cancelled"] as const;
export const ACTIVITY_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number];
export type ActivityPriority = (typeof ACTIVITY_PRIORITIES)[number];

export type Activity = {
  id: string;
  client_id: string;
  contact_id: string | null;
  project_id: string | null;
  activity_type: ActivityType;
  subject: string;
  description: string | null;
  activity_date: string;
  due_date: string | null;
  status: ActivityStatus;
  priority: ActivityPriority;
  assigned_to: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  client?: Client | null;
  contact?: Contact | null;
  project?: Project | null;
};

export type ActivityFormData = {
  client_id: string;
  contact_id: string;
  project_id: string;
  activity_type: ActivityType;
  subject: string;
  description: string;
  activity_date: string;
  due_date: string;
  status: ActivityStatus;
  priority: ActivityPriority;
  assigned_to: string;
  completed_at: string;
};

export type ActivityCreateInput = ActivityFormData & {
  created_by: string | null;
};

export type ActivityUpdateInput = Partial<ActivityFormData>;
