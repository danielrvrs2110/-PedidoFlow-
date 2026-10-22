# PedidoFlow Project State

Last updated: 2026-10-22

## Completed

- [x] PF-001 Copy `PEDIDOFLOW_MASTER.md` into the repository.
- [x] PF-002 Rename the production branch from `master` to `main`.
- [x] PF-003 Create the repository-level `AGENTS.md` operating map.
- [x] PF-004 Establish the minimum durable project documentation.
- [x] PF-005A Align local `main` with the existing GitHub history.
- [x] PF-005 Create the initial documentation baseline commit.
- [x] PF-006 Publish the documentation baseline to GitHub.
- [x] PF-007 Record the verified publication state on `main`.
- [x] PF-008A Activate a Node.js runtime compatible with the current Cloudflare
  scaffolder.
- [x] PF-008 Scaffold the React/Vite and Cloudflare Worker foundation.
- [x] PF-009 Publish the validated foundation branch for review.
- [x] PF-010 Review the foundation diff and merge it into `main`.
- [x] PF-011 Define PedidoFlow design-system foundations and operational UX
  constraints.
- [x] PF-012 Implement approved design tokens and the first reusable UI
  primitives.
- [x] PF-013 Establish the responsive application-shell design and navigation
  contract.
- [x] PF-014 Implement the responsive application shell without business CRUD.
- [x] PF-015 Define the dashboard, Inbox, and parsed-order review UX contract
  for desktop and mobile.
- [x] PF-016 Define the tenant-first D1/Drizzle data model, invariants, and
  migration boundary.
- [x] PF-017 Implement Drizzle schema, generated migrations, safe local seed
  tooling, and tenant-isolation validation. Integrated through PR #8 at
  `4cf3f08`; review: `docs/PF-017_REVIEW.md`.
- [x] PF-018 Define the authentication and authorization contract before
  integrating Better Auth. Contract: `docs/AUTHORIZATION.md`; decision:
  DEC-008.
- [x] PF-019 Integrate the pinned Better Auth/D1 identity and database-backed
  session foundation without business CRUD or organization provisioning.
  Integrated through PR #10 at `018a683`; review: `docs/PF-019_REVIEW.md`.
- [x] PF-020 Implement server-derived organization context and centralized
  role/capability authorization. Integrated through PR #11 at `793371e`;
  review: `docs/PF-020_REVIEW.md`.
- [x] PF-021 Wire the Vite Worker to a strictly local D1 binding and safe local
  auth variables, with explicit preparation and an isolated end-to-end HTTP
  smoke. Integrated through PR #12 at `ad767f7`; review:
  `docs/PF-021_REVIEW.md`.
- [x] PF-022 Implement login/logout UI and protected `/app/*` client routing
  against the existing session and organization-context APIs, without signup
  or organization provisioning. Integrated through PR #13 at `f82386a`;
  review: `docs/PF-022_REVIEW.md`.
- [x] PF-023 Define the local-only first-owner bootstrap contract and
  implementation boundary. Integrated through PR #14 at `3d40758`; contract:
  `docs/LOCAL_BOOTSTRAP.md`; review: `docs/PF-023_REVIEW.md`.
- [x] PF-024 Implement the local-only first-owner bootstrap command with
  isolated D1/HTTP and secret-leak tests. Integrated through PR #15 at
  `4c42cf6`; review: `docs/PF-024_REVIEW.md`.
- [x] PF-025 Define the tenant-scoped product catalog and manual-alias API/UX
  contract before implementation. Integrated through PR #16 at `48fbe10`;
  contract: `docs/PRODUCT_CATALOG.md`; decision: DEC-011.
- [x] PF-026 Implement the accepted product and manual-alias repository/HTTP
  contract with isolated two-tenant D1 tests. Integrated through PR #17 at
  `d95533b`; review: `docs/PF-026_REVIEW.md`.
- [x] PF-027 Implement the responsive product catalog UI against the accepted
  PF-026 API. Integrated through PR #18 at `5e2468a` after full validation
  and browser QA; review: `docs/PF-027_REVIEW.md`.
## Current

- [ ] PF-028 Define the tenant-scoped customer and delivery-address API/UX
  contract before implementation. Use the accepted schema and authorization
  model; keep pricing, orders, imports and production onboarding outside scope.

## Next

