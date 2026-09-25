import { spawn } from 'node:child_process'
import { rmSync } from 'node:fs'
import { chmod, lstat, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../../', import.meta.url))
const [action, ...extra] = process.argv.slice(2)
if (!['prepare', 'serve'].includes(action) || extra.length) {
  console.error('Local runtime command rejected: use prepare or serve without additional arguments.')
  process.exit(1)
}

const state = path.join(root, '.wrangler', 'pf017-local')
const lock = path.join(root, '.wrangler', 'pf017-local.lock')
const configPath = path.join(root, 'config', 'local', 'wrangler.jsonc')
const databaseConfigPath = path.join(root, 'wrangler.database.json')
const devVarsPath = path.join(root, 'config', 'local', '.dev.vars')

for (const target of [path.join(root, '.wrangler'), state, devVarsPath]) {
  try {
    if ((await lstat(target)).isSymbolicLink()) throw new Error('Managed local runtime paths must not be symlinks')
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
}

const config = JSON.parse(await readFile(configPath, 'utf8'))
const database = config.d1_databases?.[0]
if (config.d1_databases?.length !== 1 || config.env || database?.remote !== false ||
    database?.binding !== 'DB' || database?.database_name !== 'pedidoflow-development-only' ||
    database?.database_id !== '00000000-0000-0000-0000-000000000017' ||
    database?.migrations_dir !== '../../worker/db/migrations' ||
    config.vars?.PEDIDOFLOW_ENVIRONMENT !== 'local' ||
    config.secrets?.required?.length !== 1 || config.secrets.required[0] !== 'BETTER_AUTH_SECRET') {
  throw new Error('Validated local-only runtime configuration is required')
}

await mkdir(state, { recursive: true })
if (!(await realpath(state)).startsWith(`${await realpath(root)}${path.sep}`)) {
  throw new Error('Persistence must stay inside this worktree')
}

function hasUsableSecret(contents) {
  const match = contents.match(/^BETTER_AUTH_SECRET\s*=\s*["']?([^\r\n"']+)["']?\s*$/m)
  return Boolean(match && match[1].length >= 32 && match[1] !== 'CHANGEME')
}

async function ensureSecret() {
  try {
    const existing = await readFile(devVarsPath, 'utf8')
    if (!hasUsableSecret(existing)) {
      throw new Error('config/local/.dev.vars exists but BETTER_AUTH_SECRET is missing or shorter than 32 characters')
    }
    return false
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  await writeFile(devVarsPath, `BETTER_AUTH_SECRET="${randomBytes(32).toString('base64url')}"\n`, { mode: 0o600, flag: 'wx' })
  await chmod(devVarsPath, 0o600)
  return true
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: 'inherit', ...options })
    child.once('error', reject)
    child.once('exit', (code, signal) => code === 0 ? resolve() : reject(new Error(`Command failed (${code ?? signal})`)))
    for (const name of ['SIGINT', 'SIGTERM']) {
      process.once(name, () => child.kill(name))
    }
  })
}

async function acquireLock() {
  try {
    await mkdir(lock)
  } catch (error) {
    if (error.code !== 'EEXIST') throw error
    const owner = Number.parseInt(await readFile(path.join(lock, 'owner.pid'), 'utf8').catch(() => ''), 10)
    if (!Number.isSafeInteger(owner) || owner <= 0) {
      throw new Error('Local D1 lock is stale or invalid. Verify no runtime is active, then remove the lock directory.')
    }
    try {
      process.kill(owner, 0)
      throw new Error('Local D1 is busy. Stop the development server or database command before retrying.')
    } catch (ownerError) {
      if (ownerError.code !== 'ESRCH') throw ownerError
    }
    await rm(lock, { recursive: true })
    await mkdir(lock)
  }
  await writeFile(path.join(lock, 'owner.pid'), `${process.pid}\n`, { flag: 'wx' })
}

await acquireLock()
const removeLockOnExit = () => rmSync(lock, { recursive: true, force: true })
process.once('exit', removeLockOnExit)
try {
  if (action === 'prepare') {
    const createdSecret = await ensureSecret()
    const wrangler = path.join(root, 'node_modules/wrangler/bin/wrangler.js')
    await run(process.execPath, [wrangler, 'd1', 'migrations', 'apply', 'DB', '--local', '--config', databaseConfigPath, '--persist-to', state], {
      env: { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: 'true' },
    })
    console.log(`${createdSecret ? 'Created' : 'Kept'} ignored .dev.vars and applied pending migrations without resetting or seeding local data.`)
  } else {
    const existing = await readFile(devVarsPath, 'utf8').catch(error => {
      if (error.code === 'ENOENT') throw new Error('Run npm run dev:prepare before starting the local runtime')
      throw error
    })
    if (!hasUsableSecret(existing)) throw new Error('config/local/.dev.vars needs a valid local BETTER_AUTH_SECRET')
    await run(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js')], {
      env: { ...process.env, PEDIDOFLOW_LOCAL_PERSIST_PATH: state },
    })
  }
} finally {
  await rm(lock, { recursive: true })
  process.removeListener('exit', removeLockOnExit)
}
