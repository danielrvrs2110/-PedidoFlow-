import { and, eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import { createAuth, type AuthBindings } from './auth.js'
import { organizationMembers, organizations } from './db/schema/index.js'

export const organizationRoles = ['owner', 'admin', 'operator', 'picker'] as const
export type OrganizationRole = typeof organizationRoles[number]

export const organizationCapabilities = [
  'read_operational_data',
  'read_fulfillment_data',
  'manage_catalog_customers_pricing',
  'create_review_order_drafts',
  'confirm_orders',
  'update_fulfillment',
  'manage_members',
  'manage_owner_members',
  'change_organization_settings',
] as const
export type OrganizationCapability = typeof organizationCapabilities[number]

export interface OrganizationContext {
  readonly organizationId: string
  readonly actorUserId: string
  readonly role: OrganizationRole
}

const capabilitiesByRole = {
  owner: organizationCapabilities,
  admin: organizationCapabilities.filter(capability => capability !== 'manage_owner_members'),
  operator: [
    'read_operational_data',
    'read_fulfillment_data',
    'manage_catalog_customers_pricing',
    'create_review_order_drafts',
    'confirm_orders',
    'update_fulfillment',
  ],
  picker: ['read_fulfillment_data', 'update_fulfillment'],
} as const satisfies Record<OrganizationRole, readonly OrganizationCapability[]>

export function hasCapability(role: OrganizationRole, capability: OrganizationCapability) {
  return (capabilitiesByRole[role] as readonly OrganizationCapability[]).includes(capability)
}

export type OrganizationContextFailure =
  | { readonly type: 'unauthenticated' }
  | { readonly type: 'no_access' }
  | { readonly type: 'selection_required' }

export type OrganizationContextResult =
  | { readonly ok: true; readonly context: OrganizationContext }
  | { readonly ok: false; readonly failure: OrganizationContextFailure }

export async function resolveOrganizationContext(
  request: Request,
  bindings: AuthBindings,
): Promise<OrganizationContextResult> {
  const session = await createAuth(bindings).api.getSession({ headers: request.headers })
  if (!session?.user?.id) return { ok: false, failure: { type: 'unauthenticated' } }

  const memberships = await drizzle(bindings.DB)
    .select({
      organizationId: organizationMembers.organizationId,
      role: organizationMembers.role,
    })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
    .where(and(
      eq(organizationMembers.userId, session.user.id),
      eq(organizationMembers.status, 'active'),
      eq(organizations.status, 'active'),
    ))

  if (memberships.length === 0) return { ok: false, failure: { type: 'no_access' } }
  if (memberships.length !== 1) return { ok: false, failure: { type: 'selection_required' } }

  return {
    ok: true,
    context: {
      organizationId: memberships[0].organizationId,
      actorUserId: session.user.id,
      role: memberships[0].role,
    },
  }
}

export async function handleOrganizationContextRequest(request: Request, bindings: AuthBindings) {
  const result = await resolveOrganizationContext(request, bindings)
  if (result.ok) return Response.json(result.context)
  if (result.failure.type === 'unauthenticated') {
    return Response.json({ error: 'unauthenticated', message: 'Authentication required' }, { status: 401 })
  }
  return Response.json(
    { error: result.failure.type, message: result.failure.type === 'selection_required'
      ? 'Organization selection is required'
      : 'No active organization access' },
    { status: 403 },
  )
}
