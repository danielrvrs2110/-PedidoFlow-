# PedidoFlow Roadmap

The dates in the original plan are historical planning dates. Milestone dates
will be recalculated from actual progress after the foundation is running.
Dependencies and P0 quality take priority over preserving an outdated date.

## M0 — Product Definition

Status: Complete in `PEDIDOFLOW_MASTER.md`.

Product scope, initial market, architecture, UX direction, cost strategy, and
major risks are defined.

## M1 — Repository and Environment Foundation

Status: Complete on 2026-09-11 through pull request #1.

Establish repository instructions and durable state, scaffold the React/Worker
application, add a health endpoint and basic structure, validate the development
server and production build, then create the initial Git/GitHub baseline.

## M2 — UX Foundations

Status: In progress.

Define design tokens, application shell, core components, signature Inbox/order
review behavior, and intentional desktop/mobile layouts.

## M3 — Database and Tenant Model

Implement Drizzle/D1 schema, migrations, realistic seed tooling, constraints,
indexes, and organization scoping.

## M4 — Authentication and Authorization

Implement Better Auth, organization membership, protected routes, roles, and
verified cross-tenant isolation.

## M5 — Operational Application Foundation

Build the responsive application shell and real catalog, inventory, customer,
pricing, and manual-order behavior.

## M6 — Interpretation and Review

Add the internal order-interpreter abstraction, structured extraction, product
matching, confidence, corrections, and the Inbox review workflow.

## M7 — Fulfillment

Implement confirmation, picking, delivery, payment states, status history, and
operational search/filter behavior.

## M8 — Channels and Imports

Add CSV catalog import, demo message ingestion, and then the real Meta WhatsApp
webhook without coupling domain logic to Meta.

## M9 — Quality and Deployment

Complete responsive UX, critical automated tests, security review, production
Cloudflare deployment, setup documentation, realistic demo data, and final
client-demo acceptance testing.

Detailed task IDs and live state belong in `docs/TASKS.md`; this file records
milestone intent and ordering.
