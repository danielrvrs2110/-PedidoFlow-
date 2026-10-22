# PedidoFlow Customer and Delivery Address Contract (PF-028)

Status: accepted after independent review on 2026-10-22; implementation pending.

## Boundary and sequence

This contract covers tenant-scoped customer contact records and their delivery
addresses. The existing `customers` and `customer_addresses` tables in the
accepted PF-017 migration are sufficient; PF-028 adds no migration. Implement
the repository and HTTP boundary first, then the responsive `/app/customers`
workflow in separate tasks. No customer-facing accounts are created.

Customers are retained when inactive. Deactivation affects selection for new
workflows, but preserves addresses and historical references. The module does
not implement price assignments, orders/history, favorites, imports, bulk
updates, delivery routing, messaging, production onboarding or customer hard
deletion. A detail page must not present those absent features as working data.

## HTTP API and response shapes

All routes are private, same-origin and outside `/api/auth/*`.

```http
GET    /api/customers?status=active|inactive|all&q=<text>&limit=<1..100>&cursor=<opaque>
POST   /api/customers
GET    /api/customers/:customerId
PATCH  /api/customers/:customerId
POST   /api/customers/:customerId/addresses
PATCH  /api/customers/:customerId/addresses/:addressId
PUT    /api/customers/:customerId/addresses/:addressId/default
DELETE /api/customers/:customerId/addresses/:addressId
```

List defaults to `status=active` and `limit=50`; returns `{ items,
nextCursor }`. Search is literal over code, name, email and phone, within the
verified organization. Escape `%`, `_` and the SQLite escape character before
`LIKE`; case-insensitive matching promises only SQLite ASCII `NOCASE` behavior.
When present, `q` is NFC-normalized and trimmed to 1–160 characters; an empty
result is invalid rather than silently becoming an unfiltered search. The
cursor fingerprint uses that exact normalized value.
Sort and keyset comparison use `name COLLATE NOCASE ASC, id ASC`. A versioned,
strictly decoded opaque cursor contains the persisted sort tuple and a
fingerprint of normalized filters. Reject malformed/oversized cursors, unknown
query keys, repeated parameters and cursor/filter mismatch with `400`; a cursor
never grants authority. Equal-name page boundaries cannot skip or repeat rows.

```ts
type CustomerSummary = {
  id: string
  code: string | null
  name: string
  email: string | null
  phone: string | null
  status: 'active' | 'inactive'
  addressCount: number
  createdAt: number
  updatedAt: number
}

type DeliveryAddress = {
  id: string
  label: string
  recipient: string
  streetLine1: string
  streetLine2: string | null
  locality: string
  region: string
  postalCode: string
  countryCode: string
  deliveryNotes: string | null
  defaultDelivery: boolean
  createdAt: number
  updatedAt: number
}

type CustomerDetail = Omit<CustomerSummary, 'addressCount'> & {
  addresses: DeliveryAddress[]
}
```

List returns summaries. Customer create returns `201` and detail; customer
detail/update return `200` and detail. Address create returns `201` and the
committed `DeliveryAddress`; address update/default returns `200` and that
address; delete returns empty `204`. The detail address list sorts default
first, then label with `NOCASE`, then ID. Counts and flags reflect committed
database state. Tenant IDs, roles, actor IDs and raw database columns are not
returned. Timestamps are server-generated UTC Unix milliseconds.

## Inputs and validation

Mutation bodies are strict JSON objects; unknown fields, malformed JSON,
non-JSON content types and empty PATCH objects return `400 invalid_request`.
IDs, organization, customer ownership of an address, timestamps and default
status are server-owned. Empty optional text is represented as `null`, not an
empty string. Unicode text is NFC-normalized, trimmed and bounded after
normalization. Required human names collapse repeated whitespace.

| Field | Rule |
|---|---|
| `code` | nullable; trim, 1–64 characters; exact tenant-local uniqueness when non-null; preserve case/internal characters |
| `name` | required; collapse whitespace; 1–160 characters |
| `email` | nullable; trim, valid email syntax, at most 254 characters; do not claim deliverability |
| `phone` | nullable; trim; 7–30 characters with 7–20 digits and only digits, spaces, `+`, `-`, `(`, `)`; preserve display formatting |
| `status` | `active` or `inactive`; defaults to `active` on create |
| `label` | required; collapse whitespace; 1–80 characters |
| `recipient` | required; collapse whitespace; 1–160 characters |
| `streetLine1` | required; collapse whitespace; 1–200 characters |
| `streetLine2` | nullable; collapse whitespace; at most 200 characters |
| `locality`, `region` | required; collapse whitespace; 1–120 characters each |
| `postalCode` | required; trim; 1–20 characters; do not assume Mexico-only formats |
| `countryCode` | required; uppercase two ASCII letters; UI may suggest `MX`, but API has no implicit country |
| `deliveryNotes` | nullable; NFC + trim; at most 500 characters; never interpret as executable content |

