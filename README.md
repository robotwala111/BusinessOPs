# Amiro Tech Business Operations

Internal business operations system for Amiro Tech Solutions.

## Tech Stack

- Frontend: React, Next.js App Router, TypeScript
- Authentication: Supabase Auth
- Backend, database, storage, and policies: Supabase
- PDF generation: `jsPDF` with `jspdf-autotable` in the browser
- Deployment: Vercel for frontend, Supabase for backend services

## Repository Structure

```text
frontend/
  src/
    app/             Next.js routes, public auth pages, and protected app routes
    components/      Auth, layout, UI, forms, and shared components
    hooks/           Reusable React hooks
    lib/             Supabase client, constants, validations
    services/        Frontend service boundaries for Supabase calls
    types/           Shared TypeScript domain types
    utils/           Formatting and ID helpers
    styles/          Global styles

backend/
  supabase/
    migrations/      Database schema migrations
    seed/            Seed data scripts and fixtures
    policies/        RLS policy drafts and references
    functions/       Future Supabase Edge Functions

data/
  templates/         Quotation, contract, and invoice templates
  sample-data/       Local sample datasets
  exports/           Generated exports

docs/
  architecture/      System design notes
  setup/             Local setup notes
  deployment/        Deployment notes
```

## Authentication Foundation

Implemented:

- Email/password login
- Account registration page (new Supabase accounts are staff, not admins)
- Forgot password starter page
- Supabase Auth provider and `useAuth` hook
- Protected route wrapper for internal app pages
- Logout action in the topbar
- Redirect unauthenticated users to `/login`
- Redirect authenticated users to `/dashboard`
- `profiles` table migration with RLS enabled
- Local demo auth fallback when Supabase env vars are not configured

Projects, contracts, invoices/payments, expenses, maintenance/support, settings/configuration, and dashboard reporting now have core implementations. Future work can deepen detail routes, analytics charts, and advanced document workflows.

## Client Management

Implemented:

- Clients list table
- New client page
- Edit client page
- Client detail page
- Delete confirmation
- Search by company name, contact person, email, or phone
- Status filter
- Loading, empty, and error states
- Status badges
- Supabase-ready client service layer
- Local demo client storage when Supabase env vars are not configured

Client statuses:

```text
lead
proposal_sent
active
inactive
closed
```

The module uses `frontend/src/services/clientService.ts`, `frontend/src/hooks/useClients.ts`, and `frontend/src/types/client.ts` as the core frontend boundary.

## Project Management

Implemented:

- Projects as a first-class child entity under clients
- Project list, create, edit, search, status filter, priority filter, and admin-only delete
- Project code generation in the format `ATS-PRJ-YYYY-0001`
- Client detail page shows related projects
- Relationship fields added across quotations, contracts, invoices, expenses, maintenance contracts, and support tickets

## Quotation Management

Implemented:

- Quotations list table
- New quotation page
- Edit quotation page
- Quotation detail page
- Delete confirmation
- Search by quotation number, title, or client
- Status filter
- Quotation number generation in the format `ATS-QTN-YYYY-0001`
- Quotation item add, edit, and delete in the form
- Structured quotation sections for project overview, scope of work, tech stack, project timeline, support and maintenance, payment terms, and terms and conditions
- Subtotal, discount, tax, and total calculations
- Loading, empty, and error states
- Supabase-ready quotation service layer
- Local demo quotation storage when Supabase env vars are not configured
- PDF download from the quotation detail page

Quotation statuses:

```text
draft
sent
accepted
rejected
expired
```

The module uses `frontend/src/services/quotationService.ts`, `frontend/src/hooks/useQuotations.ts`, and `frontend/src/types/quotation.ts` as the core frontend boundary.

## Quotation PDF Generation

The quotation detail page includes a `Download PDF` button. It lazy-loads a browser-only `jsPDF` generator and uses `jspdf-autotable` for multi-page tables from live quotation data. This keeps the feature compatible with Vercel because it does not require server-side filesystem access.

PDF component structure:

```text
frontend/src/components/quotations/pdf/
  QuotationTemplate.tsx
  QuotationHeader.tsx
  QuotationClientInfo.tsx
  QuotationItemsTable.tsx
  QuotationSummary.tsx
  QuotationMilestones.tsx
  QuotationTerms.tsx
  QuotationAcceptance.tsx
  QuotationFooter.tsx
```

Template references are stored under:

```text
data/templates/quotations/default-template.json
data/templates/quotations/quotation-template.html
data/templates/quotations/quotation-styles.css
data/templates/quotations/quotation-theme.ts
```

The PDF includes Amiro Tech Solutions branding, quotation dates, From/To details, quotation metadata, greeting, project overview, module table, optional technical specifications, deliverables, totals, payment milestones, terms and conditions, acceptance signatures, confidentiality notice, and company footer details.

Logo support expects the uploaded Amiro Tech Solutions logo at:

```text
frontend/public/assets/amiro-tech-logo.png
```

## Contract Management

Implemented core features:

- Contract list, create, edit, and admin-only delete
- Contract number generation: `ATS-CON-YYYY-0001`
- Type/status filtering and search
- Signed contract upload to Supabase Storage bucket `signed-contracts`
- Demo-mode file handling when Supabase is not configured

## Invoice & Payment Tracking

Implemented core features:

