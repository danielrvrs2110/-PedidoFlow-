# PedidoFlow Project State

Last updated: 2026-09-11

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

## Current

- [ ] PF-015 Define the dashboard, Inbox, and parsed-order review UX contract
  for desktop and mobile.

## Next

- Complete the UX-foundation design gate before starting the database model.

## Blocked

- None.

## Technical Debt

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
  typecheck, 8 tests, production build, npm audit, and browser QA at 1440 x 900,
  900 x 800, and 390 x 844 pass without console errors or horizontal overflow.

## GitHub Status

- Pull request #1 merged the foundation into `main` at commit `88419f8`.
- Pull requests #2–#4 merged the design-system tokens and shell contract into
  `main`; PF-014 is pending publication from its focused feature branch.
- Local `main` and `origin/main` are synchronized.
- Public remote access has been verified.
- The PedidoFlow operating documentation is committed and published.

## High-Level Milestones

- [x] M0 — Product definition and architecture planning (preserved in the master document)
- [x] M1 — Repository and environment foundation
- [ ] M2 — UX foundations and design system
- [ ] M3 — Database and tenant model
- [ ] M4 — Authentication and authorization
- [ ] M5 — Application shell
- [ ] M6 — Catalog, inventory, customers, and pricing
- [ ] M7 — Manual order engine
- [ ] M8 — AI interpretation and matching
- [ ] M9 — Inbox and review workflow
- [ ] M10 — Picking, delivery, and payment states
- [ ] M11 — Imports and WhatsApp integration
- [ ] M12 — Dashboard and responsive UX
- [ ] M13 — Testing, security, and production deployment
- [ ] M14 — Documentation and client demo readiness
