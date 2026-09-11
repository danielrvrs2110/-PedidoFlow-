import { Hono } from 'hono'

const app = new Hono()

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
