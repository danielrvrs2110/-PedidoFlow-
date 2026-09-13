# PedidoFlow

PedidoFlow convierte pedidos B2B no estructurados en órdenes listas para
revisar, confirmar y surtir. El producto inicial está dirigido a distribuidores
mexicanos de alimentos y suministros para restaurantes.

## Estado actual

La fundación técnica usa React, TypeScript, Vite, React Router, Hono y
Cloudflare Workers con Static Assets. La funcionalidad de negocio se construirá
por tareas pequeñas y verificables según `docs/TASKS.md`.

## Requisitos

- Node.js 22 o posterior.
- npm 11.19.1 (fijado en `package.json`).

Con NVM:

```bash
nvm use
```

## Desarrollo local

```bash
npx -y npm@11.19.1 ci
npm run dev
```

La aplicación y el Worker se sirven juntos. El endpoint de comprobación está
disponible en:

```text
GET /api/health
```

Respuesta esperada:

```json
{
  "status": "ok",
  "service": "pedidoflow-api"
}
```

## Validación

```bash
npm run lint
npm run test
npm run typecheck
npm run build
```

## Documentación

- `PEDIDOFLOW_MASTER.md`: sistema operativo y contexto completo.
- `AGENTS.md`: instrucciones persistentes para Codex.
- `docs/PROJECT.md`: propósito y alcance.
- `docs/ARCHITECTURE.md`: arquitectura aprobada.
- `docs/ROADMAP.md`: orden de los hitos.
- `docs/DESIGN_SYSTEM.md`: fundamentos visuales y de interacción.
- `docs/APP_SHELL.md`: navegación y layout responsive de la aplicación.
- `docs/SIGNATURE_UX.md`: contrato UX del Dashboard, Inbox y revisión de pedidos.
- `docs/DATA_MODEL.md`: modelo multi-tenant, invariantes y límites de migración.
- `docs/TASKS.md`: estado actual y checklist.
- `docs/DECISIONS.md`: decisiones importantes.

No se requieren secretos ni infraestructura remota para ejecutar este hito.

## Base de datos local (PF-017)

```bash
npm run db:generate
npm run db:check
npm run db:reset:local
npm run db:migrate:local
npm run db:seed:local
npm run db:inspect:local
npm run test:db
```

Estos comandos usan únicamente la persistencia de este checkout en
`.wrangler/pf017-local` y rechazan argumentos adicionales. El reset elimina
esa base local. No requieren cuentas ni recursos remotos. El seed contiene dos
organizaciones identificadas como desarrollo; aún no se conecta a las pantallas.
Consulta `docs/DATABASE.md` para repetición de migraciones/seed, restricciones,
aislamiento, versiones y reglas pendientes de los futuros servicios.
