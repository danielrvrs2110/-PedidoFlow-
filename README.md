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
- `docs/TASKS.md`: estado actual y checklist.
- `docs/DECISIONS.md`: decisiones importantes.

No se requieren secretos ni infraestructura remota para ejecutar este hito.
