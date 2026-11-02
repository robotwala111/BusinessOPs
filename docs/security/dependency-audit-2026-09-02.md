# Dependency Audit — 2026-09-02

Command: `npm audit --json` from `frontend/`.

Result: 8 findings (7 high, 1 moderate), no critical findings.

| Package | Severity | Relationship | Remediation | Production relevance |
| --- | --- | --- | --- | --- |
| `next` | High | Direct production dependency | Audit proposes Next 16.3.4, a major framework upgrade | Relevant: advisories include App Router/RSC denial of service, request handling and SSRF cases. Upgrade requires a planned Next/React migration and regression pass. |
| `postcss` | High | Transitive through Next | Resolved through the proposed Next major upgrade | Build-time/CSS processing is relevant; application does not accept user-supplied CSS or source maps. |
| `eslint-config-next` | High | Direct development dependency | Audit proposes 16.3.4, a semver-major upgrade | Development/CI only; not shipped in the production runtime. Must remain aligned with Next. |
| `@next/eslint-plugin-next` | High | Transitive development dependency | Resolved with the eslint-config/Next major upgrade | Development/CI only. |
| `glob` | High | Transitive development dependency | Resolved with the eslint-config major upgrade | Advisory concerns the glob CLI command option; the application does not expose that CLI to users. |
| `brace-expansion` | High | Transitive dependency in lint tooling | Fixed transitive releases exist; audit can update parts of the tree but full resolution follows toolchain upgrade | Predominantly development/CI traversal; no application endpoint expands attacker-provided glob patterns. |
| `js-yaml` | High | Transitive development dependency | Fixed 4.3.1+; resolve through a compatible lint-tooling refresh | No production YAML ingestion path exists. |
| `dompurify` | Moderate | Transitive production dependency of PDF tooling | Fixed releases exist upstream; verify a compatible `jsPDF` dependency update | PDF generation uses structured application data and does not use DOMPurify `IN_PLACE` or custom-element hooks directly, reducing but not eliminating exposure. |

No `npm audit fix --force` was run. The audit's complete fix requires major Next and
eslint-config upgrades, which is not a safe unattended patch inside this lifecycle
change. Recommended remediation is a dedicated Next 14 -> supported Next release
migration with React compatibility checks, PDF regression tests and a repeat audit.

