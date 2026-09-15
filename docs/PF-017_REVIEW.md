# PF-017 — Database foundation handoff

Status: **PASS WITH FOLLOW-UP**. Orchestrator review accepted on 2026-09-13.
Implementation reviewed: `29e0da44cbe4a2b60ea5e6675d577fb12e9f0563`.
The four moderate development-tooling findings remain tracked; acceptance
criteria pass. Integration is the next gate, before authentication work.

The evidence below records the implementation handoff before integration.

## Git and workspace

- Worktree: `/Users/danielgonzalez/.codex/worktrees/23f4/Solervia`.
- Branch: `codex/feature/pf-017-database`.
- Base: `24f79be481be3c9b7337bcba48f7e05ff6d312aa` (local `main`, PF-016).
- Origin: `https://github.com/danielrvrs2110/-PedidoFlow-.git`.
- Implementation commit: `29e0da44cbe4a2b60ea5e6675d577fb12e9f0563`,
  `feat: implement tenant-first local database foundation`.
- Main checkout stayed on `main` at the base commit, with no changes.
- No push, PR, merge, deployment, account setup or remote resource mutation.
  Remote repository synchronization and billing were not reverified.

The resumed worktree already contained the database implementation but had no
implementation commit or review report. This run inspected the implementation,
repeated validation, fixed the test runner configuration and completed the
handoff. Earlier unverified test counts were replaced with current results.

## Changed files

- `worker/db/schema/index.ts`, `worker/db/schema/helpers.ts`: 22 domain tables,
  exact numeric checks, enum checks, organization keys, composite FKs and indexes.
- `worker/db/migrations/0000_foundation.sql`,
  `worker/db/migrations/0001_history_guards.sql`,
  `worker/db/migrations/meta/0000_snapshot.json`,
  `worker/db/migrations/meta/0001_snapshot.json`,
  `worker/db/migrations/meta/_journal.json`: generated schema and versioned
  custom append-only/snapshot history guards.
- `worker/db/repository.ts`: required organization/actor context, scoped product
  lookup/activation and alias deletion; alias normalization.
- `worker/db/seed.sql`: 44 deterministic development inserts across two tenants.
- `worker/db/database.test.ts`: 71 D1 and local-tooling tests.
- `scripts/db/local.mjs`, `scripts/db/check.mjs`, `drizzle.config.ts`,
  `wrangler.database.json`: local lifecycle, lock, configuration validation,
  migration metadata and generation reproducibility checks.
- `package.json`, `package-lock.json`: pinned Drizzle dependencies and commands;
  existing direct dependency versions preserved.
- `vitest.config.ts`, `tsconfig.node.json`: separate Node test environment with
  React JSX support and type-checked tooling configuration.
- `README.md`, `docs/DATABASE.md`, `docs/DECISIONS.md`, `docs/TASKS.md`,
  `docs/PF-017_REVIEW.md`: reproducible usage, decision and review evidence.

No application UI, navigation, HTTP routes, Better Auth tables or preserved
master sources changed. Local persistence, dependencies and build output are
ignored by Git.

## Acceptance matrix

| # | Criterion | Evidence | Result |
|---|---|---|---|
| 1 | Complete initial migration on empty D1 | Reset followed by Wrangler application: 0000 and 0001 successful; 22 domain tables | PASS |
| 2 | Safe second application | Second migrate returned `No migrations to apply!`; ledger contains exactly two migrations | PASS |
| 3 | Reproducible generation/no drift | Generate reported no schema changes; check verified metadata, copied history and fresh initial SQL/snapshot | PASS |
| 4 | Repeatable seed | Both CLI runs executed 44 statements; D1 test compares all 22 tables before/after reseeding, two rows each | PASS |
| 5 | Money, quantity, states, snapshots | D1 tests reject negative/fractional/unsafe values, invalid enums, missing snapshots; catalog price edits preserve order snapshots | PASS |
| 6 | Cross-tenant reads/mutations | Tenant A cannot read/update tenant B products or delete tenant B aliases; own-tenant controls succeed | PASS |
| 7 | Composite tenant FKs | Mutable relationships reject crossed references; history inserts and order item links reject crossed IDs | PASS |
| 8 | Remote target rejection | All four commands reject seven extra-argument forms; altered remote config and symlink persistence fail before Wrangler | PASS |
| 9 | Quality gates | Lint, typecheck, 88 tests and production build exit 0 | PASS |
| 10 | Reproducible documentation | README quick start and DATABASE exact sequential lifecycle and safety rules | PASS |

