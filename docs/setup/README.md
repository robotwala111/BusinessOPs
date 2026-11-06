# Setup

## Frontend

Run the app from the `frontend/` folder:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment

Create `frontend/.env.local` from `frontend/.env.example` when connecting Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

When these values are blank, the app uses the local demo login:

```text
Email: demo-admin@example.local
Password: Admin@123
```

The local PostgreSQL bootstrap seeds this demo account in `auth.users` because business records such as clients reference that table for `created_by`. If an existing local database has not been seeded, client creation now falls back to a null `created_by` for the synthetic demo identity rather than failing. To seed the identity for local audit attribution, run only the bootstrap SQL as a PostgreSQL administrator; avoid replaying all migrations against an established database. This affects only local PostgreSQL; do not seed the demo account in production Supabase.

New clients must verify their email address with a one-time code before creation. Configure server-side SMTP settings as described in [client email verification](client-email-verification.md). Existing-client edits are unchanged.

## Supabase Migrations

Apply migrations from `backend/supabase/migrations/` in order:

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

Each table has RLS enabled. Client and quotation deletes are restricted to users whose profile role is `admin`.
The same admin-only delete pattern is used for contracts, invoices, payments, expenses, maintenance contracts, and support tickets.

Migration `022` resets existing profiles to `staff` because earlier signups inherited the admin default, defaults new profiles to `staff`, prevents users from changing their own role, and adds admin profile management policies. After applying it, promote trusted administrators using a trusted Supabase SQL session. In production, disable public signups in Supabase Auth and provision staff through trusted invitations; never grant a role through user-editable metadata.

### AI Copilot

The Copilot is disabled unless `AI_COPILOT_ENABLED=true`. Apply migrations `022` and `023`, test the RLS policies and service-role functions in a disposable Supabase project, then configure these server-only variables: `SUPABASE_SERVICE_ROLE_KEY`, `AI_API_KEY`, `AI_MODEL`, `AI_INPUT_COST_PER_MILLION_USD`, and `AI_OUTPUT_COST_PER_MILLION_USD`. Optional settings include `AI_BASE_URL`, `AI_DAILY_BUDGET_USD` (maximum 10 USD), `AI_MAX_REQUESTS_PER_HOUR` (maximum 20), and `AI_MAX_REQUEST_COST_USD` (maximum 0.50 USD). Never prefix provider or service-role credentials with `NEXT_PUBLIC_`.

The configured provider must support an OpenAI-compatible chat-completions endpoint with JSON-object output and token usage reporting. Copilot currently supports predefined, read-only questions; it does not modify business records or process document uploads.

## PDF Generation

Quotation PDFs use `jsPDF` and `jspdf-autotable` in the browser. The visible source of truth is live quotation detail data; template references are stored under `data/templates/quotations/`.

Place the Amiro Tech Solutions logo at:

```text
frontend/public/assets/amiro-tech-logo.png
```

If that file is absent, the PDF generator still works, but the brand mark falls back to a text-based ATS block.

## Storage Buckets

The storage migration creates:

```text
signed-contracts
expense-receipts
```

Authenticated users can upload and read files. In local demo mode, uploads are stored as browser data URLs.
