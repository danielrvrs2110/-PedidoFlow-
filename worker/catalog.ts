import { z } from 'zod'
import { AuthorizationError, requireCapability, resolveOrganizationContext, type OrganizationContext } from './authorization.js'
import { catalogRepository, normalizeProductAlias, type ProductValues } from './db/repository.js'
import type { AuthBindings } from './auth.js'

const privateHeaders = { 'cache-control': 'no-store', pragma: 'no-cache' }
const visible = (minimum: number, maximum: number) => z.string().transform(value => value.normalize('NFC').trim()).refine(value => [...value].length >= minimum && [...value].length <= maximum)
const collapsed = (minimum: number, maximum: number) => z.string().transform(value => value.normalize('NFC').trim().replace(/\s+/gu, ' ')).refine(value => [...value].length >= minimum && [...value].length <= maximum)
const productShape = { sku: visible(1, 64), name: collapsed(1, 160), variant: z.union([z.null(), collapsed(1, 120)]), orderUnit: collapsed(1, 40), unitQuantityMilli: z.number().int().safe().positive().nullable(), unitMeasure: z.union([z.null(), visible(1, 24)]), active: z.boolean() }
const paired = (value: { unitQuantityMilli: number | null; unitMeasure: string | null }) => (value.unitQuantityMilli === null) === (value.unitMeasure === null)
const productCreateSchema = z.strictObject({ sku: productShape.sku, name: productShape.name, variant: productShape.variant.optional().default(null), orderUnit: productShape.orderUnit, unitQuantityMilli: productShape.unitQuantityMilli.optional().default(null), unitMeasure: productShape.unitMeasure.optional().default(null), active: productShape.active.optional().default(true) }).refine(paired)
const productPatchSchema = z.strictObject({ sku: productShape.sku.optional(), name: productShape.name.optional(), variant: productShape.variant.optional(), orderUnit: productShape.orderUnit.optional(), unitQuantityMilli: productShape.unitQuantityMilli.optional(), unitMeasure: productShape.unitMeasure.optional(), active: productShape.active.optional() }).refine(value => Object.keys(value).length > 0)
const aliasSchema = z.strictObject({ value: visible(1, 160) })
type Status = 'active' | 'inactive' | 'all'
type Cursor = { v: 1; n: string; i: string; f: string }

function fingerprint(status: Status, q: string | null) {
  let hash = 2166136261
  for (const character of `${status}\0${q ?? ''}`) hash = Math.imul(hash ^ character.codePointAt(0)!, 16777619)
  return (hash >>> 0).toString(16).padStart(8, '0')
}
function encodeCursor(cursor: Cursor) {
  const bytes = new TextEncoder().encode(JSON.stringify(cursor)); let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
}
function decodeCursor(value: string, expected: string) {
  if (value.length > 2048 || !/^[A-Za-z0-9_-]+$/u.test(value)) throw invalidRequest()
  try {
    const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4)
    const bytes = Uint8Array.from(atob(padded), character => character.charCodeAt(0))
    const parsed = z.strictObject({ v: z.literal(1), n: z.string().refine(name => [...name].length <= 160), i: z.string().min(1).max(128), f: z.string().regex(/^[0-9a-f]{8}$/u) }).parse(JSON.parse(new TextDecoder().decode(bytes)))
    if (parsed.f !== expected || encodeCursor(parsed) !== value) throw new Error('cursor mismatch')
    return { name: parsed.n, id: parsed.i }
  } catch { throw invalidRequest() }
}

