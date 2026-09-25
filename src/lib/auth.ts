export type OrganizationRole = 'owner' | 'admin' | 'operator' | 'picker'

export interface OrganizationContext {
  organizationId: string
  actorUserId: string
  role: OrganizationRole
}

export type AuthState =
  | { status: 'authenticated'; context: OrganizationContext }
  | { status: 'unauthenticated' }
  | { status: 'no_access' | 'selection_required' }

export class AuthServiceError extends Error {
  constructor(message = 'Authentication service unavailable') {
    super(message)
    this.name = 'AuthServiceError'
  }
}

const roles = new Set<OrganizationRole>(['owner', 'admin', 'operator', 'picker'])

async function authFetch(path: string, init: RequestInit = {}) {
  try {
    return await fetch(path, { credentials: 'same-origin', ...init })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new AuthServiceError()
  }
}

function isOrganizationContext(value: unknown): value is OrganizationContext {
  if (!value || typeof value !== 'object') return false
  const context = value as Partial<OrganizationContext>
  return typeof context.organizationId === 'string' && context.organizationId.length > 0
    && typeof context.actorUserId === 'string' && context.actorUserId.length > 0
    && typeof context.role === 'string' && roles.has(context.role as OrganizationRole)
}

export async function loadAuthState(signal?: AbortSignal): Promise<AuthState> {
  const sessionResponse = await authFetch('/api/auth/get-session', { signal })
  if (!sessionResponse.ok) throw new AuthServiceError()
  const session = await sessionResponse.json()
  if (!session) return { status: 'unauthenticated' }

  const contextResponse = await authFetch('/api/context', { signal })
  if (contextResponse.status === 401) return { status: 'unauthenticated' }
  if (contextResponse.status === 403) {
    const body = await contextResponse.json().catch(() => null) as { error?: unknown } | null
    if (body?.error === 'no_access' || body?.error === 'selection_required') {
      return { status: body.error }
    }
    throw new AuthServiceError()
  }
  if (!contextResponse.ok) throw new AuthServiceError()
  const context = await contextResponse.json()
  if (!isOrganizationContext(context)) throw new AuthServiceError()
  return { status: 'authenticated', context }
}

export type SignInResult = 'success' | 'invalid_credentials' | 'service_error'

export async function signIn(email: string, password: string, signal?: AbortSignal): Promise<SignInResult> {
  const response = await authFetch('/api/auth/sign-in/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
    signal,
  })
  if (response.ok) return 'success'
  if (response.status >= 500) return 'service_error'
  return 'invalid_credentials'
}

export async function signOut(signal?: AbortSignal) {
  const response = await authFetch('/api/auth/sign-out', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
    signal,
  })
  if (!response.ok) throw new AuthServiceError('Sign out failed')
}

export function safeAppReturnTo(value: string | null | undefined) {
  if (!value || [...value].some((character) => character === '\\' || character.charCodeAt(0) < 32)) return '/app'
  let decoded = value
  try {
    for (let index = 0; index < 3; index += 1) {
      const next = decodeURIComponent(decoded)
      if (next === decoded) break
      decoded = next
    }
  } catch {
    return '/app'
  }
  if (decoded !== '/app' && !decoded.startsWith('/app/')) return '/app'
  if (decoded.startsWith('//')) return '/app'
  const url = new URL(decoded, window.location.origin)
  if (url.origin !== window.location.origin) return '/app'
  return `${url.pathname}${url.search}${url.hash}`
}
