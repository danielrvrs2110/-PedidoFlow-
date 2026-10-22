# PF-027 Product Catalog UI — Review Handoff

Status: PASS locally on 2026-10-22 after full-suite rerun and real-browser QA;
integrated through PR #18 at `5e2468a`.

## Scope

PF-027 replaces only the `/app/products` placeholder. It consumes the accepted
PF-026 HTTP API and adds no Worker route, schema, migration, infrastructure,
inventory, pricing, import or AI behavior.

## Implementation

- Responsive dense desktop table and prioritized mobile cards.
- Search by SKU/name/variant, active/inactive/all filters and cursor-based
  load-more pagination.
- React Hook Form plus the existing direct Zod dependency for strict create and
  edit validation, paired quantity/measure input and duplicate-SKU feedback.
- Explicit deactivate/reactivate confirmation with historical-data wording.
- Manual alias add, edit and delete inside the product editor.
- Loading skeleton, initial-empty, filtered-empty, recoverable fetch failure,
  success announcement, mutation pending and expired-session recovery states.
- Verified organization role suppresses catalog requests and controls for
  picker. The PF-026 API remains the authoritative capability boundary.
- Same-origin credentials, abort-on-unmount/filter-change and request identity
  prevent stale list responses from replacing current results.
- Native dialogs provide Escape behavior; initial/invalid-field focus and
  trigger focus restoration are implemented.

## Test Evidence

Focused Testing Library coverage exercises list/loading, search/filter,
pagination append, empty/error retry, picker denial without a catalog request,
create validation and conflict focus, edit submission, alias add/delete,
deactivation confirmation, 401 recovery and stale-response abort.

The final full repository suite passes 170/170 in 10 files after the corrective
changes. Lint with zero warnings, typecheck and production build, `db:check`,
isolated local HTTP smoke, production-only dependency audit and
`git diff --check` pass. The production-only audit reports zero vulnerabilities.

Real-browser QA used a disposable local owner and the local D1/Worker runtime.
At 1440 × 900 and 390 × 844, the authenticated catalog renders without
horizontal overflow. The desktop table and mobile cards, create/edit dialogs,
search empty state, active/inactive filters, deactivate/reactivate confirmation,
manual alias add/delete confirmation, Escape, focus restoration and scrolling
inside the mobile edit dialog were exercised. A fresh browser tab showed no
console errors. The QA identity and product exist only in ignored local D1
persistence; no remote data or infrastructure was changed.

The real-browser pass found an application crash: `AppShell` omitted outlet
context for its nested catalog route. Passing the verified organization to its
`Outlet` fixes it, and an application-level routing test covers the failure.
It also found initial focus on the close button instead of SKU and a stale
alias count after mutation; both were corrected and tested. Compatible Hono
4.13.13 and Vite 8.3.5 security patch releases were installed and validated
from a clean `npm ci`.

## Review Focus

- Confirm response-shape assumptions remain identical to
  `docs/PRODUCT_CATALOG.md` and PF-026.
- Inspect dialog keyboard/focus behavior in a real browser.
- Verify 1440px and 390px layout without horizontal overflow against a local
  bootstrapped owner session.
- Confirm picker behavior is a usability aid only and no server authorization
  was weakened.

## Known Limits

- The full audit still reports development/optional-tooling findings; the
  production-only audit is clean. See `docs/DATABASE.md`.
- PF-024 through PF-027 were integrated sequentially through PRs #15–#18.
