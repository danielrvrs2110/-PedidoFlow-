# PF-022 — Login, logout and protected route handoff

Status: **PASS; pending independent review and GitHub integration**.

## Scope implemented

- Added a restrained `/login` screen using the existing design tokens and UI
  primitives. It validates email/password presence and format, focuses invalid
  controls, exposes pending submission, and separates generic credential
  failures from service/network failures.
- Added a client authorization boundary for all `/app/*` routes. It verifies
  `/api/auth/get-session` and then `/api/context` before rendering any shell or
  protected route content.
- Anonymous or expired sessions return to `/login` with only a validated local
  `/app` return path. External, protocol-relative, malformed and repeatedly
  encoded return targets fall back to `/app`.
- Authenticated `no_access` and `selection_required` states render explicit
  guidance without redirect loops or invented organization selection.
- The shell now displays the verified organization identifier and role returned
  by `/api/context`; no organization name or role is fabricated.
- Logout calls the existing Better Auth sign-out endpoint. Navigation to login
  occurs only after success; failure keeps the verified shell visible and
  communicates that the session remains active.
- Session, context, login and logout fetches use same-origin cookies. Ongoing
  requests are aborted when their owning route or shell unmounts.

No signup, provisioning, organization switcher, business CRUD, server endpoint,
schema, migration, provider integration or remote infrastructure was added.

## Automated evidence

React Testing Library covers:

- absence of protected-content flash during validation;
- anonymous and mid-validation session-expiry redirects;
- verified organization/role rendering;
- `no_access` and `selection_required` states;
- protected-route network retry;
- abort on unmount;
- malicious and valid `returnTo` normalization;
- form validation/focus, pending submission and generic credentials failure;
- distinct network error messaging;
- successful login and existing-session redirects;
- successful logout and failed-logout retention.

## Validation evidence

All commands used npm 11.19.1:

- lint: pass with zero warnings;
- typecheck: pass;
- full suite: 7 files, 129 tests pass;
- production build: pass;
- `db:check`: pass with no drift and immutable migration hashes;
- `git diff --check`: pass.

`npm run dev:prepare` applied pending migrations to this worktree's ignored
local persistence without reset or seed, and `npm run dev` started the real
local Worker successfully at `http://localhost:5173`. Browser automation was
not available because the documented `agent-browser` executable was absent, so
no visual-browser PASS is claimed; interaction and accessibility behavior is
covered by the RTL suite.

## Follow-up boundary

The API currently returns an organization identifier and role, not a display
name. The shell deliberately shows that verified identifier. A later explicit
provisioning/onboarding task may create organizations and memberships; validated
organization switching remains separate.
