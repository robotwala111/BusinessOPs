# Implementation Audit

Audit date: 2026-09-02

This assessment is based on the application routes, TypeScript services and types,
Supabase migrations `001` through `015`, browser demo persistence, document
generators, and a successful Next.js production build. It does not treat a page or
table name as proof that a workflow is complete.

## Executive finding

The repository is a working CRUD-oriented MVP, not yet a production-complete
business operations system. Authentication, clients, quotations and PDFs are the
most developed areas. Leads, contacts, activities, projects, contracts, invoices,
expenses, maintenance and tickets have real Supabase service paths and matching
demo paths, but most are list/form screens without detail workflows, history,
archival, controlled transitions or transactional conversion. Milestones,
notifications, document versions, payment corrections and closure controls do not
yet exist.

| Module | Existing | Partial | Missing | Broken/Risky | Recommended Action |
| --- | --- | --- | --- | --- | --- |
| Authentication | Supabase email/password, protected routes, demo login | Forgot-password page does not complete a reset flow; registration is public | Production user lifecycle | Demo credentials differ between README and code; role checks also occur in the browser | Keep current auth for this phase; document demo mode and enforce workflow rules in the database |
| Leads/CRM | List/create/edit/lost/convert, search/filter, Supabase and local persistence | Conversion creates only a client | Detail page, owner UX, campaign, follow-up, aging, duplicate detection, archive, conversion history | Conversion is multi-call and non-atomic; hard delete; statuses differ from brief | Add atomic conversion RPC, archive fields, connected activity/contact/project creation |
| Clients | CRUD, detail page, search/filter, Supabase and local persistence | Detail page shows a subset of related records | True 360 metrics, addresses/documents, archive workflow | Client delete is exposed; contacts and activities cascade on client deletion | Replace transactional deletes with archive and add aggregated 360 service |
| Contacts | CRUD, primary-contact constraint, Supabase and local persistence | Single global page | Detail/deep links, billing/project contact roles | Hard delete; client cascade can erase contacts | Add archive and contact roles; surface within Client 360 |
| Activities | CRUD, filters, relation joins, Supabase and local persistence | Generic activities only | Entity-wide immutable event history | Activities are mutable/deletable and cannot serve as an audit log | Keep tasks/notes separate; add immutable `entity_history` |
| Projects | CRUD, client relation, filters, Supabase and local persistence | Client detail lists projects | Project 360, milestones, delivery, closure, profitability | Hard delete; legacy statuses; manual project value | Add project detail route, status rules, milestones and computed metrics |
| Quotations | CRUD, items, totals, structured content, PDF, Supabase and local persistence | Project relation and configurable prefixes | Review/approval/revisions, status history, clone, tax model, conversions | Accepted/sent records remain editable; number generation races; item delete/reinsert update | Add immutable revisions, transition rules, atomic numbering/conversion and tested calculations |
| Contracts | CRUD, filters, signed upload, Supabase and local persistence | Links to client/project/quotation | Detail page, versions, approval, renewal/termination history | Signed file uses upsert and can replace the prior object; hard delete | Add contract versions and documents; controlled transition/detail workflow |
| Milestones | Payment milestone templates only | None | Project milestones, deliverables, acceptance and invoice conversion | No operational milestone table or UI | Add milestone/deliverable schema, service and project workflow |
| Invoices | CRUD, totals, PDF, Supabase and local persistence | Basic quotation/contract/project fields | Detail page, lines, tax documents, issue control, credit/debit notes | Totals are editable summary fields; issued invoices can be overwritten/deleted; number race | Add invoice lines, document types, transitions, history and immutable issued state |
| Payments | Separate table and database balance trigger | Add-only UI | Allocation, TDS, adjustments, evidence, reversal/correction | Payment delete cascades with invoice; demo sums mutable invoice amount; no reversal history | Add allocation/reversal model and central outstanding calculation |
| Expenses | CRUD, upload, monthly total, Supabase and local persistence | Approval columns exist in migration `011` but UI does not use them | Submit/approve/reject/pay/export/history | All expenses count regardless of approval; hard delete; storage upsert | Add controlled approval workflow and approved-expense reporting |
| Maintenance | Create/list, client/project/contract links | Basic renewal field | Detail, billing, consumed hours, renewal history | Free-form status in original schema; no controlled transitions | Add lifecycle fields, renewal records and computed hours |
| Support tickets | Create/list/search/filter | Basic SLA/time fields exist | Assignment workflow, comments, time entries, attachments, reopening and SLA calculations | No `new`, `assigned`, `reopened` or `cancelled`; no immutable history | Add ticket detail, time entries, transition rules and SLA utilities |
| Dashboard/reporting | Live service totals for core tables | Simple cards | Operational drill-downs, aging, profitability, filters and CSV | Cards are broad counts and are not linked to filtered lists | Add report queries and shared filter parameters after connected workflows |
| Documents/storage | Private signed-contract and expense buckets; browser data URLs in demo | PDF download for quotations/invoices | Document metadata/versioning and secure retrieval service | Stored URL handling assumes direct URL; upsert can replace originals | Add document table and versioned object paths with signed retrieval |
| Notifications | None | None | Tables, deterministic generation, in-app UI, scheduler hook | No reminder processing exists | Add notification foundation and explicit manual trigger; document scheduler as pending |
| Database/migrations | Migrations `001`-`015` exist; tables have RLS | Many relationships were added by `011` | Histories, milestones, documents, notifications, atomic conversions/numbers | Client-generated numbers race; destructive cascades; permissive update policies | Add only forward migrations beginning at `016`; add functions/constraints/indexes |
| Automated tests | Next build performs lint and type checking | None | Unit, service/integration and E2E setup | No `test` script or calculation regression protection | Add Vitest for domain rules, then browser E2E for vertical workflows |
| Documentation | Architecture/setup/deployment and template notes | README describes the older core | Entity map, workflow rules, complete migration list | Setup/deployment omit migrations `013`-`015`; demo login is inconsistent | Update docs with each migration and verified command results |

