import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getPlatformProxy } from 'wrangler'
import app from './index.js'
import type { AuthBindings } from './auth.js'

const root = fileURLToPath(new URL('../', import.meta.url).href)
const baseURL = 'http://localhost:5173'
const password = 'catalog-test-password-123'
let db: D1Database
let dispose: () => Promise<void>
const cookies = new Map<string, string>()

function bindings(): AuthBindings {
  return { DB: db, BETTER_AUTH_SECRET: 'catalog-test-secret-with-at-least-thirty-two-characters', BETTER_AUTH_URL: baseURL, BETTER_AUTH_TRUSTED_ORIGINS: baseURL, PEDIDOFLOW_ENVIRONMENT: 'test' }
}
async function api(path: string, init: RequestInit = {}, label = 'owner') {
  const cookie = cookies.get(label)
  return app.request(`${baseURL}${path}`, { ...init, headers: { origin: baseURL, ...(cookie ? { cookie } : {}), ...init.headers } }, bindings())
}
async function signUp(label: string) {
  const email = `${label}@catalog.test`
  const response = await app.request(`${baseURL}/api/auth/sign-up/email`, { method: 'POST', headers: { origin: baseURL, 'content-type': 'application/json' }, body: JSON.stringify({ name: label, email, password }) }, bindings())
  const cookie = (response.headers.get('set-cookie') ?? '').split(';', 1)[0]
  const user = await db.prepare('SELECT id FROM user WHERE email=?').bind(email).first<{ id: string }>()
  cookies.set(label, cookie)
  return user!.id
}
function expectPrivate(response: Response) {
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(response.headers.get('pragma')).toBe('no-cache')
}
function json(method: string, body: unknown): RequestInit { return { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } }

beforeAll(async () => {
  const platform = await getPlatformProxy<{ DB: D1Database }>({ configPath: `${root}/wrangler.database.json`, persist: false, remoteBindings: false })
  dispose = platform.dispose; db = platform.env.DB
  for (const name of (await readdir(`${root}/worker/db/migrations`)).filter(name => name.endsWith('.sql')).sort()) {
    const contents = await readFile(`${root}/worker/db/migrations/${name}`, 'utf8')
    for (const statement of contents.split('--> statement-breakpoint').filter(part => part.trim())) await db.prepare(statement).run()
  }
  const users = { owner: await signUp('owner'), admin: await signUp('admin'), operator: await signUp('operator'), picker: await signUp('picker'), other: await signUp('other') }
  await db.batch([
    db.prepare("INSERT INTO organizations VALUES ('org_a','Alpha','alpha','active',0,0)"),
    db.prepare("INSERT INTO organizations VALUES ('org_b','Beta','beta','active',0,0)"),
    ...Object.entries(users).map(([label, id]) => db.prepare('INSERT INTO organization_members VALUES (?,?,?,?,0,0)').bind(label === 'other' ? 'org_b' : 'org_a', id, label === 'other' ? 'owner' : label, 'active')),
    db.prepare("INSERT INTO products VALUES ('prod_a1','org_a','SKU-A','apple','Red','box',12000,'kg',1,1,1)"),
    db.prepare("INSERT INTO products VALUES ('prod_a2','org_a','SKU_%','Apple','Green','case',NULL,NULL,1,2,2)"),
    db.prepare("INSERT INTO products VALUES ('prod_a3','org_a','OLD','Zeta',NULL,'piece',NULL,NULL,0,3,3)"),
    db.prepare("INSERT INTO products VALUES ('prod_b1','org_b','SKU-A','Foreign',NULL,'box',NULL,NULL,1,1,1)"),
    db.prepare("INSERT INTO product_aliases VALUES ('alias_manual','org_a','prod_a1','Manzana','manzana','manual',1,1)"),
    db.prepare("INSERT INTO product_aliases VALUES ('alias_import','org_a','prod_a1','Imported','imported','import',1,1)"),
  ])
}, 30_000)
afterAll(async () => { await dispose?.() })

