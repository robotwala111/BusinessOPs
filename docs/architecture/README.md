# Architecture

The project is split into deployable frontend code, Supabase backend assets, shared data templates, and documentation.

```text
frontend/   Next.js App Router application for Vercel
backend/    Supabase migrations, RLS policies, and future Edge Functions
data/       Static templates, sample data, and exports
docs/       Setup, architecture, and deployment notes
```

## Frontend Boundaries

Feature modules keep types, service calls, hooks, and UI components separate:

- `src/types/*` defines domain shapes.
- `src/services/*` owns Supabase and demo localStorage persistence.
- `src/hooks/*` owns client-side state, filters, and mutations.
- `src/components/*` owns user-facing screens and reusable UI.

Supabase credentials are read only from `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Implemented Modules

- Authentication foundation with protected routes and demo auth fallback.
- Client Management with CRUD, search, filters, loading, empty, and error states.
- Project Management as a first-class child entity under clients.
- Quotation Management with CRUD, item management, quotation number generation, totals, search, filters, and PDF download.
- Contract Management with core CRUD, filters, generated contract numbers, and signed file upload.
- Invoice and Payment Tracking with core CRUD, payment recording, balance calculations, and invoice PDF download.
- Expense Tracking with core CRUD, filters, receipt upload, and monthly summary.
- Maintenance and Support with maintenance contract creation and support ticket tracking.
- Dashboard metrics from live service data.
- Plug-and-play settings for company information, service catalog, document templates, standard terms, milestone templates, expense categories, and project types.

Quotation PDFs are generated in the browser with `jsPDF` and `jspdf-autotable`. The generator is lazy-loaded from the quotation detail page so normal page load remains light, and no production server filesystem access is needed.

## Quotation PDF Architecture

The PDF system is split into small document components under `frontend/src/components/quotations/pdf/`.

- `QuotationTemplate.tsx` composes the full A4 document.
- `QuotationHeader.tsx` owns branding, title, reference number, and date.
- `QuotationClientInfo.tsx` renders From/To information.
- `QuotationItemsTable.tsx` renders dynamic quotation items as modules.
- `QuotationSummary.tsx` renders subtotal, discount, tax, and final total.
- `QuotationMilestones.tsx` derives milestone cards from payment terms.
- `QuotationTerms.tsx` renders deliverables, optional technical specs, notes, and terms.
- `QuotationAcceptance.tsx` renders signature placeholders.
- `QuotationFooter.tsx` renders confidentiality and copyright details.

`frontend/src/utils/pdf/quotationPdfHelpers.ts` transforms live quotation data into a PDF view model. It formats dates, formats currency, derives modules from quotation items, derives milestones from payment terms, and builds the download filename as `ATS-{quotation_number}.pdf`.

`frontend/src/utils/pdf/generateQuotationPdf.ts` owns the browser-only PDF drawing flow, page breaks, tables, summary blocks, milestones, terms, acceptance signatures, and footer pagination.
