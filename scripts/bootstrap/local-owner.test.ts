import { spawnSync } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { normalizeBootstrapInput } from './local-owner.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const temporaryRoots: string[] = []
type BootstrapInput = { email: string; organizationName: string; slug: string; password: string }

async function isolatedHarness() {
  const directory = await mkdtemp(path.join(tmpdir(), 'pf024-bootstrap-e2e-'))
  const checkout = path.join(directory, 'checkout')
  temporaryRoots.push(directory)
  await cp(root, checkout, {
    recursive: true,
    filter: source => !['.git', '.wrangler', 'dist', 'node_modules'].includes(path.basename(source)),
  })
  await symlink(path.join(root, 'node_modules'), path.join(checkout, 'node_modules'), 'dir')
  await mkdir(path.join(checkout, '.wrangler/pf017-local'), { recursive: true })
  await mkdir(path.join(checkout, 'config/local'), { recursive: true })
  const secret = `test-${randomBytes(32).toString('base64url')}`
  await writeFile(path.join(checkout, 'config/local/.dev.vars'), `BETTER_AUTH_SECRET="${secret}"\n`, { mode: 0o600 })
  const persistence = path.join(checkout, '.wrangler/pf017-local')
  const migrated = spawnSync(process.execPath, [path.join(checkout, 'node_modules/wrangler/bin/wrangler.js'), 'd1', 'migrations', 'apply', 'DB', '--local', '--config', path.join(checkout, 'wrangler.database.json'), '--persist-to', persistence], {
    cwd: checkout, encoding: 'utf8', env: { ...process.env, CI: 'true', WRANGLER_SEND_METRICS: 'false' },
  })
  if (migrated.status !== 0) throw new Error(`${migrated.stdout}\n${migrated.stderr}`)
  return { checkout, secret, persistence }
}

function tclEscape(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('$', '\\$').replaceAll('[', '\\[').replaceAll(']', '\\]')
}

function runBootstrap(checkout: string, input: BootstrapInput, options: { interruptDuringStartup?: boolean } = {}) {
  const signalStep = options.interruptDuringStartup ? `
set workerFound 0
for {set attempt 0} {$attempt < 400} {incr attempt} {
  if {![catch {exec pgrep -P [exp_pid] -f vite.js} workerPid]} {
    set workerFound 1
    break
  }
  after 25
}
if {!$workerFound} { exit 97 }
exec kill -TERM [exp_pid]
` : ''
  const script = `
set timeout 90
log_user 1
spawn ${tclEscape(process.execPath)} scripts/bootstrap/local-owner.mjs
expect "Email: "
send -- "${tclEscape(input.email)}\\r"
expect "Organization name: "
send -- "${tclEscape(input.organizationName)}\\r"
expect "Organization slug: "
send -- "${tclEscape(input.slug)}\\r"
expect "Password: "
after 100
send -- "${tclEscape(input.password)}\\r"
${signalStep}expect eof
set result [wait]
exit [lindex $result 3]
`
  return spawnSync('/usr/bin/expect', ['-c', script], {
    cwd: checkout, encoding: 'utf8', timeout: 120_000,
    env: { ...process.env, CI: 'true', WRANGLER_SEND_METRICS: 'false' },
  })
}

