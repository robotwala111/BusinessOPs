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
202609020018_create_operational_workflows.sql
202609030019_create_brand_asset_storage.sql
202609030020_create_atomic_financial_note_application.sql
202609030021_create_payment_evidence_storage.sql
202611020022_harden_profile_roles.sql
202611020023_create_ai_copilot_storage.sql
```

Supabase is responsible for authentication, database storage, RLS policies, and future Edge Functions.

The storage migration creates private buckets for signed contracts and expense receipts. Confirm the bucket policies are present before testing production file uploads.

Migration `022` resets existing profiles to `staff` because earlier signups inherited the admin default. After applying it, promote trusted administrators through a trusted Supabase SQL session. Disable public signups in Supabase Auth before production and provision staff through trusted invitations. New profiles receive the `staff` role; do not expose service-role credentials to the frontend.

The AI Copilot remains disabled until `AI_COPILOT_ENABLED=true`. Before enabling it, apply and validate migrations `022`-`023`, test user-specific conversation RLS and the budget RPCs in a disposable Supabase project, and set server-only `SUPABASE_SERVICE_ROLE_KEY`, provider credentials/model, and per-token cost rates. The service-role key is used only by the server API for usage budgets/logs and assistant replies; all business-data reads use the authenticated user's token. Do not expose AI or service-role credentials as `NEXT_PUBLIC_*`.
