# Operational automation and integration verification

## Database

Apply migrations in timestamp order through
`202609020018_create_operational_workflows.sql`. Migrations 016, 017, and 018 have
not been verified against a live Supabase project in this workspace.

## Manual automation trigger

The Notifications page exposes the safe development generator. It applies quotation
expiry rules and creates due/overdue notifications using deterministic deduplication
keys. This is not scheduled automation.

For production, invoke the same server-side operation from one authenticated,
single-owner scheduler (for example Supabase Cron/Edge Function). Run it at least
daily in the application's declared business timezone, log start/end/error counts,
and alert on missed runs. Do not expose a service-role key to the browser.

## Supabase integration environment

The future integration suite should use an isolated disposable Supabase project and
these CI secrets: `SUPABASE_TEST_URL`, `SUPABASE_TEST_ANON_KEY`,
`SUPABASE_TEST_SERVICE_ROLE_KEY`, `SUPABASE_TEST_DB_URL`,
`SUPABASE_TEST_USER_EMAIL`, and `SUPABASE_TEST_USER_PASSWORD`.

The intended command is `npm run test:integration`. That script and the integration
tests are not implemented yet, so this document is preparation only, not evidence
that migrations, RLS, transactions, storage, or signed URLs pass live verification.

The suite must reset only its disposable schema/data and cover migration application,
transactional lead and quotation conversion, number allocation concurrency,
milestone invoice concurrency, payment recalculation/reversal, RLS, private uploads,
signed URLs, and contract-version retention.
