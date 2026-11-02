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
Email: admin@amirotech.local
Password: Admin@123
```

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
```

Each table has RLS enabled. Client and quotation deletes are restricted to users whose profile role is `admin`.
The same admin-only delete pattern is used for contracts, invoices, payments, expenses, maintenance contracts, and support tickets.

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