class CatalogHttpError extends Error {
  readonly status: 400 | 404 | 409
  readonly code: 'invalid_request' | 'not_found' | 'conflict'
  readonly field?: 'sku' | 'alias'
  constructor(status: 400 | 404 | 409, code: 'invalid_request' | 'not_found' | 'conflict', message: string, field?: 'sku' | 'alias') {
    super(message); this.status = status; this.code = code; this.field = field
  }
}
const invalidRequest = () => new CatalogHttpError(400, 'invalid_request', 'Invalid request')
const notFound = () => new CatalogHttpError(404, 'not_found', 'Resource not found')
const newId = (prefix: 'prod' | 'alias') => `${prefix}_${crypto.randomUUID().replaceAll('-', '')}`
async function jsonBody(request: Request) {
  if (!/^application\/json(?:\s*;|$)/u.test(request.headers.get('content-type')?.toLowerCase() ?? '')) throw invalidRequest()
  try { return await request.json() } catch { throw invalidRequest() }
}
function contextFailureResponse(type: 'unauthenticated' | 'no_access' | 'selection_required') {
  if (type === 'unauthenticated') return Response.json({ error: 'unauthenticated', message: 'Authentication required' }, { status: 401, headers: privateHeaders })
  return Response.json({ error: type, message: type === 'selection_required' ? 'Organization selection is required' : 'No active organization access' }, { status: 403, headers: privateHeaders })
}
function responseError(error: unknown) {
  if (error instanceof AuthorizationError) return Response.json({ error: 'forbidden', message: 'Forbidden' }, { status: 403, headers: privateHeaders })
  if (error instanceof CatalogHttpError) return Response.json(error.code === 'conflict' ? { error: error.code, field: error.field!, message: error.message } : { error: error.code, message: error.message }, { status: error.status, headers: privateHeaders })
  return Response.json({ error: 'internal_error', message: 'Unable to complete catalog request' }, { status: 500, headers: privateHeaders })
}
function isUnique(error: unknown, table: string): boolean {
  if (!(error instanceof Error)) return false
  if (error.message.includes('UNIQUE constraint failed') && error.message.includes(table)) return true
  return isUnique(error.cause, table)
}
async function withContext(request: Request, bindings: AuthBindings, capability: 'read_operational_data' | 'manage_catalog_customers_pricing', action: (context: OrganizationContext) => Promise<Response>) {
  try {
    const result = await resolveOrganizationContext(request, bindings)
    if (!result.ok) return contextFailureResponse(result.failure.type)
    requireCapability(result.context, capability)
    return await action(result.context)
  } catch (error) { return responseError(error) }
}

