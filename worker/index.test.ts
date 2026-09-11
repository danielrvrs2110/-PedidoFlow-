import { describe, expect, it } from 'vitest'
import app from './index.js'

describe('PedidoFlow API', () => {
  it('reports a healthy service', async () => {
    const response = await app.request('/api/health')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      status: 'ok',
      service: 'pedidoflow-api',
    })
  })

  it('returns a structured 404 for unknown API routes', async () => {
    const response = await app.request('/api/unknown')

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      error: 'not_found',
      message: 'API route not found',
    })
  })
})
