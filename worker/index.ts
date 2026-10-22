import { Hono } from 'hono'
import { handleAuthRequest, type AuthBindings } from './auth.js'
import { handleOrganizationContextRequest } from './authorization.js'
import { createAlias, createProduct, deleteAlias, getProduct, listProducts, methodNotAllowed, updateAlias, updateProduct } from './catalog.js'

const app = new Hono<{ Bindings: AuthBindings }>()

app.all('/api/auth/*', context => handleAuthRequest(context.req.raw, context.env))

app.get('/api/context', context => handleOrganizationContextRequest(context.req.raw, context.env))

app.get('/api/products', context => listProducts(context.req.raw, context.env))
app.post('/api/products', context => createProduct(context.req.raw, context.env))
app.all('/api/products', context => methodNotAllowed(context.req.raw, context.env, 'GET, POST', 'read_operational_data'))
app.get('/api/products/:productId', context => getProduct(context.req.raw, context.env, context.req.param('productId')))
app.patch('/api/products/:productId', context => updateProduct(context.req.raw, context.env, context.req.param('productId')))
app.all('/api/products/:productId', context => methodNotAllowed(context.req.raw, context.env, 'GET, PATCH', 'read_operational_data'))
app.post('/api/products/:productId/aliases', context => createAlias(context.req.raw, context.env, context.req.param('productId')))
app.all('/api/products/:productId/aliases', context => methodNotAllowed(context.req.raw, context.env, 'POST', 'manage_catalog_customers_pricing'))
app.patch('/api/products/:productId/aliases/:aliasId', context => updateAlias(context.req.raw, context.env, context.req.param('productId'), context.req.param('aliasId')))
app.delete('/api/products/:productId/aliases/:aliasId', context => deleteAlias(context.req.raw, context.env, context.req.param('productId'), context.req.param('aliasId')))
app.all('/api/products/:productId/aliases/:aliasId', context => methodNotAllowed(context.req.raw, context.env, 'PATCH, DELETE', 'manage_catalog_customers_pricing'))

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
