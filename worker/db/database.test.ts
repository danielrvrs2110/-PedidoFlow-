import { spawnSync } from 'node:child_process'
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getPlatformProxy } from 'wrangler'
import { catalogRepository, normalizeProductAlias } from './repository.js'

const root = fileURLToPath(new URL('../../', import.meta.url).href)
const orgA = 'org_dev_valle'
const orgB = 'org_dev_abastos'
let db: D1Database
let dispose: () => Promise<void>
let seed: string[]
const run = (sql: string) => db.prepare(sql).run()
const row = (sql: string) => db.prepare(sql).first<Record<string, unknown>>()

beforeAll(async () => {
  // One workerd instance, ephemeral D1. Never opens development persistence.
  const platform = await getPlatformProxy<{ DB: D1Database }>({
    configPath: `${root}/wrangler.database.json`, persist: false, remoteBindings: false,
  })
  dispose = platform.dispose
  db = platform.env.DB
  const migrations = `${root}/worker/db/migrations`
  for (const name of (await readdir(migrations)).filter(name => name.endsWith('.sql')).sort()) {
    const sql = await readFile(`${migrations}/${name}`, 'utf8')
    for (const statement of sql.split('--> statement-breakpoint').filter(part => part.trim())) {
      await run(statement)
    }
  }
  seed = (await readFile(`${root}/worker/db/seed.sql`, 'utf8')).split('\n')
    .filter(line => line.startsWith('INSERT'))
  await db.batch(seed.map(sql => db.prepare(sql)))
}, 30000)
afterAll(async () => { await dispose?.() })

