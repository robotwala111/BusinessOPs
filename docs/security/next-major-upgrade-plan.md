# Next.js security upgrade plan

## Decision

The installed baseline is Next.js `14.2.35`, `eslint-config-next` `14.2.35`, React
`18.3.1`, and React DOM `18.3.1`. The non-mutating audit does not offer a complete
patched release in the current Next 14 major; its complete remediation target is
Next.js and `eslint-config-next` `16.3.4`. No forced audit fix was applied.

Keep the operational-feature work on the verified 14.2.35 baseline. Perform the
framework upgrade on a dedicated branch and deploy it independently after the
regression gate below passes.

## Compatibility work

1. Read the official Next 15 and 16 migration guides and record every applicable breaking change.
2. Upgrade Next and `eslint-config-next` together. Move React and React DOM to the versions required by Next 16 and update their type packages.
3. Replace deprecated synchronous request APIs (`cookies`, `headers`, route params and search params where applicable) and review server/client component boundaries.
4. Re-run the App Router route inventory, dynamic rendering, error/not-found boundaries, route handlers, redirects, and metadata generation.
5. Review middleware naming, runtime, configuration, and authentication redirects.
6. Review `next/image` remote patterns, sizing and optimisation, including PDF/print logos and signatures.
7. Migrate lint configuration to the supported ESLint workflow and retain the zero-warning CI rule.
8. Review `next.config`, TypeScript settings, build output, environment variables, and hosting runtime compatibility.

## Required regression gate

- All unit and service tests.
- Demo browser lifecycle E2E, including persisted calculations and CSV export.
- Supabase integration tests when credentials are available.
- Authentication, protected-route, middleware, and RLS smoke tests.
- Every App Router page and route-handler smoke test.
- Invoice/quotation PDF snapshot and numeric-total parity tests.
- Upload, signed-download, and image rendering tests.
- `npm run typecheck`, `npm run lint`, and `npm run build`.
- A new non-mutating `npm audit --json`; accepted residual findings must be documented.

## Rollback

Tag the last verified 14.2.35 build and retain its lockfile and deployment artifact.
Do not combine schema changes with the framework deployment. If production smoke
tests fail, redeploy that artifact and restore its lockfile; database rollback is
not required because this upgrade must not introduce migrations.
