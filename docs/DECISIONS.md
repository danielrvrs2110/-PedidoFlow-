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
