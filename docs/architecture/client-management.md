# Client Management

The Client Management module owns the basic client account records for Amiro Tech Solutions.

Frontend boundaries:

- `frontend/src/types/client.ts`
- `frontend/src/services/clientService.ts`
- `frontend/src/hooks/useClients.ts`
- `frontend/src/components/clients/`
- `frontend/src/app/(protected)/clients/`

Supabase boundaries:

- `backend/supabase/migrations/202605100002_create_clients.sql`

RLS policy notes:

- Authenticated users can read all clients.
- Authenticated users can insert clients when `created_by` matches `auth.uid()`.
- Authenticated users can update clients.
- Only users with `profiles.role = 'admin'` can delete clients.

Local demo mode stores client records in browser local storage until Supabase credentials are configured.