describe('D1 local database foundation', () => {
  it('enforces foreign keys in real D1 and seeds all 22 domain tables twice without changes', async () => {
    expect(await row('PRAGMA foreign_keys')).toEqual({ foreign_keys: 1 })
    const tables = (await db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name").all<{ name: string }>()).results
    expect(tables).toHaveLength(26)
    const domainTables = tables.filter(({ name }) => !['account', 'session', 'user', 'verification'].includes(name))
    expect(domainTables).toHaveLength(22)
    const before = await Promise.all(domainTables.map(({ name }) => db.prepare(`SELECT * FROM ${name} ORDER BY organization_id`).all().catch(() => db.prepare(`SELECT * FROM ${name} ORDER BY id`).all())))
    await db.batch(seed.map(sql => db.prepare(sql)))
    const after = await Promise.all(domainTables.map(({ name }) => db.prepare(`SELECT * FROM ${name} ORDER BY organization_id`).all().catch(() => db.prepare(`SELECT * FROM ${name} ORDER BY id`).all())))
    expect(after.map(result => result.results)).toEqual(before.map(result => result.results))
    expect(after.every(result => result.results.length === 2)).toBe(true)
    for (const name of ['account', 'session', 'user', 'verification']) {
      await expect(db.prepare(`SELECT count(*) AS count FROM ${name}`).first()).resolves.toEqual({ count: 0 })
    }
    expect((await db.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
  })

  it('requires organization and actor context, scopes reads, updates and deletes', async () => {
    expect(() => catalogRepository(db, undefined!)).toThrow('context is required')
    expect(() => catalogRepository(db, { organizationId: orgA, actorUserId: '' })).toThrow('context is required')
    const a = catalogRepository(db, { organizationId: orgA, actorUserId: 'dev_user_valle' })
    const b = catalogRepository(db, { organizationId: orgB, actorUserId: 'dev_user_abastos' })
    expect((await a.findProduct('prod_dev_valle'))?.organizationId).toBe(orgA)
    expect(await a.findProduct('prod_dev_abastos')).toBeUndefined()
    expect(await a.findProduct('missing')).toBeUndefined()
    expect(await a.setProductActive('prod_dev_abastos', false)).toBeUndefined()
    expect(await a.removeAlias('alias_dev_abastos')).toBeUndefined()
    expect((await b.findProduct('prod_dev_abastos'))?.active).toBe(1)
    expect(await a.setProductActive('prod_dev_valle', false)).toEqual({ id: 'prod_dev_valle' })
    expect((await a.findProduct('prod_dev_valle'))?.active).toBe(0)
    await a.setProductActive('prod_dev_valle', true)
    await run("INSERT INTO product_aliases SELECT 'alias_disposable',organization_id,product_id,'Otra','otra',source,created_at,updated_at FROM product_aliases WHERE id='alias_dev_valle'")
    expect(await b.removeAlias('alias_disposable')).toBeUndefined()
    expect(await a.removeAlias('alias_disposable')).toEqual({ id: 'alias_disposable' })
  })

  it('prevents mutations for suspended organizations while retaining scoped history reads', async () => {
    const repository = catalogRepository(db, { organizationId: orgA, actorUserId: 'dev_user_valle' })
    await run(`UPDATE organizations SET status='suspended' WHERE id='${orgA}'`)
    expect(await repository.setProductActive('prod_dev_valle', false)).toBeUndefined()
    expect(await repository.removeAlias('alias_dev_valle')).toBeUndefined()
    expect((await repository.findProduct('prod_dev_valle'))?.active).toBe(1)
    await run(`UPDATE organizations SET status='active' WHERE id='${orgA}'`)
  })

  it.each([
    ['customer_addresses', 'customer_id', 'cus_dev'],
    ['product_aliases', 'product_id', 'prod_dev'],
    ['price_list_items', 'product_id', 'prod_dev'],
    ['price_list_items', 'price_list_id', 'pl_dev'],
    ['customer_price_lists', 'customer_id', 'cus_dev'],
    ['customer_price_lists', 'price_list_id', 'pl_dev'],
    ['inventory', 'product_id', 'prod_dev'],
    ['conversations', 'customer_id', 'cus_dev'],
    ['messages', 'conversation_id', 'conv_dev'],
    ['message_attachments', 'message_id', 'msg_dev'],
    ['order_drafts', 'customer_id', 'cus_dev'],
    ['order_drafts', 'conversation_id', 'conv_dev'],
    ['order_draft_items', 'draft_id', 'draft_dev'],
    ['order_draft_items', 'product_id', 'prod_dev'],
    ['orders', 'customer_id', 'cus_dev'],
    ['orders', 'source_draft_id', 'draft_dev'],
    ['orders', 'conversation_id', 'conv_dev'],
    ['payments', 'order_id', 'ord_dev'],
    ['ai_processing_runs', 'draft_id', 'draft_dev'],
  ])('rejects cross-tenant FK %s.%s', async (table, column, prefix) => {
    await expect(run(`UPDATE ${table} SET ${column}='${prefix}_abastos' WHERE organization_id='${orgA}'`)).rejects.toThrow(/FOREIGN KEY/)
  })

  it('rejects cross-tenant references for immutable history inserts and order item relationships', async () => {
    await expect(run(`INSERT INTO inventory_adjustments SELECT 'adj_cross', organization_id, 'prod_dev_abastos', delta_milli,reason,source_type,source_id,actor_user_id,occurred_at,created_at,updated_at FROM inventory_adjustments WHERE organization_id='${orgA}'`)).rejects.toThrow(/FOREIGN KEY/)
    await expect(run(`INSERT INTO order_status_events SELECT 'event_cross', organization_id, 'ord_dev_abastos',from_status,to_status,actor_user_id,reason,note,occurred_at,created_at,updated_at FROM order_status_events WHERE organization_id='${orgA}'`)).rejects.toThrow(/FOREIGN KEY/)
    await run(`INSERT INTO orders (id,organization_id,order_number,customer_id,status,currency,subtotal_minor,total_minor,created_at,updated_at) VALUES ('ord_unconfirmed','${orgA}','DEV-SCRATCH','cus_dev_valle','draft','MXN',0,0,0,0)`)
    await run(`INSERT INTO order_items SELECT 'oi_unconfirmed',organization_id,'ord_unconfirmed',position,product_id,ordered_text,sku_snapshot,name_snapshot,variant_snapshot,quantity_milli,unit,unit_price_minor,line_total_minor,currency,match_context,created_at,updated_at FROM order_items WHERE organization_id='${orgA}'`)
    await expect(run("UPDATE order_items SET product_id='prod_dev_abastos' WHERE id='oi_unconfirmed'")).rejects.toThrow(/FOREIGN KEY/)
    await expect(run("UPDATE order_items SET order_id='ord_dev_abastos' WHERE id='oi_unconfirmed'")).rejects.toThrow(/FOREIGN KEY/)
  })

  it.each([
    ['price_list_items', 'unit_price_minor', '-1'], ['price_list_items', 'unit_price_minor', '1.5'],
    ['price_list_items', 'unit_price_minor', '9007199254740992'],
    ['payments', 'expected_minor', '-1'], ['payments', 'received_minor', '-1'],
    ['payments', 'received_minor', '0.1'], ['inventory', 'on_hand_milli', '-1'],
    ['inventory', 'reserved_milli', '20001'], ['inventory', 'on_hand_milli', '1.2'],
    ['order_draft_items', 'quantity_milli', '0'], ['order_draft_items', 'quantity_milli', '1.5'],
    ['order_draft_items', 'unit_price_minor', '-1'], ['order_draft_items', 'confidence_bps', '-1'],
    ['order_draft_items', 'confidence_bps', '10001'], ['order_draft_items', 'confidence_bps', '99.5'],
    ['products', 'active', '2'], ['products', 'unit_quantity_milli', '0'],
    ['order_drafts', 'version', '0'], ['order_draft_items', 'position', '-1'],
    ['ai_processing_runs', 'input_tokens', '-1'], ['ai_processing_runs', 'estimated_cost_minor', '-1'],
  ])('rejects invalid exact value %s.%s=%s', async (table, column, value) => {
    await expect(run(`UPDATE ${table} SET ${column}=${value} WHERE organization_id='${orgA}'`)).rejects.toThrow(/CHECK constraint/)
  })

  it.each([
    ['organizations', 'status'], ['organization_members', 'role'], ['organization_members', 'status'],
    ['customers', 'status'], ['conversations', 'status'], ['conversations', 'channel'],
    ['messages', 'direction'], ['product_aliases', 'source'], ['order_drafts', 'status'],
    ['order_draft_items', 'match_method'], ['orders', 'status'], ['payments', 'status'], ['ai_processing_runs', 'status'],
  ])('checks allowed states %s.%s', async (table, column) => {
    await expect(run(`UPDATE ${table} SET ${column}='invalid'`)).rejects.toThrow(/CHECK constraint/)
  })

  it('checks cancellation reason, effective ranges, currency and JSON', async () => {
    await expect(run("UPDATE orders SET status='cancelled', cancellation_reason=NULL")).rejects.toThrow(/CHECK constraint/)
    await expect(run("UPDATE orders SET status='cancelled', cancellation_reason='  '")).rejects.toThrow(/CHECK constraint/)
    await expect(run('UPDATE price_list_items SET valid_to=valid_from')).rejects.toThrow(/CHECK constraint/)
    await expect(run('UPDATE customer_price_lists SET valid_to=valid_from-1')).rejects.toThrow(/CHECK constraint/)
    await expect(run("UPDATE price_lists SET currency='mxn'")).rejects.toThrow(/CHECK constraint/)
    await expect(run("UPDATE message_attachments SET provider_metadata='not json'")).rejects.toThrow(/CHECK constraint/)
    await expect(run('UPDATE ai_processing_runs SET cost_minor_unit_scale=NULL')).rejects.toThrow(/CHECK constraint/)
  })

  it.each([
    ['products', 'sku'], ['customers', 'code'], ['price_lists', 'name'],
    ['orders', 'order_number'], ['messages', 'provider_message_id'],
  ])('allows equal %s.%s between tenants but rejects tenant-local duplicates', async (table, column) => {
    const count = await row(`SELECT count(DISTINCT ${column}) AS count FROM ${table} WHERE id LIKE '%_valle' OR id LIKE '%_abastos'`)
    expect(count?.count).toBe(1)
    const source = await row(`SELECT * FROM ${table} WHERE organization_id='${orgA}' LIMIT 1`)
    const copy: Record<string, unknown> = { ...source, id: `${table}_duplicate` }
    if (table === 'orders') copy.source_draft_id = null
    const columns = Object.keys(copy)
    await expect(db.prepare(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`)
      .bind(...Object.values(copy)).run()).rejects.toThrow(/UNIQUE constraint/)
  })

  it('checks order money, quantities, required snapshots and line positions before confirmation', async () => {
    for (const [column, value] of [['subtotal_minor', '-1'], ['total_minor', '1.1']]) {
      await expect(run(`UPDATE orders SET ${column}=${value} WHERE id='ord_unconfirmed'`)).rejects.toThrow(/CHECK constraint/)
    }
    for (const [column, value] of [['unit_price_minor', '-1'], ['line_total_minor', '0.5'], ['quantity_milli', '0'], ['quantity_milli', '1.5']]) {
      await expect(run(`UPDATE order_items SET ${column}=${value} WHERE id='oi_unconfirmed'`)).rejects.toThrow(/CHECK constraint/)
    }
    for (const column of ['sku_snapshot', 'name_snapshot', 'unit_price_minor', 'currency']) {
      await expect(run(`UPDATE order_items SET ${column}=NULL WHERE id='oi_unconfirmed'`)).rejects.toThrow(/NOT NULL constraint/)
    }
    const original = await row("SELECT * FROM order_items WHERE id='oi_unconfirmed'")
    const copy = { ...original, id: 'oi_duplicate_position' }
    const columns = Object.keys(copy)
    await expect(db.prepare(`INSERT INTO order_items (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`)
      .bind(...Object.values(copy)).run()).rejects.toThrow(/UNIQUE constraint/)
    await expect(run("INSERT INTO organizations VALUES ('org_duplicate','Development duplicate','desarrollo-valle','active',0,0)")).rejects.toThrow(/UNIQUE constraint/)
  })

  it('preserves confirmed snapshots after price/catalog changes and blocks rewriting history', async () => {
    const original = await row("SELECT * FROM order_items WHERE id='oi_dev_valle'")
    await run("UPDATE price_list_items SET unit_price_minor=99000 WHERE organization_id='org_dev_valle'")
    await run("UPDATE products SET name='Nuevo nombre',active=0 WHERE id='prod_dev_valle'")
    expect(await row("SELECT * FROM order_items WHERE id='oi_dev_valle'")).toEqual(original)
    await expect(run("UPDATE order_items SET unit_price_minor=1 WHERE id='oi_dev_valle'")).rejects.toThrow(/immutable/)
    await expect(run("DELETE FROM order_items WHERE id='oi_dev_valle'")).rejects.toThrow(/immutable/)
    await expect(run("UPDATE orders SET total_minor=1 WHERE id='ord_dev_valle'")).rejects.toThrow(/immutable/)
    await expect(run("UPDATE orders SET confirmed_at=NULL WHERE id='ord_dev_valle'")).rejects.toThrow(/immutable/)
    await expect(run("DELETE FROM products WHERE id='prod_dev_valle'")).rejects.toThrow(/FOREIGN KEY/)
    await expect(run("DELETE FROM organizations WHERE id='org_dev_valle'")).rejects.toThrow(/FOREIGN KEY/)
    for (const table of ['audit_events', 'order_status_events', 'inventory_adjustments']) {
      await expect(run(`UPDATE ${table} SET updated_at=1`)).rejects.toThrow(/append-only/)
      await expect(run(`DELETE FROM ${table}`)).rejects.toThrow(/append-only/)
    }
    expect((await db.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
  })

  it('normalizes aliases without discarding accents', () => {
    expect(normalizeProductAlias('  JITOMATE   Rojo  ')).toBe('jitomate rojo')
    expect(normalizeProductAlias('LIMO\u0301N')).toBe('limón')
    expect(() => normalizeProductAlias('  ')).toThrow()
  })
})

describe('local tooling boundary', () => {
  it('refuses remote configuration and symlinked persistence before launching Wrangler', async () => {
    const fixture = await mkdtemp(`${tmpdir()}/pf017-tooling-`)
    try {
      await mkdir(`${fixture}/scripts/db`, { recursive: true })
      await cp(`${root}/scripts/db/local.mjs`, `${fixture}/scripts/db/local.mjs`)
      const original = JSON.parse(await readFile(`${root}/wrangler.database.json`, 'utf8'))
      const invoke = () => spawnSync(process.execPath, [`${fixture}/scripts/db/local.mjs`, 'reset'], { encoding: 'utf8' })
      for (const override of [{ remote: true }, { database_id: 'a-real-remote-id' }, { migrations_dir: '/tmp/outside' }]) {
        const config = structuredClone(original)
        Object.assign(config.d1_databases[0], override)
        await writeFile(`${fixture}/wrangler.database.json`, JSON.stringify(config))
        const result = invoke()
        expect(result.status).toBe(1)
        expect(result.stderr).toContain('Local-only D1 configuration is required')
      }
      await writeFile(`${fixture}/wrangler.database.json`, JSON.stringify(original))
      await mkdir(`${fixture}/outside`)
      await writeFile(`${fixture}/outside/sentinel`, 'preserved')
      await symlink(`${fixture}/outside`, `${fixture}/.wrangler`)
      const result = invoke()
      expect(result.status).toBe(1)
      expect(result.stderr).toContain('must not be a symlink')
      expect(await readFile(`${fixture}/outside/sentinel`, 'utf8')).toBe('preserved')
    } finally {
      await rm(fixture, { recursive: true, force: true })
    }
  })

  it.each(['reset', 'migrate', 'seed', 'inspect'])('%s rejects all extra arguments before touching state', action => {
    for (const option of ['--remote', '--remote=false', '--local', '--config=other.json', '--persist-to=/tmp/other', '--env=production', 'production-db']) {
      const result = spawnSync(process.execPath, ['scripts/db/local.mjs', action, option], { cwd: root, encoding: 'utf8' })
      expect(result.status).toBe(1)
      expect(result.stderr).toContain('Local database command rejected')
    }
  })
})
