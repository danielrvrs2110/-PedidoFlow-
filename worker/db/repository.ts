import { and, eq, exists } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import { organizations, productAliases, products } from './schema/index.js'

/** Internal server context, supplied only after session/membership verification.
 * This type is NOT proof of authorization. PF-017 exposes no HTTP entry point;
 * the future auth boundary must build this from verified membership, never a body/header.
 */
export interface OrganizationContext {
  readonly organizationId: string
  readonly actorUserId: string
}

export function catalogRepository(binding: D1Database, context: OrganizationContext) {
  if (!context?.organizationId?.trim() || !context?.actorUserId?.trim()) {
    throw new Error('Trusted organization context is required')
  }
  const organizationId = context.organizationId
  const db = drizzle(binding)
  const activeOrganization = exists(db.select({ id: organizations.id }).from(organizations)
    .where(and(eq(organizations.id, organizationId), eq(organizations.status, 'active'))))
  return {
    findProduct(id: string) {
      return db.select().from(products)
        .where(and(eq(products.organizationId, organizationId), eq(products.id, id))).get()
    },
    async setProductActive(id: string, active: boolean) {
      return db.update(products).set({ active: active ? 1 : 0, updatedAt: Date.now() })
        .where(and(eq(products.organizationId, organizationId), eq(products.id, id), activeOrganization))
        .returning({ id: products.id }).get()
    },
    async removeAlias(id: string) {
      return db.delete(productAliases)
        .where(and(eq(productAliases.organizationId, organizationId), eq(productAliases.id, id), activeOrganization))
        .returning({ id: productAliases.id }).get()
    },
  }
}

/** Preserve accents; normalize Unicode composition, case and whitespace only. */
export function normalizeProductAlias(value: string) {
  const normalized = value.normalize('NFC').trim().toLocaleLowerCase('es-MX').replace(/\s+/gu, ' ')
  if (!normalized) throw new Error('Alias must not be empty')
  return normalized
}
