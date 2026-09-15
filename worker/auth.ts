import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { betterAuth } from 'better-auth/minimal'
import { drizzle } from 'drizzle-orm/d1'
import * as schema from './db/schema/auth.js'

export type PedidoFlowEnvironment = 'local' | 'test' | 'preview' | 'production'

export interface AuthBindings {
  DB: D1Database
  BETTER_AUTH_SECRET: string
  BETTER_AUTH_URL: string
  BETTER_AUTH_TRUSTED_ORIGINS: string
  PEDIDOFLOW_ENVIRONMENT: PedidoFlowEnvironment
}

function origin(value: string, variable: string) {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new Error(`${variable} must contain absolute HTTP origins`)
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== value || parsed.username || parsed.password) {
    throw new Error(`${variable} must contain absolute HTTP origins`)
  }
  return parsed.origin
}

export function validateAuthBindings(bindings: AuthBindings) {
  if (!bindings.DB) throw new Error('DB binding is required')
  if (!bindings.BETTER_AUTH_SECRET || bindings.BETTER_AUTH_SECRET.length < 32) {
    throw new Error('BETTER_AUTH_SECRET must contain at least 32 characters')
  }
  if (!['local', 'test', 'preview', 'production'].includes(bindings.PEDIDOFLOW_ENVIRONMENT)) {
    throw new Error('PEDIDOFLOW_ENVIRONMENT must be local, test, preview, or production')
  }
  const baseURL = origin(bindings.BETTER_AUTH_URL, 'BETTER_AUTH_URL')
  const configured = bindings.BETTER_AUTH_TRUSTED_ORIGINS.split(',').map(value => value.trim()).filter(Boolean)
  if (!configured.length) throw new Error('BETTER_AUTH_TRUSTED_ORIGINS must not be empty')
  const trustedOrigins = [...new Set([baseURL, ...configured.map(value => origin(value, 'BETTER_AUTH_TRUSTED_ORIGINS'))])]
  if (['preview', 'production'].includes(bindings.PEDIDOFLOW_ENVIRONMENT) &&
      trustedOrigins.some(value => new URL(value).protocol !== 'https:')) {
    throw new Error('Preview and production authentication origins must use HTTPS')
  }
  return { baseURL, trustedOrigins }
}

export function createAuth(bindings: AuthBindings) {
  const { baseURL, trustedOrigins } = validateAuthBindings(bindings)
  const signupEnabled = bindings.PEDIDOFLOW_ENVIRONMENT === 'local' || bindings.PEDIDOFLOW_ENVIRONMENT === 'test'

  return betterAuth({
    appName: 'PedidoFlow',
    baseURL,
    basePath: '/api/auth',
    secret: bindings.BETTER_AUTH_SECRET,
    logger: { level: 'error' },
    trustedOrigins,
    database: drizzleAdapter(drizzle(bindings.DB, { schema }), {
      provider: 'sqlite',
      schema,
    }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: !signupEnabled,
    },
    session: {
      cookieCache: { enabled: false },
    },
    advanced: {
      cookiePrefix: 'pedidoflow',
      useSecureCookies: new URL(baseURL).protocol === 'https:',
      disableCSRFCheck: false,
      disableOriginCheck: false,
    },
  })
}

export async function handleAuthRequest(request: Request, bindings: AuthBindings) {
  const response = await createAuth(bindings).handler(request)
  if (!response.headers.get('content-type')?.includes('application/json')) return response

  const payload = await response.clone().json<Record<string, unknown> | null>()
  if (payload && 'token' in payload) delete payload.token
  if (payload?.code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL') {
    return Response.json(
      { code: 'AUTHENTICATION_FAILED', message: 'Authentication failed' },
      { status: 400, headers: response.headers },
    )
  }
  return Response.json(payload, { status: response.status, headers: response.headers })
}
