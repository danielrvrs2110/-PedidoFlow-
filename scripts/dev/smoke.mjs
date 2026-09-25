import { spawn, spawnSync } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import { chmod, mkdir, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../../', import.meta.url))
const state = path.join(root, '.wrangler', `pf021-smoke-${process.pid}-${randomBytes(4).toString('hex')}`)
const persistence = path.join(state, 'persist')
const configDirectory = path.join(state, 'config')
const configPath = path.join(configDirectory, 'wrangler.smoke.jsonc')
const secretPath = path.join(configDirectory, '.dev.vars')
const databaseConfig = path.join(root, 'wrangler.database.json')
const wrangler = path.join(root, 'node_modules/wrangler/bin/wrangler.js')
const vite = path.join(root, 'node_modules/vite/bin/vite.js')
let server
let serverExit

function runWrangler(args) {
  const result = spawnSync(process.execPath, [wrangler, 'd1', ...args, '--local', '--config', databaseConfig, '--persist-to', persistence], {
    cwd: root, encoding: 'utf8', env: { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: 'true' },
  })
  if (result.status !== 0) throw new Error(`${result.stdout}\n${result.stderr}`)
}

async function reservePort() {
  const socket = createServer()
  await new Promise((resolve, reject) => {
    socket.once('error', reject)
    socket.listen(0, '127.0.0.1', resolve)
  })
  const address = socket.address()
  if (!address || typeof address === 'string') throw new Error('Could not reserve an isolated smoke port')
  await new Promise((resolve, reject) => socket.close(error => error ? reject(error) : resolve()))
  return address.port
}

function hasExited(child) {
  return child.exitCode !== null || child.signalCode !== null
}

async function waitForExit(child, milliseconds) {
  if (hasExited(child)) return true
  return Promise.race([
    serverExit.then(() => true),
    new Promise(resolve => setTimeout(() => resolve(false), milliseconds)),
  ])
}

function signalServer(child, signal) {
  try {
    process.kill(-child.pid, signal)
  } catch (error) {
    if (error.code !== 'ESRCH' || !hasExited(child)) throw error
  }
}

async function startServer(port, baseURL) {
  if (server) throw new Error('Smoke runtime ownership error: a child is already registered')
  let output = ''
  const child = spawn(process.execPath, [vite, '--host', '127.0.0.1', '--port', `${port}`, '--strictPort'], {
    cwd: root, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      PEDIDOFLOW_LOCAL_CONFIG_PATH: configPath,
      PEDIDOFLOW_LOCAL_PERSIST_PATH: persistence,
      WRANGLER_SEND_METRICS: 'false',
    },
  })
  server = child
  serverExit = new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', (code, signal) => resolve({ code, signal }))
  })
  child.stdout.on('data', chunk => { output += chunk })
  child.stderr.on('data', chunk => { output += chunk })
  for (let attempt = 0; attempt < 150; attempt += 1) {
    if (hasExited(child)) {
      const result = await serverExit
      throw new Error(`Owned Vite child exited before readiness (${result.code ?? result.signal}):\n${output}`)
    }
    if (output.includes('ready in')) {
      try {
        const response = await fetch(`${baseURL}/api/health`)
        if (response.ok && (await response.json()).service === 'pedidoflow-api' && !hasExited(child)) return
      } catch {}
    }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error(`Timed out waiting for the owned Vite child:\n${output}`)
}

async function stopServer() {
  if (!server) return
  const child = server
  if (!hasExited(child)) signalServer(child, 'SIGTERM')
  let exited = await waitForExit(child, 5000)
  if (!exited) {
    signalServer(child, 'SIGKILL')
    exited = await waitForExit(child, 5000)
  }
  if (!exited || !hasExited(child)) {
    throw new Error('Could not confirm termination of the owned Vite child; isolated state was preserved')
  }
  await serverExit
  server = undefined
  serverExit = undefined
}

async function jsonRequest(baseURL, pathname, init = {}) {
  const response = await fetch(`${baseURL}${pathname}`, init)
  const text = await response.text()
  let body
  try { body = text ? JSON.parse(text) : null } catch { body = text }
  return { response, body }
}

function cookieFrom(response) {
  const cookies = response.headers.getSetCookie?.() ?? [response.headers.get('set-cookie')].filter(Boolean)
  return cookies.map(value => value.split(';', 1)[0]).join('; ')
}

