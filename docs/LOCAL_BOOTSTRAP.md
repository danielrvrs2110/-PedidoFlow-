# Local First-Owner Bootstrap Contract (PF-023)

Status: accepted contract; no mutation command is implemented by this task.

## Purpose and boundary

PedidoFlow needs a reproducible way to create one usable owner account in a
developer's local D1 database. PF-023 defines that narrow boundary before any
bootstrap code is written.

This is development tooling, not product onboarding. It does not enable a
signup page, production or preview signup, invitations, organization switching,
billing, remote infrastructure, or a general member-management API. Production
provisioning remains a separate product and security decision.

## Required flow

The future command must be explicit and local-only:

```text
developer runs bootstrap command
  -> validate the fixed local config and managed persistence
  -> acquire the same local D1 lock used by dev/database tooling
  -> collect email, password, organization name and slug without CLI secrets
  -> start an owned local Worker on an ephemeral loopback port
  -> sign up or authenticate the local identity through Better Auth
  -> stop the Worker and confirm process exit
  -> create organization + active owner membership in one D1 batch
  -> verify login -> session -> organization context through the Worker
  -> stop the Worker and release the lock
```

It must never reset or seed the database. It must not run while `npm run dev`
or another managed database command owns the persistence.
Because the bootstrap itself owns that lock, it starts its internal Vite Worker
directly with the validated local config; it must not invoke the public
`npm run dev` wrapper and attempt to acquire the lock a second time.

## Environment gate

Before opening D1 or accepting credentials, the command must validate all of
the following:

- the checked-in local Wrangler config is selected;
- `PEDIDOFLOW_ENVIRONMENT` is exactly `local`;
- the D1 binding is `remote: false`, uses the fixed synthetic ID and points to
  the managed checkout-local persistence;
- remote bindings are disabled and no environment/config override is accepted;
- the auth origin is an owned ephemeral `127.0.0.1` URL;
- the migrations match the committed no-drift history.

Failure of any gate stops before mutation. The command accepts no arbitrary
database name, config path, persistence path, environment or remote flag.

## Inputs and secret handling

- Email, organization name and slug are explicit inputs and are normalized at
  the server/tool boundary before mutation.
- Password input is hidden interactive input or a test-only injected stream. A
  password must not be accepted as a command-line argument, logged, committed,
  written to a result file or included in an error.
- The existing ignored local Better Auth secret is reused only to run the owned
  local Worker. It is never printed or copied.
- Success output may show the normalized email, organization name/slug and IDs,
  but never the password, session cookie/token or auth secret.

Non-interactive production automation is not a goal. Tests use isolated input,
config and persistence and never open the developer database.

## Identity and organization semantics

The command must use Better Auth for password storage and identity creation; it
must not insert auth rows directly. After identity is verified, PedidoFlow owns
the organization transaction:

- create one active organization;
- create one active `owner` membership for the verified Better Auth user;
- perform those two D1 writes atomically;
- derive actor identity from the verified session, never from an untrusted
  user ID argument;
- generate opaque IDs locally and enforce the existing uniqueness/FK rules;
- create no customer, catalog, order, seed fixture or second membership.

Before creating anything, the authenticated user must have zero memberships.
The only exception is an exact retry state where the requested organization
already exists and that same verified user is its active owner; that returns a
verified no-op. Any different, additional or ambiguous membership fails closed.
The command also refuses a slug already owned by another organization. It
cannot attach an arbitrary existing user by email without successfully
authenticating that user's password.

## Retry and partial-failure policy

Better Auth identity creation and the later organization D1 batch cannot share
one transaction because the identity is created through the HTTP auth boundary.
Therefore retry behavior is explicit:

- if signup fails, no organization mutation runs;
- if the identity exists, the command must authenticate it rather than reveal
  whether it exists through a different public response;
- if the organization batch fails, the identity may remain without a
  membership; the command reports a safe retry instruction and does not delete
  the identity automatically;
- retry after successful authentication may complete the missing organization
  only when the user still has zero memberships and the requested slug is free;
- if a matching owner membership already exists, return a verified no-op;
- conflicting or ambiguous state fails closed for manual inspection.

No compensation deletes identity or organization records automatically.

## Validation requirements for implementation

Implementation is accepted only with evidence for:

1. local-only configuration and persistence validation before mutation;
2. hidden/no-log password handling and response/token redaction;
3. signup/authentication through the real Better Auth local Worker;
4. atomic organization plus owner membership creation;
5. exact zero-membership, existing-membership, duplicate-slug and retry paths;
6. two-tenant isolation and no client-supplied actor authority;
7. owned process shutdown before direct D1 access or cleanup;
8. isolated real-D1/HTTP tests that leave developer persistence untouched;
9. lint, typecheck, full tests, build, migration no-drift and dependency audit.

Tests must also scan captured stdout/stderr and HTTP payloads recursively to
prove that the submitted password, auth secret, cookies and persisted session
tokens never appear.

PF-023 itself records only this contract. Implementation requires a subsequent
focused task and independent security review.
