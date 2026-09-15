import { sql } from 'drizzle-orm'
import { check, foreignKey, integer, text, unique } from 'drizzle-orm/sqlite-core'
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core'

export const timestamps = () => ({
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})
export const identity = () => ({
  id: text('id').primaryKey().notNull(),
  organizationId: text('organization_id').notNull(),
})
export const tenantKey = (name: string, t: { organizationId: AnySQLiteColumn; id: AnySQLiteColumn }) =>
  unique(`${name}_organization_id_unique`).on(t.organizationId, t.id)
export const tenantReference = (
  name: string, organizationId: AnySQLiteColumn, child: AnySQLiteColumn,
  parent: { organizationId: AnySQLiteColumn; id: AnySQLiteColumn },
) => foreignKey({ name, columns: [organizationId, child], foreignColumns: [parent.organizationId, parent.id] })
  .onDelete('restrict').onUpdate('restrict')

// SQLite INTEGER affinity alone accepts REAL values. Enforce exact JS-safe integers.
export const exactInteger = (name: string, column: AnySQLiteColumn, min = 0, max = Number.MAX_SAFE_INTEGER) =>
  check(name, sql`${column} is null or (typeof(${column}) = 'integer' and ${column} between ${sql.raw(String(min))} and ${sql.raw(String(max))})`)
export const allowed = (name: string, column: AnySQLiteColumn, values: readonly string[]) =>
  check(name, sql`${column} in (${sql.raw(values.map(value => `'${value}'`).join(', '))})`)
export const currencyCheck = (name: string, column: AnySQLiteColumn) =>
  check(name, sql`length(${column}) = 3 and ${column} not glob '*[^A-Z]*'`)
