import { z } from 'zod'

export type ProductStatus = 'active' | 'inactive' | 'all'

export interface ProductSummary {
  id: string
  sku: string
  name: string
  variant: string | null
  orderUnit: string
  unitQuantityMilli: number | null
  unitMeasure: string | null
  active: boolean
  aliasCount: number
  createdAt: number
  updatedAt: number
}

export interface ManualAlias {
  id: string
  value: string
  createdAt: number
  updatedAt: number
}

export interface ProductDetail extends Omit<ProductSummary, 'aliasCount'> {
  aliases: ManualAlias[]
}

export interface ProductInput {
  sku: string
  name: string
  variant: string | null
  orderUnit: string
  unitQuantityMilli: number | null
  unitMeasure: string | null
}

export type CatalogErrorKind = 'unauthenticated' | 'forbidden' | 'conflict' | 'not_found' | 'invalid_request' | 'network' | 'service'

export class CatalogServiceError extends Error {
  readonly kind: CatalogErrorKind
  readonly field?: 'sku' | 'alias'
  constructor(kind: CatalogErrorKind, message: string, field?: 'sku' | 'alias') {
    super(message)
    this.kind = kind
    this.field = field
  }
}

const manualAliasSchema = z.strictObject({ id: z.string(), value: z.string(), createdAt: z.number(), updatedAt: z.number() })
const productBaseSchema = z.strictObject({ id: z.string(), sku: z.string(), name: z.string(), variant: z.string().nullable(), orderUnit: z.string(), unitQuantityMilli: z.number().int().nullable(), unitMeasure: z.string().nullable(), active: z.boolean(), createdAt: z.number(), updatedAt: z.number() })
const productSummarySchema = productBaseSchema.extend({ aliasCount: z.number().int().nonnegative() })
const productDetailSchema = productBaseSchema.extend({ aliases: z.array(manualAliasSchema) })
function validated<T>(schema: z.ZodType<T>, payload: unknown): T {
  const result = schema.safeParse(payload)
  if (!result.success) throw new CatalogServiceError('service', 'El servicio devolvió una respuesta inesperada.')
  return result.data
}

async function request<T>(path: string, signal: AbortSignal, init?: { method?: string; body?: unknown }): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      method: init?.method ?? 'GET',
      credentials: 'same-origin',
      signal,
      headers: init?.body === undefined ? undefined : { 'content-type': 'application/json' },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new CatalogServiceError('network', 'No fue posible conectar con el catálogo.')
  }

  if (response.status === 204) return undefined as T
  let payload: unknown
  try { payload = await response.json() } catch { throw new CatalogServiceError('service', 'El servicio devolvió una respuesta inesperada.') }
  if (!response.ok) {
    const body = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}
    const code = typeof body.error === 'string' ? body.error : 'service'
    const kind: CatalogErrorKind = code === 'unauthenticated' ? 'unauthenticated'
      : code === 'forbidden' || code === 'no_access' || code === 'selection_required' ? 'forbidden'
        : code === 'conflict' ? 'conflict'
          : code === 'not_found' ? 'not_found'
            : code === 'invalid_request' ? 'invalid_request' : 'service'
    throw new CatalogServiceError(kind, typeof body.message === 'string' ? body.message : 'No fue posible completar la operación.', body.field === 'sku' || body.field === 'alias' ? body.field : undefined)
  }
  return payload as T
}

export async function listProducts(input: { status: ProductStatus; q: string; cursor?: string }, signal: AbortSignal) {
  const params = new URLSearchParams({ status: input.status, limit: '50' })
  if (input.q.trim()) params.set('q', input.q.trim())
  if (input.cursor) params.set('cursor', input.cursor)
  const payload = await request<unknown>(`/api/products?${params}`, signal)
  return validated(z.strictObject({ items: z.array(productSummarySchema), nextCursor: z.string().nullable() }), payload)
}

export const getProduct = async (id: string, signal: AbortSignal) => validated(productDetailSchema, await request<unknown>(`/api/products/${encodeURIComponent(id)}`, signal))
export const createProduct = async (value: ProductInput, signal: AbortSignal) => validated(productDetailSchema, await request<unknown>('/api/products', signal, { method: 'POST', body: value }))
export const updateProduct = async (id: string, value: Partial<ProductInput> & { active?: boolean }, signal: AbortSignal) => validated(productDetailSchema, await request<unknown>(`/api/products/${encodeURIComponent(id)}`, signal, { method: 'PATCH', body: value }))
export const createAlias = async (productId: string, value: string, signal: AbortSignal) => validated(manualAliasSchema, await request<unknown>(`/api/products/${encodeURIComponent(productId)}/aliases`, signal, { method: 'POST', body: { value } }))
export const updateAlias = async (productId: string, aliasId: string, value: string, signal: AbortSignal) => validated(manualAliasSchema, await request<unknown>(`/api/products/${encodeURIComponent(productId)}/aliases/${encodeURIComponent(aliasId)}`, signal, { method: 'PATCH', body: { value } }))
export const deleteAlias = (productId: string, aliasId: string, signal: AbortSignal) => request<void>(`/api/products/${encodeURIComponent(productId)}/aliases/${encodeURIComponent(aliasId)}`, signal, { method: 'DELETE' })
