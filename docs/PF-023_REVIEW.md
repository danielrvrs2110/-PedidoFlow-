# PF-023 Local Bootstrap Contract Review

Status: PASS after Orchestrator review.

## Reviewed scope

PF-023 is documentation only. It defines a local first-owner bootstrap boundary
and intentionally adds no command, route, UI, migration, remote resource or
production provisioning policy.

## Findings resolved

- Clarified that the future bootstrap owns the shared local D1 lock and must
  start its internal Worker directly rather than deadlocking through the public
  development wrapper.
- Reconciled retry semantics: creation requires zero memberships, while only an
  exact already-created organization plus active-owner state is a safe no-op.
  Different or ambiguous memberships fail closed.
- Added recursive stdout/stderr and HTTP-payload checks for password, auth
  secret, cookie and persisted-session-token leakage.

## Contract evidence

- Preview and production signup remain fail closed.
- The fixed local config, synthetic D1 ID, `remote: false`, loopback origin and
  checkout-local persistence are mandatory before input or mutation.
- Better Auth remains the only password/identity writer.
- Organization plus active owner membership must be one D1 batch derived from
  the verified session actor.
- Passwords are forbidden in command arguments, logs, files and result output.
- Partial identity creation has an explicit retry boundary and never triggers
  destructive compensation.
- Tests must use isolated persistence and an owned Worker lifecycle without
  opening the developer database.

`git diff --check` passed. No runtime validation is claimed because PF-023
changes no executable code.

## Follow-up

Implementation must be a separate focused task with real D1/HTTP lifecycle,
secret-leak assertions and independent security review before integration.
