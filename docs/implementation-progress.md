# Implementation Progress

## Baseline

- Existing implementation audit: `docs/architecture/implementation-audit.md`.
- Frontend baseline: `npm run typecheck` passed; `npm test` passed (23 tests).
- No live Supabase project or integration-test environment is configured.

## Completed

- Demo auth messaging and authentication fallback now distinguish demo mode from missing production configuration.
- Demo record reads/writes and generated-number fallback now fail explicitly in production if Supabase is unavailable.
- Vitest now resolves the frontend `@/` alias; added a production demo-persistence regression test.
- Validation passed: `npm run typecheck`, `npm test` (24 tests), `npm run lint`, and `npm run build`.
- Added forward migration `022` to reset untrusted existing admin roles, default new profiles to `staff`, prevent self-role changes, and let admins manage profiles.
- Production registration is disabled in the UI and registration action; setup/deployment docs now require disabled Supabase public signups and trusted invitations.

## In progress

- Migration `022` is prepared but not applied; the live Supabase project remains unchanged.
- Live database policy tests remain unavailable without a disposable Supabase test project.

## Prioritized gaps

1. Migration `022` addresses role escalation; it resets existing profiles to staff, so trusted admins must be explicitly re-promoted. Until applied, the live database is unchanged.
2. This is a single-company deployment; authenticated staff share business records by design.
3. Calendar and dedicated reporting routes are not present; the dashboard is the current reporting surface.
4. Scheduled notifications and live Supabase integration tests are not configured.

## Blockers and next actions

- Disable public signups and configure trusted user invitations in Supabase before production.
- Review/apply migration `022` only after identifying trusted admins; verify profile-role policies with a disposable Supabase project first.
- Then address storage path authorization, workflow gaps, scheduled automation, and end-to-end coverage.

Only a forward migration was added; no existing migration was changed or removed. No deployment has been performed.
