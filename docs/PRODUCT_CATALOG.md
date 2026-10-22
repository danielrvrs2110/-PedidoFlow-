# Product Catalog Contract (PF-025)

Status: accepted by independent contract review; implementation is split into PF-026 and PF-027.

## Purpose and sequence

PF-025 defines the first real M5 operational module: tenant-scoped product and
manual-alias management. It replaces the explicit `/app/products` development
state only after its server boundary works. The existing schema is sufficient;
this contract adds no migration.

The implementation is split deliberately:

1. PF-026 implements the product/alias repository and HTTP API.
2. PF-027 implements the responsive `/app/products` workflow against that API.

Products come before customers, pricing and manual orders because those later
modules reference the catalog. PF-025 does not imply that inventory, pricing,
imports, AI matching or orders already work.

## Product boundary

A product owns:

- an opaque server-generated ID;
- one tenant-local SKU;
- name and optional variant;
- an order unit;
- optional paired unit quantity in milli-units and unit measure;
- active/inactive state;
- zero or more manual aliases.

Price and stock are not product fields. Products are deactivated, not hard
deleted. Deactivation never changes inventory, price-list rows or immutable
order-item snapshots. Historical references remain valid.

SKU normalization is intentionally conservative: normalize Unicode to NFC and
trim surrounding whitespace, but preserve case and internal characters. The
current database enforces exact tenant-local uniqueness. Case-insensitive SKU
identity would require an explicit schema/migration decision and is not inferred
by this task.

Manual alias input is NFC-normalized and trimmed for display. The server derives
`normalized_alias` with the existing `normalizeProductAlias` function and fixes
`source` to `manual`. The same normalized alias may belong to different products
because the accepted schema permits that ambiguity; future matching must return
candidates rather than silently select one.

## HTTP API

All routes are private and live outside `/api/auth/*`.

### List products

```http
GET /api/products?status=active|inactive|all&q=<text>&limit=<1..100>&cursor=<opaque>
```

- Default status is `active`; default limit is 50.
- Product order and keyset comparison both use
  `name COLLATE NOCASE ASC, id ASC`; the cursor stores the exact persisted name
  and ID tuple used by that comparison.
- Search covers tenant-local SKU, name and variant. Alias-assisted search may be
  added in PF-026 only if it preserves stable distinct pagination.
- Cursor contents are server-owned and opaque to the client.
- Response: `{ "items": ProductSummary[], "nextCursor": string | null }`.

### Product detail and mutations

```http
POST  /api/products
GET   /api/products/:productId
PATCH /api/products/:productId
```

- Create returns `201`; detail and successful update return `200`.
- PATCH is partial but requires at least one accepted field.
- There is no product DELETE endpoint. Activation/deactivation is an explicit
  boolean update and the UI confirms deactivation.
- Detail includes manual aliases ordered by normalized alias and ID.
- Detail includes only aliases with `source = 'manual'`; non-manual aliases are
  outside this feature.

### Manual aliases

```http
POST   /api/products/:productId/aliases
PATCH  /api/products/:productId/aliases/:aliasId
DELETE /api/products/:productId/aliases/:aliasId
```

- Create returns `201`, update `200`, and delete `204`.
- Alias ID, product ID, organization ID, source and normalized value are never
  accepted from the request body.
- Alias lookup and mutation include organization, product and alias IDs so an
  alias cannot be moved or modified across products or tenants.
- Every alias list/update/delete predicate also requires `source = 'manual'`.
  An import/correction alias ID returns the same 404 as missing/cross-tenant.

## Safe response DTOs

Tenant identifiers, actor/role, alias source/normalized value and raw database
columns are not returned. JSON uses these exact shapes:

```ts
type ProductSummary = {
  id: string
  sku: string
  name: string
  variant: string | null
  orderUnit: string
  unitQuantityMilli: number | null
  unitMeasure: string | null
  active: boolean
  aliasCount: number
  createdAt: number
  updatedAt: number
}

type ManualAlias = {
  id: string
  value: string
  createdAt: number
  updatedAt: number
}

type ProductDetail = Omit<ProductSummary, 'aliasCount'> & {
  aliases: ManualAlias[]
}
```

List returns summaries. Product create/update and detail return
`ProductDetail`. Alias create/update returns `ManualAlias`; alias delete has an
empty `204` body. Timestamps are server-generated Unix milliseconds. Mutation
responses reflect committed database state, not the request.

## Query and cursor semantics

- `q`, when present, is NFC-normalized, trimmed, 1–160 characters and matched
  literally against SKU, name and variant. `%`, `_` and the selected SQLite
  escape character are escaped before a `LIKE ... ESCAPE` predicate.
- Search is case-insensitive only for SQLite's documented ASCII `NOCASE`
  behavior; PF-025 does not claim non-ASCII case/accent folding.
- The cursor is versioned base64url JSON containing the stored sort tuple plus
  a fingerprint of normalized `status` and `q`. Strict decoding rejects unknown
  keys/version, invalid types/base64, oversized content and filter mismatch as
  `400 invalid_request`.
- A cursor is never authority. Every page still derives organization context.
  Decoded values are validated query values only; tampering cannot widen scope.
  Tests prove equal-name boundaries produce no skipped or duplicate rows.

## Input contract

JSON objects are strict: unknown properties, malformed JSON and non-JSON
mutation bodies fail before repository execution.

- Product POST accepts exactly `sku`, `name`, optional `variant`, `orderUnit`,
  optional `unitQuantityMilli`, optional `unitMeasure`, and optional `active`.
