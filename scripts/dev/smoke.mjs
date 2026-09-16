import { spawn, spawnSync } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import { chmod, lstat, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../../', import.meta.url))
const state = path.join(root, '.wrangler', `pf021-smoke-${process.pid}-${randomBytes(4).toString('hex')}`)
const configPath = path.join(root, 'wrangler.database.json')
const devVarsPath = path.join(root, 'config', 'local', '.dev.vars')
const wrangler = path.join(root, 'node_modules/wrangler/bin/wrangler.js')
const vite = path.join(root, 'node_modules/vite/bin/vite.js')
const baseURL = 'http://localhost:5173'
let createdDevVars = false
let server

function runWrangler(args) {
  const result = spawnSync(process.execPath, [wrangler, 'd1', ...args, '--local', '--config', configPath, '--persist-to', state], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: 'true' },
  })
  if (result.status !== 0) throw new Error(`${result.stdout}\n${result.stderr}`)
  return `${result.stdout}${result.stderr}`
}

async function startServer() {
  server = spawn(process.execPath, [vite, '--host', '127.0.0.1', '--port', '5173', '--strictPort'], {
    cwd: root,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PEDIDOFLOW_LOCAL_PERSIST_PATH: state, WRANGLER_SEND_METRICS: 'false' },
  })
  let output = ''
  server.stdout.on('data', chunk => { output += chunk })
  server.stderr.on('data', chunk => { output += chunk })
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Vite exited before readiness:\n${output}`)
    try {
      const response = await fetch(`${baseURL}/api/health`)
      if (response.ok) return
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error(`Timed out waiting for Vite:\n${output}`)
}

async function stopServer() {
  if (!server || server.exitCode !== null) return
  const exited = new Promise(resolve => server.once('exit', resolve))
  process.kill(-server.pid, 'SIGTERM')
  await Promise.race([exited, new Promise(resolve => setTimeout(resolve, 5000))])
  if (server.exitCode === null) process.kill(-server.pid, 'SIGKILL')
  server = undefined
}

async function jsonRequest(pathname, init = {}) {
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

try {
  await mkdir(state, { recursive: true })
  try {
    if ((await lstat(devVarsPath)).isSymbolicLink()) throw new Error('.dev.vars must not be a symlink')
    const contents = await readFile(devVarsPath, 'utf8')
    const secret = contents.match(/^BETTER_AUTH_SECRET\s*=\s*["']?([^\r\n"']+)["']?\s*$/m)?.[1]
    if (!secret || secret.length < 32 || secret === 'CHANGEME') throw new Error('.dev.vars needs a valid local BETTER_AUTH_SECRET')
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    await writeFile(devVarsPath, `BETTER_AUTH_SECRET="${randomBytes(32).toString('base64url')}"\n`, { mode: 0o600, flag: 'wx' })
    await chmod(devVarsPath, 0o600)
    createdDevVars = true
  }

  runWrangler(['migrations', 'apply', 'DB'])

  const email = `pf021-${randomUUID()}@example.test`
  const password = `local-${randomBytes(18).toString('base64url')}`
  const commonHeaders = { 'content-type': 'application/json', origin: baseURL }

  await startServer()
  const signup = await jsonRequest('/api/auth/sign-up/email', {
    method: 'POST', headers: commonHeaders, body: JSON.stringify({ name: 'PF-021 Smoke', email, password }),
  })
  if (!signup.response.ok || !signup.body?.user?.id) {
    throw new Error(`Signup failed (${signup.response.status}): ${JSON.stringify(signup.body)}`)
  }
  const userId = signup.body.user.id
  if (!/^[A-Za-z0-9_-]+$/.test(userId)) throw new Error('Unexpected generated user ID')
  await stopServer()

  const now = Date.now()
  const organizationId = `org_pf021_${randomBytes(8).toString('hex')}`
  runWrangler(['execute', 'DB', '--command',
    `INSERT INTO organizations (id,name,slug,status,created_at,updated_at) VALUES ('${organizationId}','PF-021 Smoke','${organizationId}','active',${now},${now}); INSERT INTO organization_members (organization_id,user_id,role,status,created_at,updated_at) VALUES ('${organizationId}','${userId}','owner','active',${now},${now});`,
  ])

  await startServer()
  const login = await jsonRequest('/api/auth/sign-in/email', {
    method: 'POST', headers: commonHeaders, body: JSON.stringify({ email, password }),
  })
  if (!login.response.ok) throw new Error(`Login failed (${login.response.status}): ${JSON.stringify(login.body)}`)
  const cookie = cookieFrom(login.response)
  if (!cookie) throw new Error('Login did not return a session cookie')

  const session = await jsonRequest('/api/auth/get-session', { headers: { cookie } })
  if (!session.response.ok || session.body?.user?.email !== email || JSON.stringify(session.body).includes('token')) {
    throw new Error(`Session verification failed (${session.response.status})`)
  }

  const context = await jsonRequest('/api/context', { headers: { cookie } })
  if (!context.response.ok || context.body?.organizationId !== organizationId || context.body?.actorUserId !== userId || context.body?.role !== 'owner') {
    throw new Error(`Organization context failed (${context.response.status}): ${JSON.stringify(context.body)}`)
  }

  const logout = await jsonRequest('/api/auth/sign-out', {
    method: 'POST', headers: { ...commonHeaders, cookie }, body: '{}',
  })
  if (!logout.response.ok) throw new Error(`Logout failed (${logout.response.status})`)
  const revoked = await jsonRequest('/api/context', { headers: { cookie } })
  if (revoked.response.status !== 401 || revoked.body?.error !== 'unauthenticated') {
    throw new Error(`Logout revocation failed (${revoked.response.status}): ${JSON.stringify(revoked.body)}`)
  }

  console.log('PF-021 local HTTP smoke passed: signup, login, redacted session, organization context, logout and revocation.')
} finally {
  await stopServer()
  await rm(state, { recursive: true, force: true })
  if (createdDevVars) await rm(devVarsPath, { force: true })
}
