import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { getPlatformProxy } from 'wrangler'
import app from './index.js'
import { hasCapability, organizationCapabilities, type OrganizationRole } from './authorization.js'
import type { AuthBindings } from './auth.js'

const root = fileURLToPath(new URL('../', import.meta.url).href)
const baseURL = 'http://localhost:5173'
const password = 'local-test-password-123'
let db: D1Database
let dispose: () => Promise<void>
const cookies = new Map<string, string>()
const userIds = new Map<string, string>()

function bindings(): AuthBindings {
  return {
    DB: db,
    BETTER_AUTH_SECRET: 'test-only-secret-with-at-least-thirty-two-characters',
    BETTER_AUTH_URL: baseURL,
    BETTER_AUTH_TRUSTED_ORIGINS: baseURL,
    PEDIDOFLOW_ENVIRONMENT: 'test',
  }
}

function request(path: string, cookie?: string, headers?: HeadersInit) {
  return app.request(`${baseURL}${path}`, {
    headers: { origin: baseURL, ...(cookie ? { cookie } : {}), ...headers },
  }, bindings())
}

function expectPrivateResponse(response: Response) {
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(response.headers.get('pragma')).toBe('no-cache')
}

async function signUp(label: string) {
  const email = `${label}@example.test`
  const response = await app.request(`${baseURL}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: baseURL },
    body: JSON.stringify({ name: label, email, password }),
  }, bindings())
  expect(response.status).toBe(200)
  const cookie = (response.headers.get('set-cookie') ?? '').split(';', 1)[0]
  const row = await db.prepare('SELECT id FROM user WHERE email = ?').bind(email).first<{ id: string }>()
  expect(cookie).toContain('pedidoflow.session_token=')
  expect(row?.id).toBeTruthy()
  cookies.set(label, cookie)
  userIds.set(label, row!.id)
}

async function createOrganization(id: string, status: 'active' | 'suspended' = 'active') {
  await db.prepare('INSERT INTO organizations (id,name,slug,status,created_at,updated_at) VALUES (?,?,?,?,0,0)')
    .bind(id, id, id, status).run()
}

async function addMembership(
  label: string,
  organizationId: string,
  role: OrganizationRole = 'operator',
  status: 'active' | 'invited' = 'active',
) {
  await db.prepare('INSERT INTO organization_members (organization_id,user_id,role,status,created_at,updated_at) VALUES (?,?,?,?,0,0)')
    .bind(organizationId, userIds.get(label), role, status).run()
}

beforeAll(async () => {
  // One ephemeral workerd/D1 instance for the complete suite; no shared local persistence.
  const platform = await getPlatformProxy<{ DB: D1Database }>({
    configPath: `${root}/wrangler.database.json`, persist: false, remoteBindings: false,
  })
  dispose = platform.dispose
  db = platform.env.DB
  for (const name of (await readdir(`${root}/worker/db/migrations`)).filter(name => name.endsWith('.sql')).sort()) {
    const sql = await readFile(`${root}/worker/db/migrations/${name}`, 'utf8')
    for (const statement of sql.split('--> statement-breakpoint').filter(part => part.trim())) {
      await db.prepare(statement).run()
    }
  }

  for (const label of ['none', 'invited', 'suspended', 'single', 'multiple']) await signUp(label)
  for (const id of ['org_active_a', 'org_active_b', 'org_invited']) await createOrganization(id)
  await createOrganization('org_suspended', 'suspended')
  await addMembership('invited', 'org_invited', 'operator', 'invited')
  await addMembership('suspended', 'org_suspended')
  await addMembership('single', 'org_active_a', 'admin')
  await addMembership('multiple', 'org_active_a')
  await addMembership('multiple', 'org_active_b', 'picker')
}, 30_000)

afterAll(async () => { await dispose?.() })

describe('server-derived organization context', () => {
  it('returns 401 without a valid Better Auth session', async () => {
    const response = await request('/api/context')
    expect(response.status).toBe(401)
    expectPrivateResponse(response)
    await expect(response.json()).resolves.toEqual({
      error: 'unauthenticated', message: 'Authentication required',
    })
  })

  it.each([
    ['none', 'zero memberships'],
    ['invited', 'invited membership'],
    ['suspended', 'suspended organization'],
  ])('returns typed no_access for %s (%s)', async label => {
    const response = await request('/api/context', cookies.get(label))
    expect(response.status).toBe(403)
    expectPrivateResponse(response)
    await expect(response.json()).resolves.toEqual({
      error: 'no_access', message: 'No active organization access',
    })
  })

  it('constructs context from the sole active membership and ignores forgeable client identifiers', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const response = await request(
      '/api/context?organizationId=org_active_b&actorUserId=forged&role=owner',
      cookies.get('single'),
      { 'x-organization-id': 'org_active_b', 'x-role': 'owner', 'x-actor-user-id': 'forged' },
    )
    expect(response.status).toBe(200)
    expectPrivateResponse(response)
    const payload = await response.json<Record<string, unknown>>()
    expect(payload).toEqual({
      organizationId: 'org_active_a',
      actorUserId: userIds.get('single'),
      role: 'admin',
    })
    const text = JSON.stringify(payload)
    const stored = await db.prepare('SELECT token FROM session WHERE user_id = ?')
      .bind(userIds.get('single')).first<{ token: string }>()
    expect(text).not.toContain(stored!.token)
    expect(text).not.toContain('session_token')
    const logOutput = JSON.stringify([...error.mock.calls, ...warn.mock.calls])
    expect(logOutput).not.toContain(stored!.token)
    expect(logOutput).not.toContain('session_token')
    error.mockRestore()
    warn.mockRestore()
  })

  it('fails closed with selection_required for multiple active memberships', async () => {
    const response = await request('/api/context', cookies.get('multiple'))
    expect(response.status).toBe(403)
    expectPrivateResponse(response)
    await expect(response.json()).resolves.toEqual({
      error: 'selection_required', message: 'Organization selection is required',
    })
  })
})

describe('central role capability floor', () => {
  const expected: Record<OrganizationRole, readonly string[]> = {
    owner: organizationCapabilities,
    admin: organizationCapabilities.filter(capability => capability !== 'manage_owner_members'),
    operator: [
      'read_operational_data', 'read_fulfillment_data', 'manage_catalog_customers_pricing',
      'create_review_order_drafts', 'confirm_orders', 'update_fulfillment',
    ],
    picker: ['read_fulfillment_data', 'update_fulfillment'],
  }

  it.each(['owner', 'admin', 'operator', 'picker'] as const)('%s has exactly the documented capabilities', role => {
    for (const capability of organizationCapabilities) {
      expect(hasCapability(role, capability), `${role}:${capability}`)
        .toBe(expected[role].includes(capability))
    }
  })
})
