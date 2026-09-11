# PedidoFlow Signature Workflow UX Contract

## Purpose

PedidoFlow's defining experience turns an unstructured B2B request into a
reviewable order without hiding uncertainty:

```text
Inbox -> Conversation -> Parsed Order Review -> Human confirmation
```

This document defines behavior and information hierarchy before database, AI,
or messaging implementation. It is not permission to add invented customers,
metrics, messages, matches, or confirmations to the running application.

## Non-Negotiable Rules

- AI output is always a draft or recommendation until a person confirms it.
- The original customer message remains visible and auditable during review.
- Uncertainty and exceptions receive more visual weight than high-confidence
  routine items.
- Price, stock, customer, and product problems are distinct; one generic
  "warning" state is insufficient.
- A reviewer can correct every proposed match before confirmation.
- Confirmation is blocked while required review items remain unresolved.
- Desktop supports parallel context; mobile uses a deliberate sequential flow.
- No screen may imply that WhatsApp, AI, inventory, or pricing is connected
  before the corresponding integration and data are real.

## Operational Dashboard

### Job

Tell the operations team what needs attention now. It is a triage surface, not
an analytics or executive-reporting page.

### Information order

1. Work requiring review or correction.
2. Orders waiting for operational action.
3. Inventory or payment exceptions.
4. Recent activity that helps resume work.

Only show a count when it comes from a real, organization-scoped query. Empty
groups disappear or render an honest zero state; they never use demo numbers in
production-facing UI.

### Desktop

- Compact attention summary followed by prioritized work lists.
- Each item names the reason it needs attention and links to the exact work.
- Avoid large metric cards, decorative charts, growth percentages, and revenue
  claims unrelated to the next operational action.

### Mobile

- A single priority stream replaces a multi-column dashboard.
- The reason, customer or order identity, age, and next action remain visible.
- Do not require horizontal scrolling to understand a work item.

### Required states

- Loading skeleton shaped like the priority list.
- First-use state that points toward the real setup dependency.
- Quiet all-clear state when no work needs attention.
- Scoped recoverable error with retry.
- Permission state distinct from no activity.

## Inbox

### Job

Let an operator find incoming conversations, understand their current state,
and move directly to the next unresolved review decision.

### Conversation list item

When data exists, each row may show:

- customer or verified sender identity;
- channel and latest-message time;
- short message preview;
- workflow state such as new, interpreting, needs review, ready, or resolved;
- concise exception reason when human attention is required.

Badges and unread indicators must be derived from durable state. Rows do not
show fabricated initials, timestamps, counts, or message previews.

### Desktop layout

At wide widths, use three coordinated regions:

```text
Conversation list | Message history | Parsed order review
```

- The list remains scannable and comparatively narrow.
- Message history preserves source order and attachment context.
- The review region receives the most width needed for item decisions.
- Selecting a conversation updates the other regions without a full reload.
- A direct `/app/inbox/:conversationId` URL restores the same selection.

At intermediate widths, reduce to two regions. The review may replace the
conversation region, but an explicit control must return to the messages.

### Mobile sequence

```text
Inbox list -> Conversation -> Review order
```

- Each step has a real route or durable navigation state.
- Back returns to the prior context without losing unsaved reviewer edits.
- A persistent review action is allowed only when a parsed draft exists.
- The bottom application navigation must not cover conversation actions.

### Conversation content

- Distinguish inbound and outbound messages without relying only on color.
- Show sender, timestamp, delivery state when real, and attachment type.
- Original text is selectable and never silently rewritten by AI.
- Unsupported attachments state what cannot yet be processed.
- Interpretation progress is a status, not an indefinite blocking spinner.

### Inbox states

- First-use: explain the real supported ingestion path.
- Empty: no open conversations for the active organization.
- Filtered empty: preserve filters and offer a clear reset.
- Interpreting: messages stay readable while extraction runs.
- Interpretation failed: preserve input and offer a scoped retry when safe.
- Permission denied: do not reveal whether another organization's conversation
  exists.
- Conversation missing: useful not-found state with return to Inbox.

## Parsed Order Review

### Job

