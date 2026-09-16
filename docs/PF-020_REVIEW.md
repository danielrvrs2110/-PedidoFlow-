# PF-020 — Organization context and authorization handoff

Status: **PASS; pending orchestrator review and GitHub integration**.

## Scope implemented

- Shared server-only boundary verifies the Better Auth session from request
  headers, then queries active PedidoFlow membership joined to an active
  organization in D1.
- `OrganizationContext` contains only verified `organizationId`, `actorUserId`
  and organization-local `role`.
- Zero active memberships, invited membership and suspended organization return
  typed `403 no_access`; multiple active memberships return typed
  `403 selection_required`; no valid session returns `401 unauthenticated`.
- The centralized typed capability matrix distinguishes full operational reads
  from picker fulfillment reads and encodes owner-only owner management.
- `GET /api/context` is the only new route. It returns safe context identifiers
  for integration and later shell work; it never returns session material.

No organization provisioning, membership mutation, switching, business CRUD,
UI, OAuth, deployment, external infrastructure or migration was added.

## Isolation and security evidence

- Tests create five users and two simultaneously active organizations in one
  isolated ephemeral D1 runtime, plus invited and suspended fixtures.
- Client-supplied organization, actor and role values in query parameters and
  headers are ignored; the returned context comes from the session and D1.
- Multiple active memberships fail closed rather than selecting a row.
- Owner, admin, operator and picker allow/deny behavior is exhaustively checked
  across the declared capability set.
- The raw persisted session token and cookie name are absent from protected
  endpoint responses.

## Validation evidence

All runtime commands were sequential and used npm 11.19.1:

- clean install: 145 packages;
- lint and typecheck: pass;
- full suite: 6 files, 107 tests pass;
- focused authorization: 10 tests pass;
- focused authentication: 8 tests pass;
- focused database/tooling: 71 tests pass;
- production build and `git diff --check`: pass;
- Drizzle generation: 26 tables, no schema changes;
- `db:check`: no drift and immutable PF-017 hashes pass;
- local reset, migrate, second migrate, seed twice and inspect: pass;
- migration ledger remains exactly `0000`, `0001`, `0002`; foreign keys are
  enabled and `foreign_key_check` is empty.

`npm audit --omit=dev` reports the four known moderate Drizzle Kit findings
because the installed optional tooling chain is classified as `devOptional`.
`npm audit --omit=dev --omit=optional` reports zero. No forced breaking audit
fix was applied.

## Follow-up boundary

Organization selection remains intentionally unimplemented. A later task may
add validated switching. Protected React routes and login/logout UI also remain
separate; PF-020 provides the server boundary they must consume.
