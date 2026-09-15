import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
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
const historicalHashes = {
  '0000_foundation.sql': '12b5db02292c5684fe534e79060414a3cb664e15f55f8eb86998b1d72b97bc0d',
  '0001_history_guards.sql': 'dbe3dad54377661db12059dac478fea439b861ca753a47ae94838d25dd899134',
  'meta/0000_snapshot.json': '4019ae585baeb985bebf3276348d3fa4934d30f28fb1d97e9428d6e4afb279ee',
  'meta/0001_snapshot.json': '253b3031ffd3d244ef93c6d43623877d776eacb8fe69b7b1bc34098afd6468e3',
}
await mkdir(path.join(root, '.wrangler'), { recursive: true })
const temp = await mkdtemp(path.join(root, '.wrangler/db-check-'))
try {
  run(['check'])
  const copied = path.join(temp, 'existing')
  await cp(source, copied, { recursive: true })
  run(['generate', '--dialect=sqlite', '--schema=worker/db/schema/index.ts', `--out=${copied}`])
  assert.deepEqual(await files(copied), await files(source), 'Schema/migration drift detected')
  for (const [name, expected] of Object.entries(historicalHashes)) {
    const actual = createHash('sha256').update(await readFile(path.join(source, name))).digest('hex')
    assert.equal(actual, expected, `Applied migration artifact changed: ${name}`)
  }
  console.log('PASS: migration metadata, no drift, and immutable PF-017 artifact hashes')
} finally {
  await rm(temp, { recursive: true, force: true })
}
