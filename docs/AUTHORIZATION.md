# Authentication and Authorization Contract (PF-018)

Status: accepted contract; PF-019 identity/session and PF-020 organization
authorization foundations are implemented. UI and provisioning remain pending.

## Purpose

This contract defines the boundary between Better Auth identity/session data and
PedidoFlow organization authorization. It must be implemented before business
CRUD or a real protected `/app/*` experience is exposed.

The first implementation milestone exercises email/password authentication in
tests and local development only. Signup must fail closed in preview and
production until a later provisioning/onboarding task defines who may create an
account and the first organization membership. PF-019 creates neither an
organization nor a membership implicitly. OAuth, invitations, password reset
email delivery, multi-organization switching, 2FA and production account
provisioning are later tasks unless separately approved.

## Ownership Boundary

Better Auth owns its generated and version-pinned tables for users, sessions,
accounts and verification records. PedidoFlow owns `organizations` and
`organization_members` from the domain migration.

Do not hand-write an approximation of Better Auth's schema. PF-019 must install
a reviewed stable Better Auth version, generate its exact Drizzle schema, and
add it through a new immutable migration. PF-017 migrations must not be edited.

The Better Auth organization plugin is not part of the first implementation.
It would duplicate membership ownership and is unnecessary for the four roles
already defined by PedidoFlow. Reconsider it only through an explicit migration
and compatibility review.

## Session Contract

- Use database-backed, opaque cookie sessions on the same origin as the SPA and
  Worker API. Do not introduce stateless JWT sessions or secondary storage.
- Keep Better Auth's CSRF, Fetch Metadata and origin checks enabled.
- Configure an explicit allowlist for local and deployed application origins;
  never reflect an arbitrary request origin.
- Session cookies remain HTTP-only. Production cookies are secure and use the
  narrowest host/path scope supported by the integration.
- Do not enable cross-subdomain cookies without a demonstrated deployment need.
- Do not put organization IDs, roles, secrets or authorization decisions in
  browser-readable storage.
- A session identifies a user only. It does not prove organization access.
- Logout revokes the current session and clears its cookie. A user disabled by
  a capability supported by the pinned Better Auth version, or a removed or
  non-active membership, must fail authorization on the next server request.
- Cookie session caching is disabled initially so membership/session revocation
  is checked against D1. A short cache can be considered later with an explicit
  revocation-risk analysis.

Session secrets are server-only environment values. `.env.example` may name
required variables but must never contain a usable secret.

### Local runtime

PF-021 wires `npm run dev` to `config/local/wrangler.jsonc`, which contains only a
synthetic D1 ID with `remote: false`, the local environment marker and explicit
localhost origins. The auth secret stays in ignored
`config/local/.dev.vars`; the committed adjacent `.dev.vars.example` marker is
deliberately too short to pass binding validation. Keeping the local secret next
to the local config also prevents production builds from copying it into their
preview-only output.
`npm run dev:prepare` creates a random local-only secret if the file is absent
and applies pending migrations to the shared local persistence. It never resets
or seeds data. `npm run dev` requires that explicit preparation and performs no
implicit database mutation.

The local Worker and database commands are serialized by the same project lock.
Stop the development server before running migration, seed, inspect or reset
commands. Signup remains enabled only because the bound environment is exactly
`local`; none of this configuration provisions a preview or production account.

## Organization Context

Every protected business request derives its context server-side:

```text
request cookies
  -> verified Better Auth session
  -> active PedidoFlow membership
  -> active organization
  -> OrganizationContext { organizationId, actorUserId, role }
  -> tenant-scoped repository/service
```

An organization ID from a body, query, route parameter, header or local storage
is never proof of membership. If a future request selects among multiple
memberships, the server validates that selection before constructing context.

The first implementation may choose the only active membership. If a user has
zero active memberships, authentication succeeds but application access returns
an explicit onboarding/no-access state. If multiple active memberships exist
before switching is implemented, fail closed with an explicit selection-required
response; do not silently choose the first database row.

Suspended organizations and non-active memberships cannot construct an
operational context. In the current schema, `invited` is the only non-active
membership state. Cross-tenant missing and forbidden resources use the same
not-found response so IDs are not disclosed.

## Roles and Capabilities

Roles are organization-local and ordered by capability, not by global identity.