Allow a person to compare the customer's words with a proposed structured order,
resolve every uncertainty, and knowingly confirm the result.

### Header

Show only verified values:

- customer or unresolved-customer state;
- source and received time;
- draft status;
- count of decisions still required;
- link or control to return to the original conversation.

### Line-item anatomy

Every proposed line preserves:

- the original text fragment;
- interpreted quantity and unit;
- proposed product, variant, and SKU;
- match state and human-readable review reason;
- price and inventory checks when those systems provide real values;
- correction history once audit logging exists.

High-confidence lines are compact and quiet. Medium confidence, low confidence,
unmatched lines, incompatible units, missing prices, and stock exceptions expand
to show the exact decision required.

### Match states

```text
high confidence
medium confidence
low confidence
unmatched
manually corrected
```

The visual layer does not define numeric thresholds. A domain service owns
thresholds and review reasons. Confidence never substitutes for validation of
price, unit, stock, or customer identity.

### Corrections

- Product selection uses a searchable, keyboard-operable SKU combobox.
- Quantity and unit remain editable with validation close to the field.
- Candidate matches explain enough context to choose correctly.
- A correction changes the draft only; it does not mutate the product catalog.
- Undo is available before confirmation when technically safe.
- Manual corrections are marked explicitly and later stored with actor and
  timestamp for audit.

### Confirmation gate

The primary action is `Confirmar pedido`. It remains disabled when:

- customer identity is required and unresolved;
- any line is unmatched or otherwise requires a decision;
- a quantity or unit is invalid;
- a required price is unavailable or rejected;
- a blocking inventory rule fails;
- interpretation or validation is still running;
- the draft changed on the server and must be refreshed.

The interface lists the blocking reasons near the action. It never silently
removes or fixes a line to make confirmation possible. Confirmation creates the
real confirmed order through the manual order engine; AI never calls that
transition by itself.

### Concurrent and network changes

- Saving a correction prevents duplicate submission and reports success or a
  recoverable error.
- A stale draft conflict preserves local work where safe and explains what
  changed.
- Lost connectivity leaves the draft visibly unconfirmed.
- Navigating away with unsaved edits requires a clear warning.

### Desktop and mobile

Desktop may keep source messages beside the review. On mobile, review is a
single-column sequence:

1. unresolved identity;
2. items requiring action;
3. resolved high-confidence items, collapsed when helpful;
4. totals and blocking reasons;
5. confirmation action.

The mobile product selector occupies a focused dialog or full-screen step with
search, candidates, and an explicit selection. It must not squeeze a desktop
combobox into a narrow row.

## Keyboard and Screen Reader Contract

- Regions and headings expose the Inbox, conversation, and review structure.
- Moving between routes announces or focuses the new page heading.
- List selection, message navigation, candidate selection, correction, and
  confirmation are keyboard operable.
- Focus does not jump when interpretation status changes.
- Errors are linked to fields and announced after submission.
- Drawers and dialogs trap focus, close with Escape, and restore their trigger.
- Status, confidence, and blocking reasons always include text.

## First Implementation Boundary

Future implementation must be sliced in this order:

1. Real manual order domain and validation.
2. Real organization-scoped conversations and messages.
3. Deterministic interpreter adapter for development and tests.
4. Parsed draft review and correction workflow.
5. Human confirmation into the manual order engine.
6. OpenAI and WhatsApp providers behind their internal abstractions.

Do not build a clickable mock of this workflow before its required domain data
exists. Isolated component examples may use clearly named fixtures in tests or
development-only tooling, never unlabeled production UI.

## Acceptance Criteria

- Dashboard priorities and prohibited vanity patterns are explicit.
- Desktop and mobile Inbox information architecture is explicit.
- Original-message preservation and uncertainty treatment are explicit.
- Every parsed-line field, match state, and correction behavior is defined.
- Human-confirmation blockers are unambiguous.
- Loading, empty, filtered, failure, permission, stale, and offline behavior is
  defined at the appropriate layer.
- Keyboard, focus, and announcement behavior is defined.
- The implementation order preserves the manual-order-before-AI boundary.
- No requirement depends on invented records or unavailable integrations.
