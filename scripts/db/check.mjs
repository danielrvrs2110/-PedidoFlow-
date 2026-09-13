import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cp, mkdir, mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

if (process.argv.length !== 2) throw new Error('db:check takes no arguments')
const root = fileURLToPath(new URL('../../', import.meta.url))
const source = path.join(root, 'worker/db/migrations')
const cli = path.join(root, 'node_modules/drizzle-kit/bin.cjs')
function run(args) {
  const result = spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(result.stdout + result.stderr)
  console.log(result.stdout.trim())
}
async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const result = {}
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const target = path.join(directory, entry.name)
    result[entry.name] = entry.isDirectory() ? await files(target) : await readFile(target, 'utf8')
  }
  return result
}
await mkdir(path.join(root, '.wrangler'), { recursive: true })
const temp = await mkdtemp(path.join(root, '.wrangler/db-check-'))
try {
  run(['check'])
  const copied = path.join(temp, 'existing')
  await cp(source, copied, { recursive: true })
  run(['generate', '--dialect=sqlite', '--schema=worker/db/schema/index.ts', `--out=${copied}`])
  assert.deepEqual(await files(copied), await files(source), 'Schema/migration drift detected')
  const fresh = path.join(temp, 'fresh')
  run(['generate', '--dialect=sqlite', '--schema=worker/db/schema/index.ts', `--out=${fresh}`, '--name=foundation'])
  const initial = (await readdir(source)).find(name => name.startsWith('0000_') && name.endsWith('.sql'))
  assert.equal(await readFile(path.join(fresh, '0000_foundation.sql'), 'utf8'),
    await readFile(path.join(source, initial), 'utf8'), 'Generated SQL differs from committed foundation')
  const generated = JSON.parse(await readFile(path.join(fresh, 'meta/0000_snapshot.json'), 'utf8'))
  const committed = JSON.parse(await readFile(path.join(source, 'meta/0000_snapshot.json'), 'utf8'))
  delete generated.id; delete committed.id
  assert.deepEqual(generated, committed, 'Schema snapshot differs from fresh generation')
  console.log('PASS: migration metadata, no drift, and reproducible initial SQL/snapshot')
} finally {
  await rm(temp, { recursive: true, force: true })
}