## Route and UI findings

- Existing detail routes: clients and quotations only.
- Missing detail routes: leads, contacts, activities, projects, contracts, invoices,
  expenses, maintenance agreements and support tickets.
- Projects, contracts, invoices, expenses, maintenance and leads are large single-page
  CRUD implementations rather than connected workflows.
- UI components named `DataTable`, `DateInput`, `CurrencyInput`, `FilterBar`,
  `FormSection`, `DetailSection`, `StatusBadge`, `StatCard`, `Timeline`,
  `TemplateSelector` and `AttachmentUploader` are currently minimal wrappers or
  placeholders and are largely unused.
- Delete actions remain visible for leads, projects, contacts, activities, contracts,
  invoices and expenses. This conflicts with preservation of financial history.
- The known build warnings are in `Sidebar`, `AutocompleteInput`, `useActivities`
  and `useContacts`.

## Persistence and integrity findings

- Every primary service switches between Supabase and browser `localStorage` using
  `isSupabaseConfigured`. Demo mode is real browser persistence but is not shared,
  durable or suitable for production.
- `generateNumber` queries the latest document and increments it on the client.
  Simultaneous users can generate the same number.
- Real lead conversion first creates a client and then updates the lead. Failure of
  the second request leaves an orphan conversion; it does not create a contact or
  project.
- Quotation updates delete and recreate item records, so item identity/history is
  lost.
- The payment trigger derives `amount_paid` from raw payment rows, but has no TDS,
  credits, reversal or allocation state.
- Financial and accepted records can be edited or hard-deleted through the current
  service layer.
- `created_by` is nullable in types and demo mode. Most tables do not have
  `updated_by`, `archived_at` or `archived_by`.

## Current validation baseline

`npm run build` succeeds with 21 routes. It reports four non-blocking warnings:

1. Sidebar uses a raw `img` element.
2. Autocomplete options omit `aria-selected`.
3. `useActivities` omits `loadActivities` from an effect dependency list.
4. `useContacts` omits `loadContacts` from an effect dependency list.

There is no formal unit, integration or end-to-end test command in `package.json`.

## Priority implementation order

1. Add database-level numbering, immutable history, archival foundations and atomic
   lead conversion.
2. Centralize and test statuses, transitions, tax/money, outstanding balance,
   profitability, maintenance hours and SLA calculations.
3. Complete Lead conversion -> Client 360 -> Project 360 as the first vertical flow.
4. Add quotation review/revisions and accepted-quotation conversion.
5. Add contract versions, milestones, invoice/payment allocation and expense approval.
6. Complete project closure, maintenance/ticket workflows, operational reports and
   notifications.
