# PedidoFlow Decision Log

## DEC-001 — Independent Product Repository

- Date: 2026-09-09
- Status: Accepted
- Decision: Treat this Git repository as the independent PedidoFlow product
  repository, not as a Solervia monorepo.
- Reason: Each Solervia product needs independent code, data, deployment, and
  development ownership.
- Consequence: Company-level standards are referenced through
  `SOLERVIA_CONTEXT.md`; customer data and product infrastructure remain
  isolated.
- Follow-up: The local directory is currently named `Solervia`; rename or move
  it later only through an explicit, verified repository-management task.

## DEC-002 — Cloudflare-Native TypeScript Baseline

- Date: 2026-09-09
- Status: Accepted
- Decision: Use React/Vite, Hono, Cloudflare Workers, Drizzle/D1, R2, and Better
  Auth as defined in the PedidoFlow-specific plan.
- Reason: The product is relational, low-volume initially, and should minimize
  idle cost across the Solervia portfolio.
- Alternatives preserved in source: Next.js/Supabase and generic Node hosting.
- Consequence: Generic examples elsewhere in the master document do not replace
  this stack.

## DEC-003 — Human Confirmation for AI Drafts

- Date: 2026-09-09
- Status: Accepted
- Decision: AI produces drafts and recommendations but cannot silently confirm
  an order.
- Reason: Ambiguous product language, pricing, inventory, and historical
  references create operational and financial risk.
- Consequence: Confidence, review reasons, original text, and manual correction
  are first-class domain and UX requirements.

## DEC-004 — `main` Is Production

- Date: 2026-09-09
- Status: Accepted
- Decision: Use `main` as the production branch and focused feature branches for
  meaningful work.
- Consequence: Work must pass task-appropriate validation before merge.

## DEC-005 — Exact Numeric Storage

- Date: 2026-09-11
- Status: Accepted
- Decision: Store money as integer minor units, operational quantities as
  integer milli-units, and AI confidence as integer basis points.
- Reason: SQLite floating-point values are unsuitable for auditable money and
  exact operational comparisons.
- Consequence: Application boundaries format and validate decimal input; schema
  checks and domain services operate on exact integers.

## DEC-006 — Composite Tenant Relationships

- Date: 2026-09-11
- Status: Accepted
- Decision: Tenant-owned parent/child relationships include
  `organization_id` in foreign and unique keys even though opaque IDs are
  globally generated.
- Reason: Query conventions alone do not prevent a child from referencing a
  resource in another tenant.
- Consequence: Drizzle schema, repositories, seeds, and tests carry explicit
  organization context and prove cross-tenant relationships fail.

## DEC-007 — Local Foundation and Historical Guards

- Date: 2026-09-11
- Status: Accepted at PF-017 Orchestrator review on 2026-09-13.
- Decision: Keep PF-017 D1 tooling in a dedicated local configuration and
  persistence directory. Use a generated Drizzle foundation and a versioned
  custom trigger migration for append-only events and confirmed price snapshots.
- Reason: Local reset/seed must not target future production bindings, and SQL
  checks/FKs alone cannot prevent rewriting historical rows.
- Consequence: No runtime HTTP integration or remote resource is added. Future
  domain transactions must respect `confirmed_at` as the snapshot boundary.
  Drizzle snapshots do not model triggers; their SQL is tested directly in D1.
- Alternatives: Application-only history protection would not protect against
  accidental raw updates. A separate database/runtime would depart from the
  approved stack and is unnecessary. This choice adds no provider cost.

## DEC-008 — Identity and Domain Authorization Boundary

- Date: 2026-09-15
- Status: Accepted as the PF-018 implementation contract.
- Decision: Better Auth owns users, accounts, verification records and
  database-backed opaque sessions. PedidoFlow owns organizations, memberships,
  roles and business authorization. The first implementation uses same-origin
  cookies and does not use stateless JWT sessions, secondary storage,
  cross-subdomain cookies or Better Auth's organization plugin.
- Reason: The domain schema already defines tenant membership and role
  invariants. Keeping identity separate avoids duplicate ownership while
  server-derived membership context protects every business query.
- Consequence: Better Auth's exact versioned schema must be generated into a new
  migration. A session alone never grants tenant access; middleware must verify
  active membership and organization state before constructing repository
  context. Session cookie caching starts disabled to preserve prompt revocation.
- Alternatives: The organization plugin would duplicate the current membership
  model. Stateless JWTs or a secondary store would add revocation complexity or
  infrastructure without an MVP requirement.

## DEC-009 — Local Auth Runtime Configuration Boundary

- Date: 2026-09-16
- Status: Proposed by PF-021; pending final Orchestrator review.
- Decision: Use a separate, local-only Wrangler configuration for `vite serve`,
  with a synthetic `remote: false` D1 binding and the same managed persistence
  as local database tooling. Keep build/deploy input on `wrangler.jsonc`, which
  has no invented remote binding. Generate the ignored local auth secret and
  apply migrations only through an explicit preparation command.
- Reason: The real Worker auth routes need D1 and server bindings during local
  development, while a fake deployable database ID or committed secret would
  make the environment boundary unsafe. Shared state also makes CLI migrations
  visible to Vite without a second database copy.
- Consequence: Local database tools and Vite are serialized and cannot run over
  the managed persistence simultaneously. Starting development never resets,
  migrates or seeds data. Preview/production remain deliberately unwired until
  remote infrastructure is explicitly authorized. Vite preview follows the
  principal configuration and cannot inherit the local signup environment.
- Alternatives: Programmatic bindings would not serve Wrangler D1 commands;
  committed secrets are unsafe; separate CLI and Vite state would make local
  setup non-reproducible.
