# Deployment

## Frontend

Deploy `frontend/` to Vercel and set the Vercel project root directory to `frontend`.

Configure these environment variables in Vercel:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

The quotation PDF feature runs client-side through `jsPDF` and `jspdf-autotable`, so no server-only filesystem access is required in production.

The Amiro Tech Solutions logo should be deployed with the frontend at:

```text
frontend/public/assets/amiro-tech-logo.png
```

## Backend

Apply the Supabase migrations in `backend/supabase/migrations/` before using the production app:

```text
202605100001_create_profiles.sql
202605100002_create_clients.sql
202605100003_create_quotations.sql
202605100004_create_quotation_items.sql
202605100005_add_quotation_sections.sql
202605100006_create_contracts.sql
202605100007_create_invoices_payments.sql
202605100008_create_expenses.sql
202605100009_create_maintenance_support.sql
202605100010_create_storage_buckets.sql
202605100011_create_projects_and_relationship_indexes.sql
202605100012_create_configuration_tables.sql
202605100013_create_productization_settings.sql
202605100014_create_crm_contacts_activities.sql
202605100015_create_leads.sql
202609020016_create_workflow_foundations.sql
202609020017_create_commercial_lifecycle.sql
```

Supabase is responsible for authentication, database storage, RLS policies, and future Edge Functions.

The storage migration creates private buckets for signed contracts and expense receipts. Confirm the bucket policies are present before testing production file uploads.
