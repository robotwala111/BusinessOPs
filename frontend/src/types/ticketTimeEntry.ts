export type TicketTimeEntry = {
  id: string;
  ticket_id: string;
  user_id: string | null;
  entry_date: string;
  hours: number;
  notes: string | null;
  eligible_for_maintenance: boolean;
  created_by: string | null;
  created_at: string;
};

