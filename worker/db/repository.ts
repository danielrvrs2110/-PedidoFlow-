import { and, asc, eq, exists, inArray, or, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import { requireCapability, type OrganizationContext } from '../authorization.js'
import { organizations, productAliases, products } from './schema/index.js'

export type ProductValues = { sku: string; name: string; variant: string | null; orderUnit: string; unitQuantityMilli: number | null; unitMeasure: string | null; active: boolean }
export type ProductListQuery = { status: 'active' | 'inactive' | 'all'; q: string | null; limit: number; after: { name: string; id: string } | null }

const productColumns = { id: products.id, sku: products.sku, name: products.name, variant: products.variant, orderUnit: products.orderUnit, unitQuantityMilli: products.unitQuantityMilli, unitMeasure: products.unitMeasure, active: products.active, createdAt: products.createdAt, updatedAt: products.updatedAt }

export function catalogRepository(binding: D1Database, context: OrganizationContext) {
  if (!context?.organizationId?.trim() || !context?.actorUserId?.trim()) throw new Error('Trusted organization context is required')
  const organizationId = context.organizationId
  const db = drizzle(binding)
  const activeOrganization = exists(db.select({ id: organizations.id }).from(organizations).where(and(eq(organizations.id, organizationId), eq(organizations.status, 'active'))))
  const productScope = (id: string) => and(eq(products.organizationId, organizationId), eq(products.id, id))
  const aliasesForProduct = (productId: string) => db.select({ id: productAliases.id, value: productAliases.alias, createdAt: productAliases.createdAt, updatedAt: productAliases.updatedAt }).from(productAliases).where(and(eq(productAliases.organizationId, organizationId), eq(productAliases.productId, productId), eq(productAliases.source, 'manual'))).orderBy(asc(productAliases.normalizedAlias), asc(productAliases.id)).all()
  async function productDetail(id: string) {
    const product = await db.select(productColumns).from(products).where(productScope(id)).get()
    return product ? { ...product, active: product.active === 1, aliases: await aliasesForProduct(id) } : undefined
  }
  return {
    async listProducts(query: ProductListQuery) {
      requireCapability(context, 'read_operational_data')
      const conditions = [eq(products.organizationId, organizationId)]
      if (query.status !== 'all') conditions.push(eq(products.active, query.status === 'active' ? 1 : 0))
      if (query.q !== null) {
        const pattern = `%${query.q.replace(/[\\%_]/gu, character => `\\${character}`)}%`
        conditions.push(or(sql`${products.sku} like ${pattern} escape '\\' collate nocase`, sql`${products.name} like ${pattern} escape '\\' collate nocase`, sql`${products.variant} like ${pattern} escape '\\' collate nocase`)!)
      }
      if (query.after) conditions.push(sql`(${products.name} collate nocase > ${query.after.name} collate nocase or (${products.name} collate nocase = ${query.after.name} collate nocase and ${products.id} > ${query.after.id}))`)
      const rows = await db.select(productColumns).from(products).where(and(...conditions)).orderBy(sql`${products.name} collate nocase asc`, asc(products.id)).limit(query.limit + 1).all()
      const counts = rows.length ? await db.select({ productId: productAliases.productId, count: sql<number>`count(*)` }).from(productAliases).where(and(eq(productAliases.organizationId, organizationId), inArray(productAliases.productId, rows.map(row => row.id)), eq(productAliases.source, 'manual'))).groupBy(productAliases.productId).all() : []
      const byProduct = new Map(counts.map(value => [value.productId, value.count]))
      return rows.map(row => ({ ...row, active: row.active === 1, aliasCount: byProduct.get(row.id) ?? 0 }))
    },
    findProduct(id: string) { requireCapability(context, 'read_operational_data'); return db.select().from(products).where(productScope(id)).get() },
    async findProductDetail(id: string) { requireCapability(context, 'read_operational_data'); return productDetail(id) },
    async createProduct(id: string, values: ProductValues, now: number) {
      requireCapability(context, 'manage_catalog_customers_pricing')
      await db.insert(products).values({ id, organizationId, ...values, active: values.active ? 1 : 0, createdAt: now, updatedAt: now }).run()
      return productDetail(id)
    },
    async updateProduct(id: string, values: ProductValues, now: number) {
      requireCapability(context, 'manage_catalog_customers_pricing')
      const updated = await db.update(products).set({ ...values, active: values.active ? 1 : 0, updatedAt: now }).where(and(productScope(id), activeOrganization)).returning({ id: products.id }).get()
      return updated ? productDetail(id) : undefined
    },
    async setProductActive(id: string, active: boolean) {
      requireCapability(context, 'manage_catalog_customers_pricing')
      return db.update(products).set({ active: active ? 1 : 0, updatedAt: Date.now() }).where(and(productScope(id), activeOrganization)).returning({ id: products.id }).get()
    },
    async createAlias(id: string, productId: string, value: string, normalizedAlias: string, now: number) {
      requireCapability(context, 'manage_catalog_customers_pricing')
      const parent = await db.select({ id: products.id }).from(products).where(and(productScope(productId), activeOrganization)).get()
      if (!parent) return undefined
      return db.insert(productAliases).values({ id, organizationId, productId, alias: value, normalizedAlias, source: 'manual', createdAt: now, updatedAt: now }).returning({ id: productAliases.id, value: productAliases.alias, createdAt: productAliases.createdAt, updatedAt: productAliases.updatedAt }).get()
    },
    findManualAlias(id: string, productId: string) {
      requireCapability(context, 'manage_catalog_customers_pricing')
      return db.select({ id: productAliases.id, value: productAliases.alias, createdAt: productAliases.createdAt, updatedAt: productAliases.updatedAt }).from(productAliases).where(and(eq(productAliases.organizationId, organizationId), eq(productAliases.productId, productId), eq(productAliases.id, id), eq(productAliases.source, 'manual'))).get()
    },
    async updateAlias(id: string, productId: string, value: string, normalizedAlias: string, now: number) {
      requireCapability(context, 'manage_catalog_customers_pricing')
      return db.update(productAliases).set({ alias: value, normalizedAlias, updatedAt: now }).where(and(eq(productAliases.organizationId, organizationId), eq(productAliases.productId, productId), eq(productAliases.id, id), eq(productAliases.source, 'manual'), activeOrganization)).returning({ id: productAliases.id, value: productAliases.alias, createdAt: productAliases.createdAt, updatedAt: productAliases.updatedAt }).get()
    },
    async removeAlias(id: string, productId?: string) {
      requireCapability(context, 'manage_catalog_customers_pricing')
      return db.delete(productAliases).where(and(eq(productAliases.organizationId, organizationId), ...(productId ? [eq(productAliases.productId, productId)] : []), eq(productAliases.id, id), eq(productAliases.source, 'manual'), activeOrganization)).returning({ id: productAliases.id }).get()
    },
  }
}

/** Preserve accents; normalize Unicode composition, case and whitespace only. */
export function normalizeProductAlias(value: string) {
  const normalized = value.normalize('NFC').trim().toLocaleLowerCase('es-MX').replace(/\s+/gu, ' ')
  if (!normalized) throw new Error('Alias must not be empty')
  return normalized
}
