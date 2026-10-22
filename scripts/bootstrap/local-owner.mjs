import { spawn, spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createInterface } from 'node:readline/promises'
import { createServer } from 'node:net'
import { constants as fsConstants } from 'node:fs'
import { lstat, mkdir, mkdtemp, open, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const projectRoot = fileURLToPath(new URL('../../', import.meta.url))
const FIXED_DATABASE_ID = '00000000-0000-0000-0000-000000000017'

export function normalizeBootstrapInput(input) {
  const email = input.email.trim().toLowerCase()
  const organizationName = input.organizationName.normalize('NFC').trim().replace(/\s+/g, ' ')
  const slug = input.slug.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('Enter a valid email address')
  if (organizationName.length < 2 || organizationName.length > 120) throw new Error('Organization name must contain 2 to 120 characters')
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length < 2 || slug.length > 63) {
    throw new Error('Slug must contain 2 to 63 lowercase letters, numbers or single hyphens')
  }
  if (typeof input.password !== 'string' || input.password.length < 8 || input.password.length > 128) {
    throw new Error('Password must contain 8 to 128 characters')
  }
  return { email, organizationName, slug, password: input.password }
}

async function validateBootstrapConfiguration({ root = projectRoot, configPath, persistencePath } = {}) {
  const fixedConfig = path.join(root, 'config/local/wrangler.jsonc')
  const fixedPersistence = path.join(root, '.wrangler/pf017-local')
  if (configPath && path.resolve(configPath) !== fixedConfig) throw new Error('Bootstrap accepts only the checked-in local config')
  if (persistencePath && path.resolve(persistencePath) !== fixedPersistence) throw new Error('Bootstrap accepts only managed checkout-local persistence')
  const config = JSON.parse(await readFile(fixedConfig, 'utf8'))
  const database = config.d1_databases?.[0]
  if (config.d1_databases?.length !== 1 || config.env || database?.remote !== false || database?.binding !== 'DB' ||
      database?.database_name !== 'pedidoflow-development-only' || database?.database_id !== FIXED_DATABASE_ID ||
      database?.migrations_dir !== '../../worker/db/migrations' || config.vars?.PEDIDOFLOW_ENVIRONMENT !== 'local' ||
      config.secrets?.required?.length !== 1 || config.secrets.required[0] !== 'BETTER_AUTH_SECRET') {
    throw new Error('Validated local-only bootstrap configuration is required')
  }
  for (const target of [path.join(root, '.wrangler'), fixedPersistence, fixedConfig]) {
    const stat = await lstat(target).catch(error => error.code === 'ENOENT' ? undefined : Promise.reject(error))
    if (stat?.isSymbolicLink()) throw new Error('Managed bootstrap paths must not be symlinks')
  }
  await mkdir(fixedPersistence, { recursive: true })
  if (!(await realpath(fixedPersistence)).startsWith(`${await realpath(root)}${path.sep}`)) throw new Error('Persistence must stay inside this worktree')
  const devVarsPath = path.join(root, 'config/local/.dev.vars')
  let secretHandle
  try {
    secretHandle = await open(devVarsPath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW)
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error('Run npm run dev:prepare before bootstrap')
    if (error.code === 'ELOOP') throw new Error('Local .dev.vars must be a regular file, not a symlink')
    throw error
  }
  let secretFile
  try {
    const secretStat = await secretHandle.stat()
    if (!secretStat.isFile()) throw new Error('Local .dev.vars must be a regular file, not a symlink')
    if ((secretStat.mode & 0o777) !== 0o600) throw new Error('Local .dev.vars must use mode 0600')
    if (typeof process.getuid === 'function' && secretStat.uid !== process.getuid()) throw new Error('Local .dev.vars must be owned by the current user')
    secretFile = await secretHandle.readFile('utf8')
  } finally {
    await secretHandle.close()
  }
  const secretMatch = secretFile.match(/^BETTER_AUTH_SECRET="([^"\r\n]+)"\r?\n?$/)
  const secret = secretMatch?.[1]
  if (!secret || secret.length < 32 || secret === 'CHANGEME') throw new Error('A valid ignored local BETTER_AUTH_SECRET is required')
  const check = spawnSync(process.execPath, [path.join(root, 'scripts/db/check.mjs')], {
    cwd: root, encoding: 'utf8', env: { ...process.env, CI: 'true', WRANGLER_SEND_METRICS: 'false' },
  })
  if (check.status !== 0) throw new Error('Committed database migrations failed the no-drift check')
  return { root, fixedConfig, persistence: fixedPersistence, secretFile }
}