| Capability | Owner | Admin | Operator | Picker |
|---|:---:|:---:|:---:|:---:|
| Read operational data | Yes | Yes | Yes | Limited fulfillment views |
| Manage catalog, customers and pricing | Yes | Yes | Yes | No |
| Create and review order drafts | Yes | Yes | Yes | No |
| Confirm an order as a human action | Yes | Yes | Yes | No |
| Update picking/fulfillment state | Yes | Yes | Yes | Yes |
| Manage members and roles | Yes | Yes, except owners | No | No |
| Change organization settings | Yes | Yes | No | No |
| Suspend/delete organization | Later explicit policy | No | No | No |

The matrix is the default authorization floor. Later domain tasks may narrow a
capability. No frontend control grants permission; each server mutation checks
the required capability after constructing organization context.

Owner retention is transactional: the final active owner cannot be removed,
demoted or deactivated. An admin cannot create, promote, demote or remove an
owner. Invitations and ownership transfer are deferred from the first auth
implementation.

## HTTP Boundary and Errors

- Mount Better Auth under `/api/auth/*`; unknown `/api/*` routes keep structured
  JSON 404 behavior and client routes keep the SPA fallback.
- Protected domain APIs live outside the auth mount and use shared session plus
  membership middleware. Public health/auth routes must be explicitly listed.
- Safe reads may return `401` when no valid session exists. Authenticated users
  without a valid organization context receive `403` or a typed no-access
  response. Tenant resource lookup uses `404` for absent and cross-tenant IDs.
- Mutations validate JSON/body shape before domain execution and never accept
  actor IDs from clients.
- Logs may contain correlation IDs and safe error codes, but not passwords,
  session tokens, cookies, reset tokens or full customer payloads.

## UI Contract

- Anonymous navigation to `/app/*` redirects to `/login` without rendering a
  flash of protected content.
- Login presents specific field validation but a generic invalid-credentials
  response. It must not reveal whether an email exists.
- Authenticated users return to an allowed local route only. External or
  protocol-relative return URLs are rejected.
- The shell displays the verified organization and member role only after the
  server context is available. It must not show a fake organization switcher.
- Expired/revoked sessions produce a recoverable sign-in state. Authorization
  denial is distinct from network and server failures.

## Security Requirements

- Use Better Auth password hashing and session mechanisms; do not implement
  custom password storage, cookie signing or token formats.
- Keep origin and CSRF checks enabled and add focused tests that reject an
  untrusted origin for state-changing auth requests.
- Apply conservative rate limits to login before public deployment. Signup is
  enabled only in test/local and must fail closed elsewhere until provisioning
  is explicitly implemented; do not add a paid service for this foundation.
- Normalize email through Better Auth's supported behavior and enforce its
  generated uniqueness contract.
- Never return password hashes, account tokens, session tokens or verification
  records from application endpoints.
- Secret rotation, email verification policy, password reset delivery and data
  retention require explicit production-readiness tasks.

## Implementation Sequence

PF-019 integrated the pinned Better Auth identity/session foundation. PF-020
adds the verified organization context and centralized role/capability floor.
Subsequent small tasks may add login/logout UI and protected-route behavior,
then provisioning and validated organization switching under explicit scopes.

## Acceptance Criteria for PF-019

1. The installed Better Auth version and official D1/Drizzle integration are
   documented and locked.
2. Generated auth schema is reviewed and added with a new migration; PF-017 SQL
   and metadata are unchanged.
3. Test/local signup, login, session lookup and logout work through
   `/api/auth/*`; signup fails closed in preview/production configuration.
4. Duplicate email and invalid credentials fail without account enumeration.
5. Session and password material never appears in logs or API responses.
6. Existing health, API 404 and SPA fallback routing continue to work.
7. Tests use isolated persistence and run sequentially where D1 runtimes could
   conflict.
8. Lint, typecheck, unit/integration tests, build, migration no-drift checks and
   production-only dependency audit pass.

PF-019 does not create organizations or memberships and does not claim
organization authorization complete. That requires the membership middleware,
an explicit provisioning/onboarding task and two-tenant authorization tests.

## References Verified 2026-09-15

- [Better Auth database and generated schema](https://better-auth.com/docs/concepts/database).
- [Better Auth Drizzle adapter](https://better-auth.com/docs/adapters/drizzle).
- [Better Auth session management](https://better-auth.com/docs/concepts/session-management).
- [Better Auth cookies](https://better-auth.com/docs/concepts/cookies).
- [Better Auth options](https://better-auth.com/docs/reference/options), including
  CSRF and origin checks. PF-019 must reverify these references against the
  exact pinned package version before implementation.
