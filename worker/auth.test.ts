import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { getPlatformProxy } from 'wrangler'
import app from './index.js'
import { validateAuthBindings, type AuthBindings, type PedidoFlowEnvironment } from './auth.js'

const root = fileURLToPath(new URL('../', import.meta.url).href)
const baseURL = 'http://localhost:5173'
const password = 'local-test-password-123'
let db: D1Database
let dispose: () => Promise<void>

function bindings(environment: PedidoFlowEnvironment): AuthBindings {
  const authURL = environment === 'preview' || environment === 'production' ? 'https://app.example.test' : baseURL
  return {
    DB: db,
    BETTER_AUTH_SECRET: 'test-only-secret-with-at-least-thirty-two-characters',
    BETTER_AUTH_URL: authURL,
    BETTER_AUTH_TRUSTED_ORIGINS: environment === 'preview' || environment === 'production'
      ? authURL
      : `${baseURL},http://127.0.0.1:5173`,
    PEDIDOFLOW_ENVIRONMENT: environment,
  }
}

function request(path: string, body?: Record<string, unknown>, environment: PedidoFlowEnvironment = 'test', headers?: HeadersInit) {
  const env = bindings(environment)
  return app.request(`${env.BETTER_AUTH_URL}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json', origin: env.BETTER_AUTH_URL, ...headers },
    body: body ? JSON.stringify(body) : undefined,
  }, env)
}

function sessionCookie(response: Response) {
  const setCookie = response.headers.get('set-cookie') ?? ''
  expect(setCookie).toContain('pedidoflow.session_token=')
  expect(setCookie.toLowerCase()).toContain('httponly')
  return setCookie.split(';', 1)[0]
}

beforeAll(async () => {
  // A single ephemeral workerd/D1 instance; no PF-017 local persistence is opened.
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
}, 30_000)

afterAll(async () => { await dispose?.() })

describe('Better Auth identity and database-backed sessions', () => {
  it('signs up only in test/local and does not provision tenant records', async () => {
    const response = await request('/api/auth/sign-up/email', {
      name: 'Persona Local', email: 'local@example.test', password,
    })
    expect(response.status).toBe(200)
    const payload = await response.json<Record<string, unknown>>()
    expect(JSON.stringify(payload)).not.toContain(password)
    expect(payload).not.toHaveProperty('token')
    expect(sessionCookie(response)).toBeTruthy()
    await expect(db.prepare('SELECT count(*) AS count FROM user').first()).resolves.toEqual({ count: 1 })
    await expect(db.prepare('SELECT count(*) AS count FROM organizations').first()).resolves.toEqual({ count: 0 })
    await expect(db.prepare('SELECT count(*) AS count FROM organization_members').first()).resolves.toEqual({ count: 0 })
  })

  it.each(['preview', 'production'] as const)('fails closed for signup in %s', async environment => {
    const response = await request('/api/auth/sign-up/email', {
      name: 'No Provisionar', email: `${environment}@example.test`, password,
    }, environment)
    expect(response.status).toBe(400)
    expect(await response.text()).not.toContain(password)
  })

  it('returns equivalent non-enumerating duplicate-email and invalid-credential errors', async () => {
    const duplicate = await request('/api/auth/sign-up/email', {
      name: 'Otra Persona', email: 'local@example.test', password,
    })
    const invalid = await request('/api/auth/sign-in/email', {
      email: 'missing@example.test', password,
    })
    expect(duplicate.status).toBe(400)
    expect(invalid.status).toBe(401)
    const duplicateText = await duplicate.text()
    const invalidText = await invalid.text()
    expect(duplicateText).not.toContain('local@example.test')
    expect(invalidText).not.toContain('missing@example.test')
    expect(duplicateText).toBe('{"code":"AUTHENTICATION_FAILED","message":"Authentication failed"}')
    expect(invalidText.toLowerCase()).not.toContain('missing')
  })

  it('logs in, reads its database-backed session, logs out, and revokes it', async () => {
    const login = await request('/api/auth/sign-in/email', { email: 'local@example.test', password })
    expect(login.status).toBe(200)
    const cookie = sessionCookie(login)
    const loginText = await login.text()
    expect(loginText).not.toContain(password)
    expect(loginText).not.toContain(cookie.split('=', 2)[1])

    const active = await request('/api/auth/get-session', undefined, 'test', { cookie })
    expect(active.status).toBe(200)
    const activeText = await active.text()
    expect(activeText).toContain('local@example.test')
    expect(activeText).not.toContain(password)
    expect(activeText).not.toContain(cookie.split('=', 2)[1])
    const beforeLogout = await db.prepare('SELECT count(*) AS count FROM session').first<{ count: number }>()

    const logout = await request('/api/auth/sign-out', {}, 'test', { cookie })
    expect(logout.status).toBe(200)
    const revoked = await request('/api/auth/get-session', undefined, 'test', { cookie })
    expect(revoked.status).toBe(200)
    expect(await revoked.json()).toBeNull()
    await expect(db.prepare('SELECT count(*) AS count FROM session').first()).resolves
      .toEqual({ count: (beforeLogout?.count ?? 0) - 1 })
  })

  it('rejects an untrusted Origin for state-changing auth requests', async () => {
    const response = await request('/api/auth/sign-in/email', {
      email: 'local@example.test', password,
    }, 'test', { origin: 'https://attacker.example' })
    expect(response.status).toBe(403)
  })

  it('rejects malformed origin configuration and non-HTTPS deployed origins', () => {
    expect(() => validateAuthBindings({ ...bindings('test'), BETTER_AUTH_TRUSTED_ORIGINS: 'https://safe.example/path' }))
      .toThrow('absolute HTTP origins')
    expect(() => validateAuthBindings({ ...bindings('production'), BETTER_AUTH_URL: baseURL }))
      .toThrow('must use HTTPS')
  })

  it('does not log passwords, cookies, or session tokens during expected failures', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    await request('/api/auth/sign-in/email', { email: 'local@example.test', password: 'wrong-password' })
    const output = JSON.stringify([...error.mock.calls, ...warn.mock.calls])
    expect(output).not.toContain('wrong-password')
    expect(output).not.toContain('session_token')
    error.mockRestore()
    warn.mockRestore()
  })
})