async function acquireLocalLock(root = projectRoot) {
  const lock = path.join(root, '.wrangler/pf017-local.lock')
  try { await mkdir(lock) } catch (error) {
    if (error.code !== 'EEXIST') throw error
    const owner = Number.parseInt(await readFile(path.join(lock, 'owner.pid'), 'utf8').catch(() => ''), 10)
    if (!Number.isSafeInteger(owner) || owner <= 0) throw new Error('Local D1 lock is stale or invalid; inspect it before removal')
    try { process.kill(owner, 0); throw new Error('Local D1 is busy; stop the managed runtime or database command') } catch (ownerError) {
      if (ownerError.code !== 'ESRCH') throw ownerError
    }
    await rm(lock, { recursive: true }); await mkdir(lock)
  }
  await writeFile(path.join(lock, 'owner.pid'), `${process.pid}\n`, { flag: 'wx' })
  return async () => rm(lock, { recursive: true })
}

async function reservePort() {
  const socket = createServer()
  await new Promise((resolve, reject) => { socket.once('error', reject); socket.listen(0, '127.0.0.1', resolve) })
  const address = socket.address()
  if (!address || typeof address === 'string') throw new Error('Could not reserve a loopback port')
  await new Promise((resolve, reject) => socket.close(error => error ? reject(error) : resolve()))
  return address.port
}

function safeJson(value) {
  return JSON.stringify(value, (key, nested) => /password|token|cookie|secret/i.test(key) ? '[redacted]' : nested)
}

function safeRuntimeDiagnostic(output) {
  return output.split('\n').filter(line => !/secret|cookie|token|password/i.test(line)).slice(-12).join('\n')
}

async function requestJson(baseURL, pathname, init, capture) {
  const response = await fetch(`${baseURL}${pathname}`, init)
  const text = await response.text()
  let body
  try { body = text ? JSON.parse(text) : null } catch { throw new Error(`Local authentication returned an invalid response (${response.status})`) }
  capture?.http?.(body)
  return { response, body }
}

function responseCookie(response) {
  return (response.headers.getSetCookie?.() ?? [response.headers.get('set-cookie')].filter(Boolean)).map(value => value.split(';', 1)[0]).join('; ')
}

async function stopOwnedServer(owned) {
  if (!owned || owned.child.exitCode !== null || owned.child.signalCode !== null) return
  try { process.kill(-owned.child.pid, 'SIGTERM') } catch (error) { if (error.code !== 'ESRCH') throw error }
  const exited = await Promise.race([owned.exit.then(() => true), new Promise(resolve => setTimeout(() => resolve(false), 5000))])
  if (!exited) { process.kill(-owned.child.pid, 'SIGKILL'); await owned.exit }
  if (owned.child.exitCode === null && owned.child.signalCode === null) throw new Error('Could not confirm owned Worker shutdown')
}

async function startOwnedServer({ root, viteConfigPath, baseURL, capture, signal }) {
  signal?.throwIfAborted()
  const child = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), '--config', viteConfigPath, '--host', '127.0.0.1', '--port', new URL(baseURL).port, '--strictPort'], {
    cwd: root, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
  })
  let output = ''
  child.stdout.on('data', chunk => { output += chunk; capture?.stderr?.(String(chunk)) })
  child.stderr.on('data', chunk => { output += chunk; capture?.stderr?.(String(chunk)) })
  const exit = new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', (code, signal) => resolve({ code, signal })) })
  const owned = { child, exit }
  try {
    for (let attempt = 0; attempt < 150; attempt += 1) {
      signal?.throwIfAborted()
      if (child.exitCode !== null || child.signalCode !== null) {
        throw new Error(`Owned local Worker exited before readiness (${safeJson(await exit)}): ${safeRuntimeDiagnostic(output)}`)
      }
      try {
        const response = await fetch(`${baseURL}/api/health`, { signal })
        const body = response.ok ? await response.json() : undefined
        if (response.ok && body?.service === 'pedidoflow-api' && body?.status === 'ok' && child.exitCode === null && child.signalCode === null) return owned
      } catch (error) { if (signal?.aborted) throw error }
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    throw new Error('Timed out waiting for the owned local Worker')
  } catch (error) {
    await stopOwnedServer(owned)
    throw error
  }
}