let safeToClean = false
try {
  const port = await reservePort()
  const baseURL = `http://127.0.0.1:${port}`
  await mkdir(configDirectory, { recursive: true })
  await mkdir(persistence, { recursive: true })
  await writeFile(configPath, `${JSON.stringify({
    $schema: path.join(root, 'node_modules/wrangler/config-schema.json'),
    name: `pedidoflow-pf021-smoke-${process.pid}`,
    main: path.join(root, 'worker/index.ts'),
    compatibility_date: '2026-09-07',
    compatibility_flags: ['nodejs_compat'],
    assets: { not_found_handling: 'single-page-application', run_worker_first: ['/api/*'] },
    d1_databases: [{
      binding: 'DB', database_name: 'pedidoflow-development-only',
      database_id: '00000000-0000-0000-0000-000000000017', remote: false,
      migrations_dir: path.join(root, 'worker/db/migrations'),
    }],
    vars: { BETTER_AUTH_URL: baseURL, BETTER_AUTH_TRUSTED_ORIGINS: baseURL, PEDIDOFLOW_ENVIRONMENT: 'local' },
    secrets: { required: ['BETTER_AUTH_SECRET'] },
  }, null, 2)}\n`, { flag: 'wx' })
  await writeFile(secretPath, `BETTER_AUTH_SECRET="${randomBytes(32).toString('base64url')}"\n`, { mode: 0o600, flag: 'wx' })
  await chmod(secretPath, 0o600)
  runWrangler(['migrations', 'apply', 'DB'])

  const email = `pf021-${randomUUID()}@example.test`
  const password = `local-${randomBytes(18).toString('base64url')}`
  const headers = { 'content-type': 'application/json', origin: baseURL }
  await startServer(port, baseURL)
  const signup = await jsonRequest(baseURL, '/api/auth/sign-up/email', {
    method: 'POST', headers, body: JSON.stringify({ name: 'PF-021 Smoke', email, password }),
  })
  if (!signup.response.ok || !signup.body?.user?.id) throw new Error(`Signup failed (${signup.response.status})`)
  const userId = signup.body.user.id
  if (!/^[A-Za-z0-9_-]+$/.test(userId)) throw new Error('Unexpected generated user ID')
  await stopServer()

  const now = Date.now()
  const organizationId = `org_pf021_${randomBytes(8).toString('hex')}`
  runWrangler(['execute', 'DB', '--command',
    `INSERT INTO organizations (id,name,slug,status,created_at,updated_at) VALUES ('${organizationId}','PF-021 Smoke','${organizationId}','active',${now},${now}); INSERT INTO organization_members (organization_id,user_id,role,status,created_at,updated_at) VALUES ('${organizationId}','${userId}','owner','active',${now},${now});`,
  ])

  await startServer(port, baseURL)
  const login = await jsonRequest(baseURL, '/api/auth/sign-in/email', {
    method: 'POST', headers, body: JSON.stringify({ email, password }),
  })
  if (!login.response.ok) throw new Error(`Login failed (${login.response.status})`)
  const cookie = cookieFrom(login.response)
  if (!cookie) throw new Error('Login did not return a session cookie')
  const session = await jsonRequest(baseURL, '/api/auth/get-session', { headers: { cookie } })
  if (!session.response.ok || session.body?.user?.email !== email || JSON.stringify(session.body).includes('token')) {
    throw new Error(`Session verification failed (${session.response.status})`)
  }
  const context = await jsonRequest(baseURL, '/api/context', { headers: { cookie } })
  if (!context.response.ok || context.body?.organizationId !== organizationId || context.body?.actorUserId !== userId || context.body?.role !== 'owner') {
    throw new Error(`Organization context failed (${context.response.status})`)
  }
  const logout = await jsonRequest(baseURL, '/api/auth/sign-out', {
    method: 'POST', headers: { ...headers, cookie }, body: '{}',
  })
  if (!logout.response.ok) throw new Error(`Logout failed (${logout.response.status})`)
  const revoked = await jsonRequest(baseURL, '/api/context', { headers: { cookie } })
  if (revoked.response.status !== 401 || revoked.body?.error !== 'unauthenticated') {
    throw new Error(`Logout revocation failed (${revoked.response.status})`)
  }
  await stopServer()
  safeToClean = true
  console.log('PF-021 isolated local HTTP smoke passed: owned runtime, signup, login, redacted session, organization context, logout and revocation.')
} finally {
  if (server) {
    await stopServer()
    safeToClean = true
  }
  if (safeToClean) await rm(state, { recursive: true, force: true })
}