- Product PATCH accepts only those product fields, requires at least one, and
  validates the merged stored-plus-patch record. Updating only one side of the
  quantity/measure pair cannot create an invalid state.
- Alias POST and PATCH accept exactly `{ "value": string }`.
- A valid no-op PATCH returns `200` with the current committed representation
  and creates no additional side effect.

| Field | Contract |
|---|---|
| `sku` | required on create; NFC + trim; 1–64 visible characters |
| `name` | required on create; NFC + collapsed whitespace; 1–160 characters |
| `variant` | nullable; NFC + collapsed whitespace; max 120 characters |
| `orderUnit` | required on create; NFC + collapsed whitespace; 1–40 characters |
| `unitQuantityMilli` | nullable safe integer; when present, greater than zero |
| `unitMeasure` | nullable; NFC + trim; max 24 characters |
| `active` | boolean; defaults to true on create |
| alias `value` | NFC + trim; 1–160 characters |

`unitQuantityMilli` and `unitMeasure` are either both null or both present.
IDs, organization/actor/role, timestamps, `normalizedAlias` and alias `source`
are server-owned. Empty strings do not stand in for null.

## Authentication, authorization and tenancy

Every handler follows the accepted boundary:

```text
verified Better Auth session
  -> exactly one active membership in one active organization
  -> OrganizationContext
  -> capability check
  -> tenant-scoped repository query
```

- No organization, actor or role value from route, query, header or body grants
  authority.
- Product reads require `read_operational_data`.
- Product and alias mutations require
  `manage_catalog_customers_pricing`.
- Owner, admin and operator may read and mutate. Picker has neither catalog
  capability and is denied before any resource lookup.
- Every query includes `context.organizationId`; child mutations also include
  their product ID.
- Missing and cross-tenant product/alias IDs use the same `404 not_found` body.
- An inactive organization cannot mutate through this module.

The UI may suppress mutation controls using the verified role only as a usability
aid. The server remains authoritative.

## Errors and response safety

| Condition | Status / code |
|---|---|
| no valid session | `401 unauthenticated` |
| no active access or organization selection required | existing typed `403` |
| authenticated role lacks capability | `403 forbidden` |
| invalid JSON, query, cursor or fields | `400 invalid_request` |
| missing or cross-tenant product/alias | `404 not_found` |
| duplicate tenant SKU or duplicate alias on one product | `409 conflict` |
| unsupported method on a known route | `405 method_not_allowed` plus `Allow` |

Private responses use `Cache-Control: no-store` and `Pragma: no-cache`.
Responses and logs never include cookies, session tokens, SQL text or records
from another tenant. Constraint failures are translated to stable safe errors;
raw D1 messages do not cross the HTTP boundary.
Conflict bodies are `{ "error": "conflict", "field": "sku" | "alias",
"message": string }`. Alias conflict reveals only that the submitted alias is
already attached to this product; aliases on other products remain allowed and
are never identified.

## `/app/products` UX contract

PF-027 replaces the placeholder only when the real API exists.

- Header: `Productos`, concise operational purpose, and `Nuevo producto` for
  verified owner, admin and operator roles.
- Desktop: dense table with SKU, name/variant, presentation, state, alias count
  and compact actions.
- Mobile: prioritized product rows/cards; no forced wide-table scrolling.
- Controls: search, Activos/Inactivos/Todos filter, real pagination/load-more,
  create/edit, explicit deactivate/reactivate, and manual-alias management.
- Create/edit uses React Hook Form and Zod once their direct dependencies are
  verified/added in the implementation task.
- Dialog/drawer behavior includes labels, initial focus, field-error focus,
  Escape, focus restoration and duplicate-submit prevention.

Required states are loading skeleton, initial empty with permitted CTA, no
search results with filters preserved, recoverable fetch error, explicit
permission state, mutation pending, conflict, success announcement and session
recovery. Protected data never flashes before session/context validation.

## Acceptance evidence for PF-026

- Real isolated D1 tests with two organizations prove list, detail, search,
  pagination, create, update, deactivate/reactivate and alias CRUD never cross
  tenant scope.
- Forged organization/actor/role input has no authority. Foreign product and
  alias IDs return the same 404 as missing IDs.
- Owner/admin/operator capability paths pass; picker fails before lookup.
- Validation covers unknown keys, limits, null pairing, safe integers, duplicate
  SKU per tenant, same SKU in different tenants, alias normalization, duplicate
  alias on one product and the same alias across different products.
- Product changes do not rewrite confirmed order-item snapshots; no hard-delete
  route exists.
- HTTP tests cover methods, statuses, safe error bodies, cache headers, malformed
  JSON, content type, literal wildcard search, cursor/filter mismatch, cursor
  tampering and `405` Allow headers.
- Lint, typecheck, focused and full tests, build, `db:check`, dependency audit
  and `git diff --check` pass sequentially.

## Acceptance evidence for PF-027

- Testing Library covers protected loading, list/filter/search, empty and error
  states, create/edit validation, duplicate conflict, deactivate confirmation,
  alias add/edit/delete, permissions, stale-response protection and focus.
- Browser QA covers keyboard operation and 1440px desktop plus 390px mobile
  without horizontal overflow, console errors or invented data.
- Visible controls execute real behavior or clearly explain why unavailable.

## Explicit exclusions

PF-025 through PF-027 do not implement inventory adjustments, price lists,
customers, CSV/bulk import, images/R2, AI extraction or matching, order CRUD,
audit-event expansion, organization switching, onboarding/provisioning, remote
infrastructure, deployment, schema changes or product hard deletion.
