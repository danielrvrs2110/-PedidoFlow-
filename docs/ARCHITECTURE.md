# PedidoFlow Architecture

## Selected Baseline

| Layer | Selection |
|---|---|
| Language | TypeScript |
| Frontend | React + Vite |
| Routing | React Router |
| UI | Tailwind CSS + customized shadcn/ui primitives |
| Forms and validation | React Hook Form + Zod |
| API | Hono |
| Runtime and hosting | Cloudflare Workers + Static Assets |
| ORM and database | Drizzle ORM + Cloudflare D1 |
| Authentication | Better Auth |
| File storage | Cloudflare R2 |
| AI | Internal `OrderInterpreter`; OpenAI initially |
| Email | Resend |
| Messaging | Meta WhatsApp Cloud API behind an adapter |
| Testing | Vitest + Testing Library + Playwright |

## Runtime Shape

```text
Browser
  -> Cloudflare static React application
  -> Hono Worker API
       -> Better Auth
       -> Drizzle / D1
       -> R2
       -> OrderInterpreter / OpenAI
       -> WhatsApp provider
       -> Resend
```

Use a single deployable application while the requirements remain small. Do
not introduce a custom server, microservices, queues, caches, or additional paid
providers without a demonstrated need.

## Domain Boundaries

Initial domain areas are:

- identity, organizations, and memberships;
- customers and addresses;
- products, aliases, inventory, and price lists;
- conversations, messages, and attachments;
- order drafts, matching, review, and corrections;
- confirmed orders, status events, picking, delivery, and payments;
- AI processing and audit events.

The structured manual-order engine must work before AI is added. Provider APIs
must sit behind internal interfaces so demo/local flows remain functional and
vendors can be replaced without rewriting domain logic.

## Tenancy and Security

Every business record belongs to an `organization_id`. Server-side reads and
writes must combine resource identity with authenticated organization scope.
Frontend visibility is not authorization. Historical order prices and original
ordered text must remain auditable.

Secrets stay server-side and out of Git. Validate external payloads and user
input at trust boundaries. More detailed security documentation will be created
when authentication and data implementation begin.

## Environments

- Local: Wrangler development runtime, local D1, and deterministic demo data.
- Preview: branch deployment where useful, without permanent paid staging.
- Production: `main`, production D1/R2, and separately configured secrets.

## Change Control

A material stack change requires a reason, impact and cost analysis, migration
consequences, an entry in `docs/DECISIONS.md`, and explicit user approval.
