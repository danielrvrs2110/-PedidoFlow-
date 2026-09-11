# PedidoFlow Design System

## Purpose

PedidoFlow is operational software for people who process orders for hours each
day. The interface must reduce interpretation and re-entry work, make exceptions
obvious, and keep routine high-confidence information quiet.

This document defines the visual and interaction baseline. It is intentionally
small enough to implement and evolve with real workflows.

## Product Jobs

Every screen must support a concrete job:

- Sales and operations: identify which incoming orders need attention, resolve
  uncertain lines, and confirm accurate orders quickly.
- Warehouse: understand exactly what to pick, in what quantity and unit, without
  reading the original conversation.
- Manager: see bottlenecks and operational totals derived from real records.
- Delivery and administration: update delivery and payment state with clear
  confirmation and history.

The signature experience is:

```text
Inbox -> Conversation -> Parsed Order Review -> Confirmed Order
```

On desktop, this can use three coordinated panes. On mobile, it becomes a
sequential flow with preserved context and an obvious way back.

## Design Principles

1. Exceptions before decoration.
2. Dense enough for daily work, never cramped.
3. High-confidence information recedes; uncertainty attracts attention.
4. Status is communicated with text and shape, not color alone.
5. Every loading, empty, error, permission, success, and destructive state is
   intentional.
6. Mobile flows are composed for the device rather than compressed desktop
   layouts.
7. Metrics must come from real data and help the user decide what to do next.

## Anti-Patterns

Do not use:

- purple or blue AI gradients;
- glassmorphism;
- giant rounded cards or excessive shadows;
- decorative emojis;
- meaningless charts or fabricated metrics;
- marketing-scale headings inside the application;
- card grids where a list or table better supports the job;
- animation that slows order processing;
- a default component-library appearance without PedidoFlow-specific work.

## Foundations

### Typography

Preferred family: Inter, self-hosted or packaged with the application when it is
introduced. Until then, use the existing system sans-serif stack as a compatible
fallback.

| Token | Size / line height | Use |
|---|---:|---|
| `text-xs` | 12 / 16 | timestamps, secondary metadata |
| `text-sm` | 14 / 20 | table cells, labels, controls |
| `text-md` | 16 / 24 | body copy and primary form values |
| `text-lg` | 18 / 28 | section introductions |
| `heading-sm` | 20 / 28 | panel and dialog titles |
| `heading-md` | 24 / 32 | application page titles |
| `heading-lg` | 32 / 40 | onboarding only; avoid in daily workflows |

Use 400 for body text, 500 for labels and table emphasis, 600 for headings and
primary operational values, and 700 only for compact brand marks or exceptional
emphasis.

### Color

#### Brand

| Token | Value | Use |
|---|---|---|
| `brand-50` | `#EFF6FF` | selected or informational background |
| `brand-100` | `#DBEAFE` | subtle active border/background |
| `brand-600` | `#2563EB` | primary action and focus |
| `brand-700` | `#1D4ED8` | primary hover/pressed |
| `brand-800` | `#1E40AF` | strong informational text |

#### Neutral

| Token | Value | Use |
|---|---|---|
| `neutral-0` | `#FFFFFF` | raised surfaces |
| `neutral-50` | `#F9FAFB` | application background |
| `neutral-100` | `#F3F4F6` | subtle grouped background |
| `neutral-200` | `#E5E7EB` | borders and dividers |
| `neutral-300` | `#D1D5DB` | disabled borders |
| `neutral-500` | `#6B7280` | secondary text |
| `neutral-700` | `#374151` | body text |
| `neutral-900` | `#111827` | headings and primary values |

#### Semantic pairs

| Meaning | Background | Border | Text/icon |
|---|---|---|---|
| Success | `#F0FDF4` | `#BBF7D0` | `#166534` |
| Warning | `#FFFBEB` | `#FDE68A` | `#92400E` |
| Danger | `#FEF2F2` | `#FECACA` | `#991B1B` |
| Information | `#EFF6FF` | `#BFDBFE` | `#1E40AF` |

Do not place semantic color on every row. Reserve it for state, risk, and action.
Verify text contrast during component implementation.

### Spacing

Use a 4px base scale:

```text
1: 4px
2: 8px
3: 12px
4: 16px
5: 20px
6: 24px
8: 32px
10: 40px
12: 48px
```

Tables and repeated operational rows normally use 8–12px vertical padding.
Forms normally use 16–24px between groups. Page sections normally use 24–32px.

### Radius and elevation

| Element | Radius |
|---|---:|
| compact controls and badges | 4px |
| inputs and buttons | 6px |
| cards and panels | 8px |
| dialogs and drawers | 10px |

