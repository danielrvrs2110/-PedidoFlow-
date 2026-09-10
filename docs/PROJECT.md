# PedidoFlow Project

## Purpose

PedidoFlow converts unstructured B2B orders into structured, reviewable orders
for Mexican distributors, initially fresh-food and restaurant-supply businesses
in Guadalajara.

The value proposition is simple: stop re-entering orders that customers already
send through WhatsApp and other familiar channels.

## Primary Users

- Sales and operations staff who review interpreted orders.
- Warehouse staff who prepare confirmed orders.
- Managers who monitor exceptions and order flow.
- Delivery or administrative staff who record delivery and payment states.

Customers do not need PedidoFlow accounts in the initial product.

## Core Workflow

```text
incoming message or manual text
-> interpreted draft
-> deterministic SKU candidates
-> confidence and exception review
-> human confirmation
-> picking
-> delivery state
-> payment state
```

High-confidence lines should require little attention. Unknown products,
ambiguous matches, unusual quantities, stock problems, missing customers, and
stale prices must be prominent.

## MVP Boundary

The MVP includes organization membership, authentication, customers, products,
aliases, inventory, pricing, manual orders, AI-assisted drafts, human review,
Inbox, picking, delivery/payment state, search, CSV catalog import, responsive
UX, demo ingestion, and a real WhatsApp webhook before client production use.

AI never confirms orders without human or explicitly approved deterministic
authorization.

## Non-Goals

PedidoFlow is not initially an ERP, WMS, CRM, POS, accounting system, CFDI
engine, fleet platform, e-commerce platform, or generic chatbot.

## Product Quality Order

1. Working behavior.
2. Good operational UX.
3. Maintainability.
4. Appropriate security.
5. Low operating cost.
6. Easy deployment.
7. Reusability.
8. Visual polish.
9. Additional features.

See `PEDIDOFLOW_MASTER.md` for the complete feature matrix, routes, UX details,
cost assumptions, risks, and definitions of done.