7. Add end-to-end coverage, fix accessibility/build warnings and update operational
   documentation.

## Implementation checkpoint — 2026-09-02

Verified improvements completed after the initial audit:

- Migration `016` now replaces legacy lifecycle constraints safely after normalizing
  legacy values, recalculates payments without reversed transactions, allocates
  document numbers under a database row lock, and converts leads transactionally.
- Stage 1 domain/service adapters exist for entity history, milestones,
  notifications, ticket time entries and contract versions in Supabase and demo mode.
- Lead conversion requires company/contact information, prevents repeat conversion,
  supports conversion with or without a project, and returns navigation links to the
  generated records. Demo conversion prepares every record before committing the
  connected local-storage batch.
- Client 360 displays live commercial summaries and related-record counts and uses
  archival instead of deleting a client with history.
- Project 360 has a real detail route, calculated commercial summary, persisted
  milestone creation and controlled milestone transitions with history.
- Atomic Supabase document-number allocation is wired into the shared numbering
  service and quotation numbering.
- Vitest is configured. Eight calculation, transition and conversion-validation tests
  pass.
- `npm run typecheck`, `npm run lint` and `npm run build` pass. All four warnings from
  the initial audit are fixed.

Still pending: full lead detail/activity timeline and duplicate UI, richer Client 360
record tables/documents, project closure, quotation versioning/conversion, contract
detail/version upload, invoice lines/payment reversals, expense approval,
maintenance/ticket detail workflows, notification UI, reporting and end-to-end tests.

## Commercial lifecycle checkpoint — 2026-09-02

- Quotation detail now enforces the lifecycle, records review/approval/send/
  acceptance/rejection events, requires reasons when returning or rejecting, locks
  non-drafts, clones and creates revisions, and converts accepted quotations to one
  contract without duplicate creation.
- Contract detail supports controlled transitions, immutable signed-file versions,
  related invoices and entity history.
- Accepted milestones can create one linked invoice; duplicate, premature and
  over-value billing is rejected unless a persisted override reason is supplied.
- Invoice detail supports approval/issue/cancel/write-off transitions, PDF download,
  immutable payment records, TDS, bank references, partial/final allocation and
  reversal history. Issued invoices cannot be silently edited.
- Expenses now move through draft, submitted, approved/rejected, paid and cancelled
  states with mandatory approval comments and history.
- Project closure evaluates milestones, deliverable/client acceptance, final billing,
  reimbursable expenses, documents and notes. Overrides require a reason and record
  the overridden blockers; outstanding receivables remain visible.
- Project and Client 360 use invoice-based gross margin: non-draft/non-cancelled
  invoiced value minus approved/paid expenses. Direct client and project records are
  filtered once by record ID in each service result, avoiding duplicate aggregation.
- Migration `017` adds invoice lines, quotation item commercial fields, duplicate
  milestone-invoice protection, quotation conversion links, contract commercial
  fields, closure metadata and an atomic quotation-to-contract function.
- Verification: 14 unit tests pass; type checking, lint and production build pass.

## Review follow-up — 2026-11-06

This follow-up preserves the earlier audit and implementation history while recording
the current review against the enterprise portal brief:

- The existing module names and route structure remain in place. CRM, business
  operations, finance, administration and the portal have dedicated pages; shared
  layout and form/table components are present.
- The dashboard’s collection rate previously reported 100% when there were no
  invoices. It now shows “— / No invoice data”, and dashboard KPIs link to their
  relevant modules. “Team Productivity” was relabeled “Active Projects” because the
  underlying value is a project count.
- `/portal` is currently an employee-authenticated client workspace preview. It
  loads the full client directory and supports switching between accounts. It does
  not yet provide client credentials or server-enforced organization isolation, so it
  must not be treated as an externally accessible client portal until those controls
  are implemented.
- Dashboard date-range filters and dedicated upcoming follow-up/recent activity
  panels are not present. The older implementation checkpoints describe workflow
  foundations, but do not establish that every page has been visually or end-to-end
  tested in a browser.
- Production readiness still depends on deployment configuration, database RLS and
  role-policy review, SMTP/provider configuration, and real multi-user acceptance
  checks. Local demo mode is not a shared production data store.
