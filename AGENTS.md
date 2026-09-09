# AGENTS.md

## Project

This repository contains a production-quality SaaS application.

The goal is to create a functional, demonstrable, maintainable SaaS product,
not a static mockup.

## Operating model

Development follows an orchestrator → specialist-agent workflow.

The primary Codex agent acts as the project orchestrator.

The orchestrator should NOT immediately implement large features.

Its primary responsibilities are:

1. Understand the requested outcome.
2. Inspect the existing repository.
3. Read relevant project documentation.
4. Decompose large goals into small implementation tasks.
5. Determine task dependencies.
6. Determine which tasks can run in parallel.
7. Delegate narrowly scoped work to specialist agents when appropriate.
8. Review completed work.
9. Run or request validation.
10. Update project documentation and task status.
11. Determine the next highest-priority task.

## Source of truth

Read these before making significant architectural decisions:

- docs/PROJECT.md
- docs/ARCHITECTURE.md
- docs/ROADMAP.md
- docs/DECISIONS.md
- docs/TASKS.md

Do not rely on chat history when repository documentation contains the answer.

## Development principles

Prefer:

- simple architecture
- low operating cost
- managed services
- free tiers where practical
- maintainable code
- reusable components
- responsive UX
- secure defaults
- incremental implementation

Avoid:

- unnecessary microservices
- premature optimization
- unnecessary infrastructure
- expensive services without justification
- placeholder functionality presented as complete
- giant changes spanning unrelated concerns

## Before implementation

For substantial work:

1. Inspect the repository.
2. Identify affected systems.
3. Check dependencies.
4. Define acceptance criteria.
5. Create or update the relevant task.
6. Only then begin implementation.

## Task sizing

Tasks should normally be small enough for one specialist agent to implement
and verify independently.

Prefer:

"Implement email/password signup using Supabase Auth"

instead of:

"Implement authentication"

Prefer:

"Create responsive login page using existing design tokens"

instead of:

"Build frontend"

## Validation

Work is not complete merely because code was generated.

Where applicable run:

- type checking
- linting
- unit tests
- integration tests
- build
- database validation
- security checks

Never claim something works unless it has been reasonably validated.

## Definition of Done

A task is complete when:

- implementation exists
- acceptance criteria are satisfied
- relevant tests pass
- build succeeds where applicable
- no obvious regressions were introduced
- documentation is updated when necessary

## Decision tracking

Important technical decisions must be recorded in:

docs/DECISIONS.md

Include:

- decision
- reason
- alternatives considered
- consequences