Customer POST accepts `code?`, `name`, `email?`, `phone?`, `status?` only.
Customer PATCH accepts a nonempty subset and validates the merged record.
Address POST accepts the nine address text fields only; nullable fields may be
omitted. Address PATCH accepts a nonempty subset of those fields and validates
the merged record. PATCH with normalized values identical to the stored record
returns `200` without changing timestamps. `defaultDelivery` is never accepted
in JSON; the dedicated PUT performs that transition with no request body.
Customer code is identity only within one tenant; case-insensitive uniqueness
would need a separately approved migration.

## Default address and lifecycle invariant

For a customer with at least one address, exactly one is the default. Creating
the first address makes it default; later addresses begin non-default. PUT
`.../default` moves the flag to the specified address. Repeating PUT on the
current default is a no-op. Deleting a non-default address leaves the default
unchanged. Deleting the default promotes the oldest remaining address by
`createdAt ASC, id ASC`; deleting the last address leaves no default. Customer
deactivation does not change addresses.

Every transition that changes the default or deletes an address must run as
one atomic D1 batch/transaction. All statements must include organization and
customer scope; the target address must be verified in that scope before any
other address is changed. First-address and replacement choices must be based
on database state inside that atomic operation, never a prior read that can
become stale. The implementation must prove concurrent create, default and
delete requests preserve exactly one default whenever addresses remain. If the
selected D1 transaction mechanism cannot demonstrate that guarantee, add a new
reviewed partial unique index through an immutable migration before exposing
mutations. Do not edit PF-017 migrations. Address DELETE requires an explicit
UI confirmation and must fail safely if a later foreign-key dependency
restricts deletion. It must never erase an order or rewrite historical
snapshots.

## Authorization, tenancy and errors

Resolve the Better Auth session, exactly one active membership and active
organization on every request. Reads require `read_operational_data`; mutations
require `manage_catalog_customers_pricing`. Owner, admin and operator may use
the module; picker is denied before resource lookup. No body, path, query,
header or browser storage value establishes organization or actor authority.
Every customer query includes `context.organizationId`; every address query
also includes both customer and address IDs. Missing, cross-tenant and
other-customer address IDs have identical `404 not_found` responses.

| Condition | Status / code |
|---|---|
| no valid session | `401 unauthenticated` |
| no active access or selection required | existing typed `403` |
| role lacks capability | `403 forbidden` |
| invalid query, cursor, content type or body | `400 invalid_request` |
| missing/cross-tenant customer or address | `404 not_found` |
| duplicate tenant customer code | `409 conflict`, field `code` |
| unsupported method on known route | `405 method_not_allowed` with `Allow` |

Use the existing safe API envelope, `Cache-Control: no-store` and
`Pragma: no-cache`. Translate database constraints to stable safe errors.
Responses and logs exclude cookies, tokens, SQL and full customer payloads.

## Responsive UX

`/app/customers` replaces its placeholder after the API is accepted.
`/app/customers/new`, `/app/customers/:customerId` and
`/app/customers/:customerId/edit` follow the master route map; address controls
live in customer detail. Desktop
uses a compact list/table with name, code, contact, address count, status and
actions. Mobile uses prioritized rows without horizontal scrolling. Search,
active/inactive/all filters and cursor pagination operate on real API data.
Verified owner/admin/operator may create, edit, deactivate/reactivate and
manage addresses. Detail shows contact information and address cards, with the
default clearly named. Create/edit uses validated forms; changing the default
and deleting an address require clear confirmation/feedback. A deactivation
dialog explains that historical records remain and the customer is excluded
from active selection. Do not show fabricated pricing or order history.

Support loading, initial-empty with permitted CTA, filtered-empty, fetch error
with retry, permission denial, session recovery, pending mutation, conflict and
success announcement. Protected data must not flash before context validation.
Dialogs/drawers need labels, initial and invalid-field focus, Escape, focus
restoration and duplicate-submit prevention. Mobile must provide a usable
address form and list at 390px with keyboard and safe-area navigation.

## Implementation acceptance gates

1. Repository and HTTP tests run against isolated D1 with two organizations,
   same customer code in each, duplicate code within one, cross-tenant and
   other-customer IDs, forged authority fields, all roles and suspended access.
2. Validate every field boundary, strict JSON, unknown keys, literal wildcard
   search, cursor tampering/filter mismatch, equal-name pagination, no-op PATCH
   and safe constraint/error headers.
3. Exercise first/second address creation, default transfer, repeated default
   PUT, deletion with deterministic promotion and last deletion. Race two
   first-address POSTs, two default PUTs, and deletion of the default against
   another deletion/default change. Verify exactly one default after every
   committed operation with remaining addresses.
4. UI tests cover the states above, filter/search/page changes, form errors,
   conflicts, confirmations, focus, permission behavior and stale requests.
5. Browser QA at 1440px and 390px checks keyboard navigation, dialogs/forms,
   no horizontal overflow and no console errors using real local API data.
6. Run lint, typecheck, full tests, build, migration check, isolated local HTTP
   smoke, dependency audit and `git diff --check` before acceptance.