function query(checkout: string, persistence: string, sql: string) {
  const result = spawnSync(process.execPath, [path.join(checkout, 'node_modules/wrangler/bin/wrangler.js'), 'd1', 'execute', 'DB', '--local', '--config', path.join(checkout, 'wrangler.database.json'), '--persist-to', persistence, '--command', sql, '--json'], {
    cwd: checkout, encoding: 'utf8', env: { ...process.env, CI: 'true', WRANGLER_SEND_METRICS: 'false' },
  })
  if (result.status !== 0) throw new Error(`${result.stdout}\n${result.stderr}`)
  const parsed = JSON.parse(result.stdout)
  return parsed.flatMap((entry: { results?: unknown[] }) => entry.results ?? [])
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

describe('PF-024 local first-owner bootstrap', () => {
  it('normalizes bounded input and rejects unsafe values', () => {
    expect(normalizeBootstrapInput({ email: ' OWNER@Example.Test ', organizationName: '  Café   Norte ', slug: 'cafe-norte', password: 'password-123' }))
      .toMatchObject({ email: 'owner@example.test', organizationName: 'Café Norte', slug: 'cafe-norte' })
    expect(() => normalizeBootstrapInput({ email: 'bad', organizationName: 'X', slug: '../remote', password: 'short' })).toThrow()
  })

  it('rejects arguments and an invalid fixed config before reading credentials', async () => {
    const harness = await isolatedHarness()
    const withArgument = spawnSync(process.execPath, ['scripts/bootstrap/local-owner.mjs', '--config', '/tmp/remote.json'], { cwd: harness.checkout, encoding: 'utf8' })
    expect(withArgument.status).toBe(1)
    expect(`${withArgument.stdout}${withArgument.stderr}`).toContain('accepts no command-line arguments')

    const configPath = path.join(harness.checkout, 'config/local/wrangler.jsonc')
    const config = JSON.parse(await readFile(configPath, 'utf8'))
    config.d1_databases[0].remote = true
    await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`)
    const invalidConfig = spawnSync(process.execPath, ['scripts/bootstrap/local-owner.mjs'], { cwd: harness.checkout, encoding: 'utf8' })
    expect(invalidConfig.status).toBe(1)
    expect(`${invalidConfig.stdout}${invalidConfig.stderr}`).toContain('local-only bootstrap configuration')
    expect(`${invalidConfig.stdout}${invalidConfig.stderr}`).not.toContain('Email:')
  })

  it('creates through the production TTY command, retries exact state, and leaks no secrets', async () => {
    const harness = await isolatedHarness()
    const input = { email: `owner-${randomUUID()}@example.test`, organizationName: 'Bodega Norte', slug: `bodega-${randomBytes(4).toString('hex')}`, password: `Password-${randomUUID()}` }
    const created = runBootstrap(harness.checkout, input)
    expect(created.status, `${created.stdout}\n${created.stderr}`).toBe(0)
    const repeated = runBootstrap(harness.checkout, input)
    expect(repeated.status, `${repeated.stdout}\n${repeated.stderr}`).toBe(0)
    expect(query(harness.checkout, harness.persistence, 'SELECT role,status FROM organization_members')).toEqual([{ role: 'owner', status: 'active' }])
    const sessions = query(harness.checkout, harness.persistence, 'SELECT token FROM session') as Array<{ token: string }>
    const visible = `${created.stdout}${created.stderr}${repeated.stdout}${repeated.stderr}`
    for (const forbidden of [input.password, harness.secret, ...sessions.map(row => row.token)]) expect(visible).not.toContain(forbidden)
    expect(visible).toContain('verified (no changes)')
  }, 180_000)

  it('stops startup on SIGTERM without mutation, lock or temporary runtime leakage', async () => {
    const harness = await isolatedHarness()
    const input = { email: `signal-${randomUUID()}@example.test`, organizationName: 'Signal Local', slug: `signal-${randomBytes(4).toString('hex')}`, password: `Password-${randomUUID()}` }
    const result = runBootstrap(harness.checkout, input, { interruptDuringStartup: true })
    expect(result.status).not.toBe(0)
    expect(query(harness.checkout, harness.persistence, 'SELECT count(*) AS count FROM organizations')).toEqual([{ count: 0 }])
    const stateEntries = await readdir(path.join(harness.checkout, '.wrangler'))
    expect(stateEntries.some(entry => entry.startsWith('pf024-bootstrap-'))).toBe(false)
    expect(stateEntries).not.toContain('pf017-local.lock')
    const leftover = spawnSync('pgrep', ['-f', `${harness.checkout}.*vite.bootstrap.mjs`], { encoding: 'utf8' })
    expect(leftover.status, leftover.stdout).toBe(1)
  }, 120_000)

  it('rolls back the organization insert when the second statement in the D1 batch fails', async () => {
    const harness = await isolatedHarness()
    const organizationId = `org_rollback_${randomBytes(4).toString('hex')}`
    const command = `INSERT INTO organizations (id,name,slug,status,created_at,updated_at) VALUES ('${organizationId}','Rollback','${organizationId}','active',0,0); INSERT INTO organization_members (organization_id,user_id,role,status,created_at,updated_at) VALUES ('${organizationId}','rollback_user','invalid_role','active',0,0);`
    const result = spawnSync(process.execPath, [path.join(harness.checkout, 'node_modules/wrangler/bin/wrangler.js'), 'd1', 'execute', 'DB', '--local', '--config', path.join(harness.checkout, 'wrangler.database.json'), '--persist-to', harness.persistence, '--command', command, '--json'], {
      cwd: harness.checkout, encoding: 'utf8', env: { ...process.env, CI: 'true', WRANGLER_SEND_METRICS: 'false' },
    })
    expect(result.status).not.toBe(0)
    expect(query(harness.checkout, harness.persistence, `SELECT count(*) AS count FROM organizations WHERE id='${organizationId}'`)).toEqual([{ count: 0 }])
  }, 120_000)

  it('fails closed for duplicate slug and existing different membership', async () => {
    const harness = await isolatedHarness()
    const first = { email: `first-${randomUUID()}@example.test`, organizationName: 'First Org', slug: `shared-${randomBytes(4).toString('hex')}`, password: `Password-${randomUUID()}` }
    expect(runBootstrap(harness.checkout, first).status).toBe(0)
    const duplicate = { ...first, email: `second-${randomUUID()}@example.test`, password: `Password-${randomUUID()}` }
    const duplicateResult = runBootstrap(harness.checkout, duplicate)
    expect(duplicateResult.status).not.toBe(0)
    expect(`${duplicateResult.stdout}${duplicateResult.stderr}`).toContain('slug is unavailable')
    const changed = runBootstrap(harness.checkout, { ...first, organizationName: 'Changed Name', slug: 'changed-slug' })
    expect(changed.status).not.toBe(0)
    expect(`${changed.stdout}${changed.stderr}`).toContain('conflicting or ambiguous')
    expect(query(harness.checkout, harness.persistence, 'SELECT count(*) AS count FROM organizations')).toEqual([{ count: 1 }])
  }, 180_000)
})
