# PF-021 Local Auth Runtime Review

Status: implementation complete; pending independent Orchestrator review.

## Scope

PF-021 connects the existing Vite/Worker application to a simulated local D1
binding and local-only Better Auth variables. It adds explicit preparation,
shared persistence locking and an isolated real-HTTP smoke. It does not add UI,
organization provisioning, remote resources, deployment configuration or a
usable committed secret.

## Implementation evidence

- `vite serve` selects `config/local/wrangler.jsonc`; builds continue to select the
  deliberately unwired `wrangler.jsonc`.
- The local binding has `remote: false`, a synthetic database ID and the same
  migrations as PF-017/PF-019. Remote bindings are disabled in the Vite plugin.
- `config/local/.dev.vars` remains ignored and outside the production config
  directory. Its adjacent example contains only `CHANGEME`, which fails the
  minimum secret validation. `dev:prepare` creates a random ignored value only
  when absent and does not replace an existing file.
- Vite and database tooling share `.wrangler/pf017-local` and
  `.wrangler/pf017-local.lock`. The lock records its owner and recovers only a
  verified dead-owner lock after forced termination. Startup does not migrate,
  seed or reset.
- The smoke uses a unique `.wrangler/pf021-smoke-*` state, applies migrations,
  starts the real Vite Worker, signs up a unique local user, stops Vite before
  adding an isolated organization membership through Wrangler, restarts Vite,
  and verifies login, response redaction, `/api/context`, logout and revocation.
  Its state and temporary secret (only when created by the smoke) are removed.

## Validation evidence (2026-09-16)

Run sequentially from the PF-021 worktree:

- `git diff --check`: pass.
- `npm run lint`: pass.
- `npm run typecheck`: pass.
- `npm run test`: 6 files and 115 tests pass.
- `npm run build`: production Worker and client builds pass; the build still
  uses `wrangler.jsonc`, not the local D1 configuration, and contains no copied
  `.dev.vars` file.
- `npm run db:generate`: 26 tables; no schema changes.
- `npm run db:check`: migration metadata, no drift and immutable PF-017 hashes
  pass.
- `npm run dev:prepare` twice: first applies all three migrations without seed
  or reset; second reports `No migrations to apply!` and keeps the existing
  ignored secret.
- `npm run db:inspect:local`: foreign keys enabled, no FK violations and all
  three migrations recorded. The development persistence remained unseeded.
- `npm run test:local-runtime`: pass with the real HTTP lifecycle described
  above. The isolated state is removed afterward.
- `npm run dev` plus `GET /api/health`: `200` with the expected service JSON.
  A concurrent `npm run db:inspect:local` is rejected by the shared lock.
- `npm audit --omit=dev`: reports the four known moderate Drizzle Kit findings.
- `npm audit --omit=dev --omit=optional`: zero vulnerabilities.

The Orchestrator must independently review the diff and evidence before changing
this status to PASS or integrating it.

## Known follow-up

- M4 remains open: login/logout UI, protected client routing and explicit
  organization provisioning are not part of PF-021.
- The existing four moderate Drizzle Kit development-tooling findings remain.
  Better Auth marks Drizzle Kit as an optional peer, so
  `npm audit --omit=dev --omit=optional` is the production-runtime check.