- Write and independently review PF-028, including validation, default-address
  invariants, cross-tenant behavior, mobile states and implementation gates.

## Blocked

- None.

## Technical Debt

- Eleven current full-audit findings remain in development/optional Drizzle and
  Cloudflare tooling paths; `npm audit --omit=dev --omit=optional` reports zero.
  See `docs/DATABASE.md`.
- The local directory is named `Solervia`; the Git repository is being treated as the independent PedidoFlow product repository.

## Important Decisions

- PedidoFlow uses the product-specific stack defined in `PEDIDOFLOW_MASTER.md`.
- `main` is the production branch.
- Autonomous execution is active: the Orchestrator performs safe in-scope work
  directly and pauses only for genuine user intervention.

## Monthly Cost

- Current verified project cost: $0/month; no infrastructure has been provisioned.

## Deployment Status

- Not deployed.

## Validation Evidence

- PF-008: Node `22.23.2`; clean npm 11 installation; 0 audit findings;
  lint, 2 API tests, typecheck, and production build pass.
- PF-008 browser QA: desktop and 390 x 844 mobile views render meaningful
  content without an error overlay or horizontal overflow; `/api/health`
  returns the expected JSON response.
- PF-008 routing QA: unknown `/api/*` paths return structured JSON 404s while
  direct client-side paths return the SPA HTML fallback.
- PF-011: design principles, visual tokens, operational density, domain states,
  responsive behavior, accessibility baseline, Figma structure, and review
  criteria are documented in `docs/DESIGN_SYSTEM.md`.
- PF-012: Tailwind 4 design tokens and reusable Button, Badge, and Alert
  primitives pass 5 tests, lint, typecheck, build, npm audit, and desktop/mobile
  browser QA.
- PF-013: route hierarchy, desktop/mobile navigation, responsive behavior,
  accessibility, failure states, implementation boundary, and acceptance
  criteria are defined in `docs/APP_SHELL.md`.
- PF-014: the responsive shell renders all top-level routes, desktop and mobile
  navigation, accessible native-dialog drawers, active states, focus handling,
  explicit development states, and application/public 404 pages. Lint,
  typecheck, 17 tests, production build, npm audit, and browser QA at 1440 x 900,
  900 x 800, and 390 x 844 pass without console errors or horizontal overflow.
- PF-015: dashboard priorities, the desktop/mobile Inbox flow, parsed-line
  review, correction and confirmation gates, failure states, accessibility, and
  manual-order-before-AI sequencing are defined in `docs/SIGNATURE_UX.md`.
- PF-016: table ownership, exact numeric representation, composite tenant
  relationships, lifecycle and history invariants, indexes, auth separation,
  migration boundary, and implementation acceptance criteria are defined in
  `docs/DATA_MODEL.md`; DEC-005 and DEC-006 record the material decisions.

- PF-017: 22 domain tables, generated SQL/metadata, local history guards,
  deterministic two-organization seed, 71 D1/tooling tests (88 total tests),
  lint, typecheck, build, migration generation/check and repeated local
  migration/seed pass. Review accepted with development-tooling follow-up;
  see `docs/PF-017_REVIEW.md`.
- PF-017 integration: sequential validation repeated on 2026-09-15 with 88
  total tests and 71 D1/tooling tests; PR #8 merged cleanly into `main` at
  `4cf3f08baad2923d52932dd42867cd74792b98dd`.
- PF-019: Better Auth 1.6.26, generated auth schema, local/test-only signup,
  database-backed session lifecycle and response redaction pass 97 total tests,
  including 71 database/tooling and 8 auth tests. Review:
  `docs/PF-019_REVIEW.md`.
- PF-019 integration: PR #10 merged into `main` at
  `018a683a51b8928e13bd54091e0fae1ac9cfb938`.
- PF-020: verified Better Auth session plus exactly one active membership and
  active organization constructs the typed server context. Zero, invited,
  suspended and multiple-membership cases fail closed. The centralized role
  matrix, repository enforcement and two-tenant/forgery coverage pass 115 total
  tests, including 10 authorization, 8 authentication and 79 D1/tooling tests.
  Review:
  `docs/PF-020_REVIEW.md`.
- PF-020 integration: PR #11 merged into `main` at
  `793371e6542d7697efe8ade978394c69be10deba`.
