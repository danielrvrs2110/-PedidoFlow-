import { spawnSync } from 'node:child_process'
import { mkdir, readFile, realpath, rm, lstat, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../../', import.meta.url))
const [action, ...extra] = process.argv.slice(2)
const actions = ['reset', 'migrate', 'seed', 'inspect']
// No passthrough flags, filenames, database IDs, environments or remote targets.
if (!actions.includes(action) || extra.length) {
  console.error('Local database command rejected: use reset|migrate|seed|inspect without additional arguments.')
  process.exit(1)
}
const configPath = path.join(root, 'wrangler.database.json')
const config = JSON.parse(await readFile(configPath, 'utf8'))
const database = config.d1_databases?.[0]
if (config.d1_databases?.length !== 1 || config.env || database?.remote !== false ||
    database?.binding !== 'DB' || database?.database_name !== 'pedidoflow-development-only' ||
    database?.database_id !== '00000000-0000-0000-0000-000000000017' ||
    database?.migrations_dir !== 'worker/db/migrations') {
  throw new Error('Local-only D1 configuration is required')
}
const state = path.join(root, '.wrangler', 'pf017-local')
// Refuse symlinks at every managed path component, including the reset target.
for (const directory of [path.join(root, '.wrangler'), state]) {
  try {
    if ((await lstat(directory)).isSymbolicLink()) throw new Error('Local database path must not be a symlink')
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
}
await mkdir(state, { recursive: true })
if (!(await realpath(state)).startsWith(`${await realpath(root)}${path.sep}`)) {
  throw new Error('Persistence must stay inside this worktree')
}
// Atomic lock outside persistence: never run two project tools against the same files.
const lock = path.join(root, '.wrangler', 'pf017-local.lock')
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
      throw new Error('Local D1 is busy. Stop npm run dev or the other database command before retrying.')
    } catch (ownerError) {
      if (ownerError.code !== 'ESRCH') throw ownerError
    }
    await rm(lock, { recursive: true })
    await mkdir(lock)
  }
  await writeFile(path.join(lock, 'owner.pid'), `${process.pid}\n`, { flag: 'wx' })
}

await acquireLock()
try {
  if (action === 'reset') {
    await rm(state, { recursive: true })
    console.log('Removed only this worktree .wrangler/pf017-local persistence. Run db:migrate:local next.')
  } else {
    const common = ['--local', '--config', configPath, '--persist-to', state]
    const query = action === 'seed'
      ? ['execute', 'DB', '--file', path.join(root, 'worker/db/seed.sql')]
      : action === 'inspect'
        ? ['execute', 'DB', '--command', "PRAGMA foreign_keys; PRAGMA foreign_key_check; SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name; SELECT id, name FROM organizations ORDER BY id; SELECT organization_id, count(*) AS products FROM products GROUP BY organization_id; SELECT * FROM d1_migrations;"]
        : ['migrations', 'apply', 'DB']
    const result = spawnSync(process.execPath, [path.join(root, 'node_modules/wrangler/bin/wrangler.js'), 'd1', ...query, ...common], {
      cwd: root, stdio: 'inherit', env: { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: 'true' },
    })
    if (result.error) throw result.error
    if (result.status !== 0) throw new Error(`Local D1 command failed (${result.status})`)
  }
} finally {
  await rm(lock, { recursive: true })
}