describe('PF-026 product catalog HTTP API', () => {
  it('requires a session and rejects picker before resource disclosure', async () => {
    const anonymous = await app.request(`${baseURL}/api/products`, {}, bindings())
    expect(anonymous.status).toBe(401); expectPrivate(anonymous)
    const picker = await api('/api/products/prod_a1', {}, 'picker')
    expect(picker.status).toBe(403); expectPrivate(picker)
    await expect(picker.json()).resolves.toEqual({ error: 'forbidden', message: 'Forbidden' })
  })

  it.each(['owner', 'admin', 'operator'])('allows %s to read and mutate catalog records', async label => {
    expect((await api('/api/products', {}, label)).status).toBe(200)
    const response = await api('/api/products', json('POST', { sku: `ROLE-${label}`, name: `Role ${label}`, orderUnit: 'piece' }), label)
    expect(response.status).toBe(201)
  })

  it('lists tenant products with exact DTOs, status filters and stable equal-name pagination', async () => {
    const first = await api('/api/products?status=all&limit=1')
    expect(first.status).toBe(200); expectPrivate(first)
    const page = await first.json<{ items: Array<Record<string, unknown>>; nextCursor: string }>()
    expect(page.items).toHaveLength(1)
    expect(page.items[0]).toEqual({ id: 'prod_a1', sku: 'SKU-A', name: 'apple', variant: 'Red', orderUnit: 'box', unitQuantityMilli: 12000, unitMeasure: 'kg', active: true, aliasCount: 1, createdAt: 1, updatedAt: 1 })
    expect(JSON.stringify(page)).not.toContain('org_a')
    const second = await api(`/api/products?status=all&limit=1&cursor=${page.nextCursor}`)
    const next = await second.json<{ items: Array<{ id: string }>; nextCursor: string }>()
    expect(next.items[0].id).toBe('prod_a2')
    expect(next.items[0].id).not.toBe(page.items[0].id)
  })

  it('matches search literally and rejects invalid queries and cursor/filter mismatch', async () => {
    expect((await (await api('/api/products?q=_%25')).json<{ items: unknown[] }>()).items).toHaveLength(1)
    const page = await (await api('/api/products?status=all&limit=1')).json<{ nextCursor: string }>()
    for (const path of ['/api/products?unknown=x', '/api/products?limit=01', `/api/products?status=active&cursor=${page.nextCursor}`, '/api/products?cursor=%%%']) {
      const response = await api(path); expect(response.status).toBe(400); expectPrivate(response)
    }
  })

  it('creates, reads, patches and deactivates within the verified tenant', async () => {
    const create = await api('/api/products', json('POST', { sku: '  MixedCase  ', name: '  Nuevo   producto ', orderUnit: ' caja ', unitQuantityMilli: 1000, unitMeasure: ' kg ', organizationId: 'org_b' }))
    expect(create.status).toBe(400)
    const valid = await api('/api/products', json('POST', { sku: '  MixedCase  ', name: '  Nuevo   producto ', orderUnit: ' caja ', unitQuantityMilli: 1000, unitMeasure: ' kg ' }))
    expect(valid.status).toBe(201); expectPrivate(valid)
    const product = await valid.json<{ id: string; sku: string; name: string; active: boolean; aliases: unknown[] }>()
    expect(product).toMatchObject({ sku: 'MixedCase', name: 'Nuevo producto', active: true, aliases: [] })
    const update = await api(`/api/products/${product.id}`, json('PATCH', { active: false }))
    expect(update.status).toBe(200); expect((await update.json<{ active: boolean }>()).active).toBe(false)
    const noOp = await api(`/api/products/${product.id}`, json('PATCH', { active: false }))
    expect(noOp.status).toBe(200)
    expect((await db.prepare('SELECT organization_id FROM products WHERE id=?').bind(product.id).first<{ organization_id: string }>())?.organization_id).toBe('org_a')
  })

  it('returns safe conflicts while allowing the same SKU in another tenant', async () => {
    const conflict = await api('/api/products', json('POST', { sku: 'SKU-A', name: 'Duplicate', orderUnit: 'box' }))
    expect(conflict.status).toBe(409)
    await expect(conflict.json()).resolves.toEqual({ error: 'conflict', field: 'sku', message: 'SKU already exists' })
    const tenantA = await api('/api/products', json('POST', { sku: 'SHARED-NEW', name: 'Shared A', orderUnit: 'box' }))
    const tenantB = await api('/api/products', json('POST', { sku: 'SHARED-NEW', name: 'Shared B', orderUnit: 'box' }), 'other')
    expect(tenantA.status).toBe(201); expect(tenantB.status).toBe(201)
  })

  it('manages only manual aliases and permits the same alias on different products', async () => {
    const created = await api('/api/products/prod_a2/aliases', json('POST', { value: '  MANZANA  ' }))
    expect(created.status).toBe(201)
    const alias = await created.json<{ id: string; value: string }>()
    expect(alias.value).toBe('MANZANA')
    const duplicate = await api('/api/products/prod_a2/aliases', json('POST', { value: 'manzana' }))
    expect(duplicate.status).toBe(409)
    expect((await api('/api/products/prod_a1/aliases/alias_import', json('PATCH', { value: 'changed' }))).status).toBe(404)
    expect((await api('/api/products/prod_a1/aliases/alias_import', { method: 'DELETE' })).status).toBe(404)
    const changed = await api(`/api/products/prod_a2/aliases/${alias.id}`, json('PATCH', { value: 'Fruta roja' }))
    expect(changed.status).toBe(200)
    const changedAlias = await changed.json<{ updatedAt: number }>()
    const noOp = await api(`/api/products/prod_a2/aliases/${alias.id}`, json('PATCH', { value: 'Fruta roja' }))
    expect(noOp.status).toBe(200)
    expect((await noOp.json<{ updatedAt: number }>()).updatedAt).toBe(changedAlias.updatedAt)
    const removed = await api(`/api/products/prod_a2/aliases/${alias.id}`, { method: 'DELETE' })
    expect(removed.status).toBe(204); expectPrivate(removed); expect(await removed.text()).toBe('')
  })

  it('uses uniform 404s for absent and cross-tenant product and alias IDs', async () => {
    const responses = [await api('/api/products/missing'), await api('/api/products/prod_b1'), await api('/api/products/prod_b1/aliases', json('POST', { value: 'x' })), await api('/api/products/prod_b1/aliases/alias_foreign', { method: 'DELETE' })]
    for (const response of responses) { expect(response.status).toBe(404); await expect(response.json()).resolves.toEqual({ error: 'not_found', message: 'Resource not found' }) }
  })

  it('validates strict bodies and paired quantity fields', async () => {
    const requests = [
      api('/api/products', { method: 'POST', body: '{}' }),
      api('/api/products', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' }),
      api('/api/products', json('POST', { sku: 'X', name: 'X', orderUnit: 'box', unitQuantityMilli: 1 })),
      api('/api/products/prod_a1', json('PATCH', {})),
      api('/api/products/prod_a1', json('PATCH', { unitMeasure: null })),
      api('/api/products/prod_a1/aliases', json('POST', { value: 'x', source: 'manual' })),
    ]
    for (const pending of requests) { const response = await pending; expect(response.status).toBe(400); expectPrivate(response) }
  })

  it('returns structured 405 responses with Allow and preserves unknown API 404', async () => {
    const anonymous = await app.request(`${baseURL}/api/products`, { method: 'DELETE' }, bindings())
    expect(anonymous.status).toBe(401); expectPrivate(anonymous)
    const response = await api('/api/products', { method: 'DELETE' })
    expect(response.status).toBe(405); expect(response.headers.get('allow')).toBe('GET, POST'); expectPrivate(response)
    const unknown = await api('/api/products/prod_a1/unknown')
    expect(unknown.status).toBe(404)
  })
})