Prefer borders over shadows. Use a small shadow only for menus, dialogs, sticky
overlays, or another surface that must visually separate from content.

### Focus and motion

- All interactive controls receive a visible 2px `brand-600` focus ring with a
  2px offset.
- Never remove focus indication without an accessible replacement.
- Standard state transitions last 120–180ms.
- Respect `prefers-reduced-motion`.
- Operational actions do not wait for decorative animation.

## Layout

### Desktop

- Persistent sidebar: approximately 240px.
- Utility bar: approximately 56px.
- Main content: fluid; optimize tables for available width.
- Primary page padding: 24–32px.
- Keep filters and actions close to the records they affect.

### Mobile

- Primary breakpoint: below 768px.
- Highest-frequency destinations use bottom navigation: Inicio, Inbox, Pedidos,
  Catálogo, Más.
- Minimum touch target: 44 x 44px.
- Tables become prioritized rows/cards or focused detail flows; do not force wide
  desktop tables into horizontal scrolling when a better mobile representation
  exists.

### Intermediate widths

Between 768px and 1023px, allow a collapsible navigation rail and reduce multi-
pane workflows deliberately. Do not rely only on automatic wrapping.

## Core Components

Build reusable primitives only as product work requires them:

- Button, icon button, input, textarea, select, combobox.
- Checkbox, radio, switch.
- Badge, avatar, alert, toast.
- Dialog, drawer, dropdown, tabs.
- Table, pagination, skeleton.
- Empty, error, permission, and confirmation states.
- Breadcrumb, sidebar, utility bar, mobile navigation.

### PedidoFlow domain components

- Order status badge.
- AI confidence badge.
- Product match row.
- Order item row.
- Stock and price warnings.
- Conversation bubble and attachment preview.
- Customer selector and SKU combobox.
- Quantity/unit editor.
- Order summary and order timeline.

## Domain States

### Order status

Use persistent Spanish labels:

```text
Borrador
Requiere revisión
Confirmado
En preparación
Listo
En reparto
Entregado
Cancelado
```

Pair each state with a text label and restrained badge treatment. Do not imply
that payment and fulfillment are the same state.

### AI matching

```text
Alta confianza      -> neutral, visually quiet
Confianza media     -> warning treatment
Baja confianza      -> danger treatment
Sin coincidencia    -> danger treatment with required action
Corregido manualmente -> information treatment with audit context
```

Confidence thresholds are a domain decision and must not be hard-coded by the
visual layer before the matching model is defined.

## Information and Interaction States

Every data screen must specify:

- loading skeleton shaped like the final content;
- first-use empty state with one relevant primary action;
- filtered/no-results state that preserves filters;
- recoverable error with retry when safe;
- permission error distinct from missing data;
- visible successful mutation confirmation;
- confirmation for destructive or financially meaningful actions;
- disabled/submitting state that prevents duplicate mutations;
- behavior during slow or lost network connectivity.

## Accessibility Baseline

- Target WCAG 2.2 AA for application workflows.
- Use semantic HTML before ARIA.
- Keep keyboard order aligned with visual order.
- Dialogs trap focus and restore it to the trigger.
- Inputs have persistent labels and linked error descriptions.
- Status and confidence never depend on color alone.
- Support text zoom and 320px-wide layouts without losing core actions.
- Announce asynchronous success and error messages appropriately.

## Figma Structure

When a Figma file is connected, use these pages:

1. Foundations: color, typography, spacing, radius, focus, grid.
2. Components: primitives, variants, and interaction states.
3. PedidoFlow Components: confidence, matching, order, stock, pricing, and
   conversation patterns.
4. Desktop: shell, operational dashboard, Inbox, order review, orders, products,
   and customer detail.
5. Mobile: dashboard, Inbox, conversation, review, orders, and product selector.

Recommended frames:

- Desktop: 1440 x 1024.
- Mobile: 390 x 844.

Coding does not wait for every settings screen. The minimum design gate is
foundations, shell, core primitives, dashboard, Inbox, order review, and their
mobile equivalents.

## Review Checklist

Before accepting a screen:

- Is the user's job and primary action obvious?
- Are exceptions easier to find than routine data?
- Are values real or clearly identified as demo data?
- Are loading, empty, error, success, and permission states defined?
- Does keyboard navigation work?
- Does the layout work at 390px and common desktop widths?
- Are controls and rows dense enough for repeated operational use?
- Are destructive actions clear and confirmed?
- Does the result avoid the generic AI-SaaS anti-patterns above?
