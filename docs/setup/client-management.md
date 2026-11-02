# Client Management Setup

Apply the Supabase migrations in order:

```text
backend/supabase/migrations/202605100001_create_profiles.sql
backend/supabase/migrations/202605100002_create_clients.sql
```

For local exploration without Supabase credentials, use demo auth and create clients in the browser. Demo client data is stored in local storage.