- PF-021: `npm run dev:prepare` creates an ignored random local auth secret when
  absent and applies pending migrations without reset or seed. `npm run dev`
  uses the local-only D1 config and the same locked persistence. The isolated
  HTTP smoke exercises signup, login, redacted session lookup, organization
  context, logout and revocation through the real Vite Worker runtime. Review:
  `docs/PF-021_REVIEW.md`.
- PF-021 integration: PR #12 merged into `main` at
  `ad767f75321c901357c72de5285f4e42782f61ed`.
- PF-022: the accessible login form, safe local `returnTo`, session/context
  guard, explicit organization-access states, verified shell identity and real
  logout behavior pass 140 total tests. Protected content remains hidden until
  both session and organization context validate. Review:
  `docs/PF-022_REVIEW.md`.
- PF-022 integration: PR #13 merged into `main` at
  `f82386abcd66589a5af47aa55123b1adfaa1cb6e`.
- PF-023: accepted local-only bootstrap boundary, secret handling, exact retry
  semantics and atomic organization-plus-owner contract. PR #14 merged into
  `main` at `3d40758584e986acc9042ec3f3681e55d3a9c512`.
- PF-025: independently reviewed product-catalog contract defines safe DTOs,
  strict product/alias inputs, manual-alias ownership, stable tenant-scoped
  pagination/search, capability/error boundaries and separate PF-026/PF-027
  implementation gates. Documentation diff validation passed locally.
- PF-027: 170/170 tests across 10 files after corrective fixes; lint, build,
  migration drift check, isolated HTTP smoke and production-only audit pass.
  Real-browser QA at 1440 × 900 and 390 × 844 covered catalog mutations,
  filters, dialogs, keyboard focus and mobile scrolling without horizontal
  overflow or errors in a fresh browser tab. See `docs/PF-027_REVIEW.md`.
- PF-024 through PF-027: reviewed local trees matched the published GitHub
  trees exactly. PRs #15–#18 were merged sequentially on 2026-10-22; the
  remote `main` ref was verified after PF-027 integration.

## GitHub Status

- Pull request #1 merged the foundation into `main` at commit `88419f8`.
- Pull requests #2–#6 merged the UX-foundation contracts and responsive shell
  implementation into `main`.
- PR #7 merged PF-016 at `24f79be`.
- Verified on 2026-09-15: PR #8 merged PF-017 at `4cf3f08`; local `main`,
  `origin/main`, and the live remote main ref matched that commit before the
  PF-018 documentation branch was created.
- PR #10 merged PF-019 into `main` at
  `018a683a51b8928e13bd54091e0fae1ac9cfb938`.
- PR #11 merged PF-020 into `main` at
  `793371e6542d7697efe8ade978394c69be10deba`.
- PR #12 merged PF-021 into `main` at
  `ad767f75321c901357c72de5285f4e42782f61ed`.
- PR #13 merged PF-022 into `main` at
  `f82386abcd66589a5af47aa55123b1adfaa1cb6e`.
- PR #14 merged PF-023 into `main` at
  `3d40758584e986acc9042ec3f3681e55d3a9c512`.
- PR #15 merged PF-024 into `main` at
  `4c42cf69a11a8238d72d64ae4c3cd55cc662489a`.
- PR #16 merged PF-025 into `main` at
  `48fbe109b430ff0f269940472f174c251e849879`.
- PR #17 merged PF-026 into `main` at
  `d95533b8cd93d8083282bf02b6a1e2ec00e02050`.
- PR #18 merged PF-027 into `main` at
  `5e2468a35104f2baf218a6315245cc7b4f99c11e`.
- The local GitHub CLI and HTTPS Git push still lack credentials; the connected
  GitHub app supplied the verified publication route for PRs #15–#18.
- Public remote access has been verified.
- The PedidoFlow operating documentation is committed and published.

## High-Level Milestones

- [x] M0 — Product definition and architecture planning (preserved in the master document)
- [x] M1 — Repository and environment foundation
- [x] M2 — UX foundations and design system
- [x] M3 — Database and tenant model
- [x] M4 — Authentication and authorization
- [ ] M5 — Operational application foundation
- [ ] M6 — Interpretation and review
- [ ] M7 — Fulfillment
- [ ] M8 — Channels and imports
- [ ] M9 — Quality and deployment