async function writeRuntimeConfig(validated, baseURL, runtimeDirectory) {
  const source = JSON.parse(await readFile(validated.fixedConfig, 'utf8'))
  source.$schema = path.join(validated.root, 'node_modules/wrangler/config-schema.json')
  source.name = `pedidoflow-pf024-bootstrap-${process.pid}`
  source.main = path.join(validated.root, 'worker/index.ts')
  source.d1_databases[0].migrations_dir = path.join(validated.root, 'worker/db/migrations')
  source.vars.BETTER_AUTH_URL = baseURL
  source.vars.BETTER_AUTH_TRUSTED_ORIGINS = baseURL
  const configPath = path.join(runtimeDirectory, 'wrangler.bootstrap.jsonc')
  await writeFile(configPath, `${JSON.stringify(source, null, 2)}\n`, { flag: 'wx' })
  await writeFile(path.join(runtimeDirectory, '.dev.vars'), validated.secretFile, { mode: 0o600, flag: 'wx' })
  const viteConfigPath = path.join(runtimeDirectory, 'vite.bootstrap.mjs')
  const viteConfig = `import react from '@vitejs/plugin-react'\nimport { defineConfig } from 'vite'\nimport tailwindcss from '@tailwindcss/vite'\nimport { cloudflare } from '@cloudflare/vite-plugin'\nexport default defineConfig({ plugins: [react(), tailwindcss(), cloudflare(${JSON.stringify({
    configPath,
    persistState: { path: validated.persistence },
    remoteBindings: false,
  })})] })\n`
  await writeFile(viteConfigPath, viteConfig, { flag: 'wx' })
  return viteConfigPath
}