- Invoice list, create, edit, and admin-only delete
- Invoice number generation: `ATS-INV-YYYY-0001`
- Payment recording against invoices
- Amount paid and balance due calculations
- Invoice PDF download
- Invoice search and status filter

## Expense Tracking

Implemented core features:

- Expense list, create, edit, and admin-only delete
- Expense number generation: `ATS-EXP-YYYY-0001`
- Category/search filters
- Receipt upload to Supabase Storage bucket `expense-receipts`
- Monthly expense summary

## Maintenance & Support

Implemented core features:

- Maintenance contract list and create
- Support ticket list and create
- Ticket number generation: `ATS-TKT-YYYY-0001`
- Ticket search and status filter
- Renewal date tracking on maintenance contracts

## Dashboard

Implemented real-data dashboard cards for clients, quotations, invoices, payments, expenses, maintenance contracts, and support tickets.

## Plug-And-Play Settings

Implemented configuration foundations for company settings, service catalog, document templates, standard terms, payment milestone templates, expense categories, and project types.

## Demo Login

Supabase and Vercel configuration are intentionally deferred for now. If `frontend/.env.local` does not contain Supabase values, the app runs in demo auth mode.

Use:

```text
Email: demo-admin@example.local
Password: Admin@123
```

The demo session is stored locally in the browser and is only for exploring the frontend.

## Local Setup

1. Go to the frontend app:

   ```bash
   cd frontend
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Optional: create a local environment file when Supabase is ready:

   ```bash
   cp .env.example .env.local
   ```

4. Add Supabase project values to `frontend/.env.local` when Supabase is ready. Without these values, demo auth mode is used.

5. Start the development server:

   ```bash
   npm run dev
   ```

6. Open `http://localhost:3000`.

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Do not hardcode Supabase credentials. Configure these locally in `frontend/.env.local` and in Vercel project settings when the real Supabase project is connected.

## Supabase Setup

Apply migrations from:

```text
backend/supabase/migrations/
```

Run migrations in order:

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
```

The profiles migration creates `public.profiles`, enables row level security, creates own-profile read/update/insert policies, and adds a trigger to create a profile record when a Supabase Auth user is created.

The clients migration creates `public.clients`, enables row level security, allows authenticated users to insert, read, and update clients, and allows delete only when the signed-in user's profile role is `admin`.

The quotations migration creates `public.quotations`, enables row level security, allows authenticated users to insert, read, and update quotations, and allows delete only for admin users.

The quotation items migration creates `public.quotation_items`, enables row level security, and cascades quotation item deletion when a quotation is deleted.

The quotation sections migration adds optional content blocks for project overview, scope of work, tech stack, project timeline, and support and maintenance.

The remaining migrations add contracts, invoices, payments, expenses, maintenance contracts, support tickets, and private Supabase Storage buckets for signed contracts and receipts. RLS is enabled for every business table: authenticated users can read/insert/update and only admin users can delete.

The enterprise migrations add `projects`, relationship fields from major business records to projects, enterprise metadata fields, indexes, and configuration/master tables for plug-and-play standardization.

Migration `022` resets existing profiles to `staff` because earlier signups inherited the admin default, assigns new profiles the `staff` role, prevents users from changing their own role, and allows admins to manage profiles. After applying it, promote trusted administrators through a Supabase SQL session. Disable public signups in Supabase Auth and provision other users by invitation; do not grant admin through client metadata or browser requests.

The AI Business Copilot is disabled by default. Apply migrations `022` and `023`, verify authentication/RLS in a disposable Supabase project, and configure the server-only AI and Supabase service-role settings before setting `AI_COPILOT_ENABLED=true`. Business-data queries use the signed-in user's Supabase token; the service-role key is limited to budget reservation, usage logging, and saving assistant replies. Never add it to a `NEXT_PUBLIC_*` variable.

## Client Module Testing Checklist

- Migration runs successfully
- `clients` table exists in Supabase
- Logged-in user can create a client
- Logged-in user can view clients
- Logged-in user can edit a client
- Admin can delete a client
- Search works across company, contact, email, and phone
- Status filter works
- UI works on desktop and mobile
- No console errors

## Core Business Module Testing Checklist

- Contracts can be created, edited, filtered, and deleted by admins
- Signed contract file upload works
- Invoices can be created, edited, filtered, and deleted by admins
- Payments update invoice balances
- Invoice PDF downloads
- Expenses can be created, edited, filtered, and deleted by admins
- Receipt upload works
- Maintenance contracts can be created
- Support tickets can be created and filtered
- Dashboard cards show live data
- `npm run build` passes
- No Supabase keys are hardcoded

## Quotation PDF Testing Checklist

- Existing auth still works
- Existing clients module still works
- Existing quotations module still works
- Quotation detail page opens
- Download PDF button appears
- PDF downloads successfully
- PDF contains correct client details
- PDF contains correct quotation items
- PDF calculations match UI
- PDF design looks professional
- Logo renders correctly when present at `frontend/public/assets/amiro-tech-logo.png`
- Multi-page quotations and long terms render correctly
- Works in local development
- No console errors

## Deployment

Deploy `frontend/` to Vercel and set the Vercel project root directory to `frontend`. Configure the Supabase environment variables in Vercel. Supabase remains responsible for auth, database, storage, policies, and future Edge Functions.
