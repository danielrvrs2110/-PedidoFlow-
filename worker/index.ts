import { Hono } from 'hono'
import { handleAuthRequest, type AuthBindings } from './auth.js'

const app = new Hono<{ Bindings: AuthBindings }>()

app.all('/api/auth/*', context => handleAuthRequest(context.req.raw, context.env))

app.get('/api/health', (context) =>
  context.json({
    status: 'ok',
    service: 'pedidoflow-api',
  }),
)

app.notFound((context) =>
  context.json(
    {
      error: 'not_found',
      message: 'API route not found',
    },
    404,
  ),
)

export default app