async function authenticate(baseURL, input, capture) {
  const headers = { 'content-type': 'application/json', origin: baseURL }
  let result = await requestJson(baseURL, '/api/auth/sign-up/email', { method: 'POST', headers, body: JSON.stringify({ name: input.organizationName, email: input.email, password: input.password }) }, capture)
  if (!result.response.ok) result = await requestJson(baseURL, '/api/auth/sign-in/email', { method: 'POST', headers, body: JSON.stringify({ email: input.email, password: input.password }) }, capture)
  if (!result.response.ok) throw new Error('Authentication failed; no organization changes were made')
  const cookie = responseCookie(result.response)
  if (!cookie) throw new Error('Authentication did not establish a local session')
  const session = await requestJson(baseURL, '/api/auth/get-session', { headers: { cookie, origin: baseURL } }, capture)
  if (!session.response.ok || !session.body?.user?.id) throw new Error('Verified local session was not available')
  return { cookie, userId: session.body.user.id }
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`
}

function runD1(validated, command) {
  const result = spawnSync(process.execPath, [path.join(validated.root, 'node_modules/wrangler/bin/wrangler.js'), 'd1', 'execute', 'DB', '--local', '--config', path.join(validated.root, 'wrangler.database.json'), '--persist-to', validated.persistence, '--command', command, '--json'], {
    cwd: validated.root, encoding: 'utf8', env: { ...process.env, CI: 'true', WRANGLER_SEND_METRICS: 'false' },
  })
  if (result.status !== 0) throw new Error('Local organization transaction failed')
  try { return JSON.parse(result.stdout) } catch { throw new Error('Local D1 returned an invalid result') }
}

function resultRows(result) {
  return result.flatMap(entry => entry.results ?? [])
}

async function inspectAndMutate(validated, userId, input, signal) {
  signal?.throwIfAborted()
  if (!/^[A-Za-z0-9_-]+$/.test(userId)) throw new Error('Verified identity has an unexpected identifier')
  const memberships = resultRows(runD1(validated, `SELECT m.organization_id AS organizationId,m.role,m.status,o.name,o.slug,o.status AS organizationStatus
    FROM organization_members m JOIN organizations o ON o.id=m.organization_id WHERE m.user_id=${sqlLiteral(userId)} ORDER BY m.organization_id`))
  const slugOwner = resultRows(runD1(validated, `SELECT id,name,status FROM organizations WHERE slug=${sqlLiteral(input.slug)}`))[0]
  if (memberships.length) {
    if (memberships.length === 1 && memberships[0].role === 'owner' && memberships[0].status === 'active' &&
        memberships[0].organizationStatus === 'active' && memberships[0].slug === input.slug && memberships[0].name === input.organizationName) {
      return { outcome: 'no_op', organizationId: memberships[0].organizationId }
    }
    throw new Error('Authenticated user has conflicting or ambiguous organization membership; no changes were made')
  }
  if (slugOwner) throw new Error('Requested organization slug is unavailable; no changes were made')
  signal?.throwIfAborted()
  const organizationId = `org_${randomUUID().replaceAll('-', '')}`
  const now = Date.now()
  // Wrangler sends the parsed statements in one D1 batch; D1 rolls the batch back if either statement fails.
  runD1(validated, `INSERT INTO organizations (id,name,slug,status,created_at,updated_at) VALUES (${sqlLiteral(organizationId)},${sqlLiteral(input.organizationName)},${sqlLiteral(input.slug)},'active',${now},${now}); INSERT INTO organization_members (organization_id,user_id,role,status,created_at,updated_at) VALUES (${sqlLiteral(organizationId)},${sqlLiteral(userId)},'owner','active',${now},${now});`)
  return { outcome: 'created', organizationId }
}

async function executeLocalOwnerBootstrap() {
  const capture = { stdout: value => process.stdout.write(value) }
  const validated = await validateBootstrapConfiguration()
  const release = await acquireLocalLock(validated.root)
  const runtimeParent = path.join(validated.root, '.wrangler')
  await mkdir(runtimeParent, { recursive: true })
  const runtimeDirectory = await mkdtemp(path.join(runtimeParent, 'pf024-bootstrap-'))
  const controller = new AbortController()
  let interruptedSignal
  let owned
  const interrupt = signal => {
    interruptedSignal ??= signal
    controller.abort(new Error(`Bootstrap interrupted by ${signal}`))
    if (owned) void stopOwnedServer(owned).catch(() => {})
  }
  const onSigint = () => interrupt('SIGINT')
  const onSigterm = () => interrupt('SIGTERM')
  process.once('SIGINT', onSigint)
  process.once('SIGTERM', onSigterm)
  try {
    const normalized = normalizeBootstrapInput(await promptForInput())
    controller.signal.throwIfAborted()
    const port = await reservePort()
    const baseURL = `http://127.0.0.1:${port}`
    const viteConfigPath = await writeRuntimeConfig(validated, baseURL, runtimeDirectory)
    owned = await startOwnedServer({ root: validated.root, viteConfigPath, baseURL, capture, signal: controller.signal })
    const identity = await authenticate(baseURL, normalized, capture)
    await stopOwnedServer(owned); owned = undefined
    controller.signal.throwIfAborted()
    const mutation = await inspectAndMutate(validated, identity.userId, normalized, controller.signal)
    controller.signal.throwIfAborted()
    owned = await startOwnedServer({ root: validated.root, viteConfigPath, baseURL, capture, signal: controller.signal })
    const login = await requestJson(baseURL, '/api/auth/sign-in/email', { method: 'POST', headers: { 'content-type': 'application/json', origin: baseURL }, body: JSON.stringify({ email: normalized.email, password: normalized.password }) }, capture)
    if (!login.response.ok) throw new Error('Post-bootstrap authentication verification failed')
    const cookie = responseCookie(login.response)
    const session = await requestJson(baseURL, '/api/auth/get-session', { headers: { cookie, origin: baseURL } }, capture)
    const context = await requestJson(baseURL, '/api/context', { headers: { cookie, origin: baseURL } }, capture)
    if (!session.response.ok || session.body?.user?.id !== identity.userId || !context.response.ok || context.body?.organizationId !== mutation.organizationId || context.body?.actorUserId !== identity.userId || context.body?.role !== 'owner') {
      throw new Error('Post-bootstrap session or organization context verification failed')
    }
    const result = { outcome: mutation.outcome, email: normalized.email, organizationName: normalized.organizationName, slug: normalized.slug, organizationId: mutation.organizationId, userId: identity.userId }
    capture.stdout?.(`Local owner bootstrap ${mutation.outcome === 'created' ? 'completed' : 'verified (no changes)'}: ${normalized.email}, ${normalized.organizationName} (${normalized.slug}).\n`)
    return result
  } catch (error) {
    throw new Error(`${error.message}. If identity creation already succeeded, retry safely with the same credentials.`)
  } finally {
    process.removeListener('SIGINT', onSigint)
    process.removeListener('SIGTERM', onSigterm)
    if (owned) await stopOwnedServer(owned)
    await rm(runtimeDirectory, { recursive: true, force: true })
    await release()
    if (interruptedSignal) process.exitCode = interruptedSignal === 'SIGINT' ? 130 : 143
  }
}

export async function runLocalOwnerBootstrap() {
  if (process.argv.slice(2).length) throw new Error('Bootstrap accepts no command-line arguments')
  return executeLocalOwnerBootstrap()
}

async function promptHidden(label) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('Interactive TTY is required; password input is never accepted through arguments or environment')
  process.stdout.write(label)
  process.stdin.setRawMode(true)
  process.stdin.resume()
  let value = ''
  try {
    inputLoop:
    for await (const chunk of process.stdin) {
      for (const character of String(chunk)) {
        if (character === '\u0003') throw new Error('Cancelled')
        if (character === '\r' || character === '\n') break inputLoop
        if (character === '\u007f') value = value.slice(0, -1)
        else if (character.codePointAt(0) >= 32) value += character
      }
    }
  } finally { process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write('\n') }
  return value
}

async function promptForInput() {
  const prompt = createInterface({ input: process.stdin, output: process.stdout })
  const email = await prompt.question('Email: ')
  const organizationName = await prompt.question('Organization name: ')
  const slug = await prompt.question('Organization slug: ')
  prompt.close()
  const password = await promptHidden('Password: ')
  return { email, organizationName, slug, password }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runLocalOwnerBootstrap()
    .catch(error => { console.error(error.message); process.exitCode = 1 })
}
