# PF-024 Review Handoff

Status: PASS after corrective independent security review; integrated through
PR #15 at `4c42cf6` on 2026-10-22.

## Scope

PF-024 implements the accepted local-only first-owner bootstrap contract. It
adds no application route, signup UI, remote binding, migration, reset, seed,
organization switcher or production provisioning mechanism.

## Review focus

- `scripts/bootstrap/local-owner.mjs` validates the fixed local configuration,
  migration history, checkout-local persistence, and the ignored secret's
  regular-file, ownership, mode and exact contents before collecting
  credentials or opening D1.
- The public command accepts no arguments. Password input is a hidden TTY;
  only tests inject input into the orchestration function.
- The command owns the existing local lock, creates its own uninjectable
  `mkdtemp` runtime, starts Vite through a bootstrap-owned configuration on an
  ephemeral loopback port, and awaits process exit before Wrangler accesses D1.
- Better Auth performs signup/sign-in and the verified session supplies the
  user ID. The tool never inserts Better Auth rows.
- Organization and owner membership statements are submitted together in one
  Wrangler/D1 batch. Exact retry is a verified no-op; duplicate slug and other
  membership states fail closed.
- Final real HTTP sign-in, session and `/api/context` checks prove the created
  owner context. Returned/logged material excludes password, auth secret,
  cookies and persisted session tokens.
- SIGINT/SIGTERM abort the pending mutation boundary, stop the owned process,
  remove only the internally created temporary runtime and release the lock.

## Test coverage

`scripts/bootstrap/local-owner.test.ts` copies the checkout into an isolated
temporary root, links only the installed dependencies, and drives the real
production command through a pseudo-TTY. There is no exported test execution
API or injectable cleanup, validation or lock target. It covers normalization, override
rejection, new identity, exact no-op, simulated post-identity/pre-batch failure
and retry, duplicate slug, existing conflicting membership, two distinct
tenants, process-owned HTTP verification, and recursive secret/token capture.
Developer persistence is never selected by the test harness.
The suite also forces SIGTERM immediately before mutation and proves no
organization is created. It forces the second statement of a real local
Wrangler D1 batch to fail a role CHECK and confirms the first organization
INSERT is rolled back.

## Invariants

- Applied migrations `0000`, `0001` and `0002` are unchanged and no migration
  was added.
- Normal development, preview/build selection and SPA/API routing are
  unchanged. PF-024 adds no exception to the shared Vite runtime selector.
- The new `source-map-js` advisory is resolved by a narrow `1.2.2` transitive
  override. `npm audit --omit=dev --omit=optional` reports zero findings.

## Validation

Validated sequentially with npm 11.19.1:

- `npm run lint -- --deny-warnings`: pass, zero warnings.
- `npm run typecheck`: pass.
- `npm run test`: 8 files / 146 tests passed on the final corrective rerun.
- focused PF-024 plus runtime selector: 10/10 passed, including real HTTP/D1
  lifecycle, SIGTERM cleanup and batch rollback.
- `npm run build`: pass; Worker and client production bundles generated.
- `npm run db:check`: pass; metadata, no drift and immutable migration hashes.
- `npm run test:local-runtime`: pass; signup/login/session/context/logout and
  revocation through the existing isolated smoke.
- `git diff --check`: pass.
- `npm audit --omit=dev --omit=optional`: zero findings after pinning
  `source-map-js` 1.2.2. Remaining full-audit findings are tooling/optional
  paths and do not add a production runtime dependency.

## Corrective review history

The first two independent review passes returned FAIL with tooling findings: an
injectable cleanup target guarded only by `NODE_ENV=test`, incomplete signal
cleanup, insufficient `.dev.vars` validation, and a path-pattern exception in
the shared runtime selector; the second pass further identified the remaining
exported test API, startup-signal ownership gap and secret-file TOCTOU window.
The final corrective diff removes all injected execution APIs, drives tests
through the production TTY command in isolated copied checkouts, makes startup
own cleanup before returning, validates and reads the secret through one
`O_NOFOLLOW` descriptor, writes an owned mode-`0600` runtime copy, and uses a
dedicated temporary Vite config. The final independent pass verified that the
validation and lock helpers are internal and that tests exercise rejection only
through the public process. No blocking findings remain; integration is the
remaining gate.