## Commands and observed results

Commands ran sequentially in the specialist worktree. No two workerd instances
used the same persistence. Runtime: Node `v24.15.0`; default npm `11.12.1`.
The install explicitly used npm `11.19.1` as requested.

| Command | Exit | Observed result |
|---|---:|---|
| `npx -y npm@11.19.1 ci` | 0 | 124 packages added, 125 audited; four moderate development findings |
| `npm run lint` | 0 | oxlint passed |
| `npm run typecheck` | 0 | TypeScript project build passed |
| `npm run test` | 0 | 4 files, 88 tests passed |
| `npm run build` | 0 | Worker and React client production bundles built |
| `git diff --check` | 0 | No whitespace errors |
| `npm run db:generate` | 0 | 22 tables; no schema changes |
| `npm run db:check` | 0 | PASS: metadata, no drift, reproducible initial SQL/snapshot |
| `npm run db:reset:local` | 0 | Removed only worktree `.wrangler/pf017-local` |
| `npm run db:migrate:local` (first) | 0 | Both migrations successful; 76 and 10 commands respectively |
| `npm run db:migrate:local` (second) | 0 | No migrations to apply |
| `npm run db:seed:local` (first) | 0 | 44 commands successful |
| `npm run db:seed:local` (second) | 0 | 44 commands successful |
| `npm run db:inspect:local` | 0 | FK enforcement 1, zero FK violations, two organizations, one product each, two ledger rows |
| `npm run test:db` | 0 | 1 file, 71 tests passed |
| `npm audit --omit=dev` | 0 | Zero vulnerabilities |

The first test attempt failed at startup because Vitest injected
`resolve.external` into the Cloudflare application environment. The dedicated
`vitest.config.ts` fixes this without changing application Vite configuration.
Lint/typecheck/tests/build and the full database lifecycle passed afterward.

The install also reported deprecated Drizzle tooling transitive packages and
unapproved install scripts for transitive esbuild 0.18.20/0.25.12. Generation and
checks succeeded without approving extra scripts. No forced audit fix, package
upgrade or RC migration was used. See DATABASE for the tooling advisory.

## Isolation and limitations

Real local D1 reports `PRAGMA foreign_keys = 1` and an empty
`PRAGMA foreign_key_check`. The seed organizations are `org_dev_valle` and
`org_dev_abastos`, both visibly labelled DESARROLLO. They reuse business
identifiers across tenants while same-tenant duplicates are rejected.

Repository context is an internal API requirement, not proof of authorization.
Authentication must later verify membership and role. There is no HTTP path
accepting a client organization ID. Raw SQL remains privileged; D1 RLS is not
claimed. Suspended organizations cannot use the provided mutation methods.

Local commands accept zero extra arguments, validate the fixed development
configuration, force local Wrangler execution and fixed persistence, reject
symlinks, and acquire a project lock. Locking does not cover manually launched
external processes; stale-lock recovery is documented.

Pending domain services include confirmation atomicity, complete/locked line
sets, legal lifecycle transitions, audit/stock transaction coupling, interval
overlap checks, owner retention, authorization, totals/rounding and payment
consistency. These are explicitly deferred, not implemented guarantees.

The local seed import is not promised as a whole-file transaction. Its fixed-ID
inserts do not overwrite data; reset/migrate/seed restores exact fixtures.

No blocking findings remained after static review and live validation. Four
moderate development-only dependency findings remain a follow-up. GitHub's
older PR summary and differing milestone numbering are flagged in TASKS rather
than silently reconciled or presented as additional completed work.
