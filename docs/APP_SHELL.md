# PedidoFlow Application Shell Contract

## Purpose

The application shell gives employees a stable frame for daily operational
work. It owns navigation, responsive layout, page context, and access to global
utilities. It does not own order, customer, catalog, or dashboard data.

The shell must feel like focused distribution operations software, not a
marketing dashboard or a generic collection of cards.

## Route Boundary

The authenticated product lives under `/app`:

```text
/app
/app/inbox
/app/inbox/:conversationId
/app/orders
/app/orders/new
/app/orders/:orderId
/app/picking
/app/picking/:orderId
/app/customers
/app/products
/app/inventory
/app/pricing
/app/import
/app/settings
```

The shell renders the active route through a nested route outlet. Authentication
and organization authorization will protect `/app/*` when those systems exist.
The UX-foundation implementation must not simulate a real authenticated user or
claim authorization exists.

## Desktop Information Architecture

At 1024px and wider, use a persistent left sidebar approximately 240px wide.

### Brand area

- Compact PedidoFlow mark and name.
- Current organization name when real organization context exists.
- Do not add a fake organization switcher before multiple memberships work.

### Primary navigation

Ordered by operational frequency:

1. Inicio — `/app`
2. Inbox — `/app/inbox`
3. Pedidos — `/app/orders`
4. Picking — `/app/picking`

### Management navigation

1. Clientes — `/app/customers`
2. Productos — `/app/products`
3. Inventario — `/app/inventory`
4. Precios — `/app/pricing`
5. Importar — `/app/import`

### Utility navigation

- Configuración — `/app/settings`

Only show numeric badges when they are derived from real records. For example,
Inbox may eventually show unresolved conversations, but it starts without a
hard-coded count.

## Desktop Content Frame

The content region contains:

- A 56px utility bar.
- Page breadcrumb only when it clarifies hierarchy.
- Page title, concise supporting context, and the primary action.
- The active page content.

Page titles use the application `heading-md` scale. Avoid giant welcome copy.
Keep the primary action aligned with the title on wide screens and reachable
below it at narrow widths.

The utility bar may eventually contain global search, notifications, and the
real user menu. Do not render fake versions before their behavior exists.

## Mobile Information Architecture

Below 768px, replace the persistent sidebar with a bottom navigation bar:

1. Inicio
2. Inbox
3. Pedidos
4. Catálogo
5. Más

`Catálogo` opens a real navigation choice between Productos and Inventario.
`Más` opens a drawer containing Picking, Clientes, Precios, Importar, and
Configuración. The drawer must trap focus, close with Escape, and restore focus
to its trigger.

The bottom bar respects device safe areas and never covers page actions or
content. Detail pages may replace labels with a contextual back action while
keeping the current destination understandable.

## Intermediate Widths

From 768px through 1023px, use a compact navigation rail or an explicitly
collapsible sidebar. The collapsed state must retain accessible names through
tooltips or visible labels; icons alone are insufficient.

Do not store the user's collapsed preference until a real preference mechanism
exists. A responsive default is enough for the first implementation.

## Navigation States

Every navigation item has:

- default;
- hover;
- keyboard focus;
- active route;
- disabled only when a destination is intentionally unavailable and clearly
  labeled.

Active state uses a subtle `brand-50` background, `brand-700` text, and a shape
or border cue. It must not depend on color alone.

During the UX-foundation milestone, routes without business implementation may
render an explicit development state naming the module and its planned job.
They must not show invented records, metrics, or working controls.

## Page Header Contract

Each route declares:

- eyebrow or breadcrumb when needed;
- page title;
- one-sentence operational purpose;
- zero or one primary action;
- optional secondary actions kept visually subordinate.

On mobile, actions wrap below the title. Sticky actions are allowed only when
they materially improve a long workflow such as order review.

## Responsive Content Rules

- Content padding: 24–32px desktop, 16–20px mobile.
- Minimum supported width: 320px.
- Main content may grow fluidly; tables determine their own practical maximum
  width.
- Multi-pane Inbox becomes list -> conversation -> review on mobile.
- Do not solve dense mobile content with blanket horizontal scrolling.
- Long organization, customer, product, and order names must truncate with an
  accessible full-value affordance when space is constrained.

## Accessibility

- Include a skip link to the main content.
- Use `<nav>` landmarks with accessible labels.
- The active navigation link exposes `aria-current="page"`.
- Keyboard focus follows visual order.
- Mobile drawers manage and restore focus.
- Icon-only controls have accessible names and 44 x 44px touch targets.
- Route changes move focus or announce the new page title when required.
- Shell landmarks remain stable across loading and error states.

## Loading and Failure Behavior

The shell itself renders before route data. Page-level loading belongs inside
the content region so navigation remains usable.

- Session validation loading: show a restrained full-shell skeleton, not a
  flash of protected content.
- Route-data loading: preserve shell and page-header geometry.
- Authorization failure: replace content with a permission state; do not hide
  the error behind an empty page.
- Network failure: keep navigation available when safe and offer a scoped retry.
- Unknown `/app/*` route: render an application 404 with a working return to
  Inicio.

## Initial Implementation Boundary

The first shell implementation may include:

- responsive desktop sidebar and mobile bottom navigation;
- nested React Router routes;
- active navigation state;
- skip link and semantic landmarks;
- explicit module-development states;
- an application 404.

It must not include:

- fake authentication, user profiles, organizations, counts, or notifications;
- invented dashboard metrics;
- customer, product, inventory, or order CRUD;
- AI, database, WhatsApp, or deployment work;
- decorative charts, gradients, or unrelated marketing content.

## Acceptance Criteria

- All defined top-level destinations navigate without a full-page reload.
- Active destination is visible and exposed with `aria-current`.
- Desktop, intermediate, and 390 x 844 layouts do not overflow horizontally.
- Mobile users can reach every top-level destination.
- Keyboard users can skip navigation and reach main content.
- Unknown application routes show a useful 404.
- No visible control implies unavailable business functionality.
- Automated tests cover route rendering and active navigation.
- Browser QA confirms desktop and mobile behavior without console errors.