export function listProducts(request: Request, bindings: AuthBindings) {
  return withContext(request, bindings, 'read_operational_data', async context => {
    const params = new URL(request.url).searchParams; const allowed = new Set(['status', 'q', 'limit', 'cursor'])
    if ([...params.keys()].some(key => !allowed.has(key)) || [...allowed].some(key => params.getAll(key).length > 1)) throw invalidRequest()
    const rawStatus = params.get('status') ?? 'active'
    if (!['active', 'inactive', 'all'].includes(rawStatus)) throw invalidRequest()
    const status = rawStatus as Status
    const qResult = params.has('q') ? visible(1, 160).safeParse(params.get('q')) : null
    if (qResult && !qResult.success) throw invalidRequest()
    const q = qResult?.data ?? null
    const rawLimit = params.get('limit'); const limit = rawLimit === null ? 50 : Number(rawLimit)
    if (!Number.isInteger(limit) || limit < 1 || limit > 100 || (rawLimit !== null && `${limit}` !== rawLimit)) throw invalidRequest()
    const filter = fingerprint(status, q); const rawCursor = params.get('cursor')
    const rows = await catalogRepository(bindings.DB, context).listProducts({ status, q, limit, after: rawCursor ? decodeCursor(rawCursor, filter) : null })
    const items = rows.slice(0, limit); const last = items.at(-1)
    return Response.json({ items, nextCursor: rows.length > limit && last ? encodeCursor({ v: 1, n: last.name, i: last.id, f: filter }) : null }, { headers: privateHeaders })
  })
}
export function getProduct(request: Request, bindings: AuthBindings, id: string) {
  return withContext(request, bindings, 'read_operational_data', async context => { const value = await catalogRepository(bindings.DB, context).findProductDetail(id); if (!value) throw notFound(); return Response.json(value, { headers: privateHeaders }) })
}
export function createProduct(request: Request, bindings: AuthBindings) {
  return withContext(request, bindings, 'manage_catalog_customers_pricing', async context => {
    const parsed = productCreateSchema.safeParse(await jsonBody(request)); if (!parsed.success) throw invalidRequest()
    try { return Response.json(await catalogRepository(bindings.DB, context).createProduct(newId('prod'), parsed.data, Date.now()), { status: 201, headers: privateHeaders }) }
    catch (error) { if (isUnique(error, 'products')) throw new CatalogHttpError(409, 'conflict', 'SKU already exists', 'sku'); throw error }
  })
}
export function updateProduct(request: Request, bindings: AuthBindings, id: string) {
  return withContext(request, bindings, 'manage_catalog_customers_pricing', async context => {
    const parsed = productPatchSchema.safeParse(await jsonBody(request)); if (!parsed.success) throw invalidRequest()
    const repository = catalogRepository(bindings.DB, context); const existing = await repository.findProductDetail(id); if (!existing) throw notFound()
    const { aliases: _a, createdAt: _c, updatedAt: _u, id: _i, ...stored } = existing
    const merged = productCreateSchema.safeParse({ ...stored, ...parsed.data }); if (!merged.success) throw invalidRequest()
    if ((Object.keys(merged.data) as (keyof ProductValues)[]).every(key => merged.data[key] === stored[key])) return Response.json(existing, { headers: privateHeaders })
    try { const value = await repository.updateProduct(id, merged.data, Date.now()); if (!value) throw notFound(); return Response.json(value, { headers: privateHeaders }) }
    catch (error) { if (isUnique(error, 'products')) throw new CatalogHttpError(409, 'conflict', 'SKU already exists', 'sku'); throw error }
  })
}
export function createAlias(request: Request, bindings: AuthBindings, product: string) {
  return withContext(request, bindings, 'manage_catalog_customers_pricing', async context => {
    const parsed = aliasSchema.safeParse(await jsonBody(request)); if (!parsed.success) throw invalidRequest()
    try { const value = await catalogRepository(bindings.DB, context).createAlias(newId('alias'), product, parsed.data.value, normalizeProductAlias(parsed.data.value), Date.now()); if (!value) throw notFound(); return Response.json(value, { status: 201, headers: privateHeaders }) }
    catch (error) { if (isUnique(error, 'product_aliases')) throw new CatalogHttpError(409, 'conflict', 'Alias already exists for this product', 'alias'); throw error }
  })
}
export function updateAlias(request: Request, bindings: AuthBindings, product: string, alias: string) {
  return withContext(request, bindings, 'manage_catalog_customers_pricing', async context => {
    const parsed = aliasSchema.safeParse(await jsonBody(request)); if (!parsed.success) throw invalidRequest()
    const repository = catalogRepository(bindings.DB, context)
    const existing = await repository.findManualAlias(alias, product); if (!existing) throw notFound()
    if (existing.value === parsed.data.value) return Response.json(existing, { headers: privateHeaders })
    try { const value = await repository.updateAlias(alias, product, parsed.data.value, normalizeProductAlias(parsed.data.value), Date.now()); if (!value) throw notFound(); return Response.json(value, { headers: privateHeaders }) }
    catch (error) { if (isUnique(error, 'product_aliases')) throw new CatalogHttpError(409, 'conflict', 'Alias already exists for this product', 'alias'); throw error }
  })
}
export function deleteAlias(request: Request, bindings: AuthBindings, product: string, alias: string) {
  return withContext(request, bindings, 'manage_catalog_customers_pricing', async context => { if (!await catalogRepository(bindings.DB, context).removeAlias(alias, product)) throw notFound(); return new Response(null, { status: 204, headers: privateHeaders }) })
}
export function methodNotAllowed(request: Request, bindings: AuthBindings, allow: string, capability: 'read_operational_data' | 'manage_catalog_customers_pricing') {
  return withContext(request, bindings, capability, async () => Response.json({ error: 'method_not_allowed', message: 'Method not allowed' }, { status: 405, headers: { ...privateHeaders, allow } }))
}
