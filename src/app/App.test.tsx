// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { safeAppReturnTo } from '../lib/auth'
import App from './App'

const session = { user: { id: 'user_verified' } }
const context = { organizationId: 'org_verified', actorUserId: 'user_verified', role: 'operator' }

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

interface ExpectedRequest {
  path: string
  method?: 'GET' | 'POST'
  body?: unknown
  result: Response | Error | ((signal: AbortSignal) => Promise<Response>)
}

const activeRouters: Array<{ done: () => void }> = []

function mockApi(...expectedRequests: ExpectedRequest[]) {
  const queue = [...expectedRequests]
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const expected = queue.shift()
    if (!expected) throw new Error(`Unexpected fetch: ${String(input)}`)
    const path = input instanceof Request ? new URL(input.url).pathname : String(input)
    expect(path).toBe(expected.path)
    expect((init?.method ?? 'GET').toUpperCase()).toBe(expected.method ?? 'GET')
    expect(init?.credentials).toBe('same-origin')
    expect(init?.signal).toBeInstanceOf(AbortSignal)
    if ((expected.method ?? 'GET') === 'POST') {
      expect(new Headers(init?.headers).get('content-type')).toBe('application/json')
      expect(JSON.parse(String(init?.body))).toEqual(expected.body)
    } else {
      expect(init?.body).toBeUndefined()
    }
    if (expected.result instanceof Error) throw expected.result
    if (typeof expected.result === 'function') return expected.result(init!.signal as AbortSignal)
    return expected.result
  })
  const router = { done: () => expect(queue, 'all expected requests were consumed').toHaveLength(0) }
  activeRouters.push(router)
  return fetchMock
}

const getSession = (result: ExpectedRequest['result']): ExpectedRequest => ({ path: '/api/auth/get-session', result })
const getContext = (result: ExpectedRequest['result']): ExpectedRequest => ({ path: '/api/context', result })
const postSignIn = (result: ExpectedRequest['result'], email = 'persona@example.test', password = 'secreto'): ExpectedRequest => ({
  path: '/api/auth/sign-in/email', method: 'POST', body: { email, password }, result,
})
const postSignOut = (result: ExpectedRequest['result']): ExpectedRequest => ({
  path: '/api/auth/sign-out', method: 'POST', body: {}, result,
})

function renderRoute(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>)
}

afterEach(() => {
  cleanup()
  activeRouters.forEach((router) => router.done())
  activeRouters.length = 0
  vi.restoreAllMocks()
})

describe('protected application routing', () => {
  it('does not flash protected content while validating and redirects a revoked session to login', async () => {
    mockApi(getSession(json(null)), getSession(json(null)))
    renderRoute('/app/inbox')
    expect(screen.getByLabelText('Validando acceso')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Inbox' })).not.toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Inicia sesión' })).toBeInTheDocument()
  })

  it('recovers to login when the session expires between identity and context checks', async () => {
    mockApi(getSession(json(session)), getContext(json({ error: 'unauthenticated' }, 401)), getSession(json(null)))
    renderRoute('/app/orders')
    expect(await screen.findByRole('heading', { name: 'Inicia sesión' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Pedidos' })).not.toBeInTheDocument()
  })

  it('renders the shell only with verified organization context', async () => {
    mockApi(getSession(json(session)), getContext(json(context)))
    renderRoute('/app/orders')
    expect(await screen.findByRole('heading', { name: 'Pedidos' })).toBeInTheDocument()
    expect(screen.getAllByText('org_verified').length).toBeGreaterThan(0)
    expect(screen.getAllByText('operator').length).toBeGreaterThan(0)
    expect(screen.queryByText('Estructura inicial')).not.toBeInTheDocument()
  })

  it.each([
    ['no_access', 'Sin acceso operativo'],
    ['selection_required', 'Selecciona una organización'],
  ])('shows an explicit %s state without a login redirect loop', async (error, title) => {
    mockApi(getSession(json(session)), getContext(json({ error }, 403)))
    renderRoute('/app')
    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Inicia sesión' })).not.toBeInTheDocument()
  })

  it('offers a recoverable retry when session validation has a network failure', async () => {
    mockApi(getSession(new TypeError('offline')))
    renderRoute('/app')
    expect(await screen.findByText('No pudimos validar tu acceso')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })

  it.each([
    ['malformed session JSON', [getSession(new Response('{', { status: 200, headers: { 'content-type': 'application/json' } }))]],
    ['unexpected session payload', [getSession(json({ user: {} }))]],
    ['malformed context JSON', [getSession(json(session)), getContext(new Response('{', { status: 200, headers: { 'content-type': 'application/json' } }))]],
    ['unexpected context payload', [getSession(json(session)), getContext(json({ organizationId: 'org_verified' }))]],
  ] as const)('turns %s into a recoverable state instead of an infinite skeleton', async (_label, requests) => {
    mockApi(...requests)
    renderRoute('/app')
    expect(await screen.findByText('No pudimos validar tu acceso')).toBeInTheDocument()
    expect(screen.queryByLabelText('Validando acceso')).not.toBeInTheDocument()
  })

  it('aborts session validation when the guard unmounts', () => {
    const captured: { signal: AbortSignal | null } = { signal: null }
    mockApi(getSession((signal) => {
      captured.signal = signal
      return new Promise((_resolve, reject) => signal.addEventListener('abort', () => {
        reject(new DOMException('Aborted', 'AbortError'))
      }, { once: true }))
    }))
    const view = renderRoute('/app')
    view.unmount()
    expect(captured.signal?.aborted).toBe(true)
  })
})

describe('login flow', () => {
  it.each([
    [null, '/app'], ['', '/app'], ['https://attacker.example/app', '/app'],
    ['//attacker.example/app', '/app'], ['%2F%2Fattacker.example%2Fapp', '/app'],
    ['%2568ttps%253A%252F%252Fattacker.example', '/app'],
    ['/app/..//attacker.example', '/app'],
    ['/app/%2e%2e//attacker.example', '/app'],
    ['/app/../../etc', '/app'],
    ['/app/%255c%255cattacker.example', '/app'],
    ['/app/%2500hidden', '/app'],
    ['/app/%252525252fsecret', '/app'],
    ['/app/orders?status=ready', '/app/orders?status=ready'],
  ])('normalizes returnTo %s safely', (value, expected) => {
    expect(safeAppReturnTo(value)).toBe(expected)
  })

  it('validates fields and focuses the first invalid control', async () => {
    mockApi(getSession(json(null)))
    const user = userEvent.setup()
    renderRoute('/login')
    await screen.findByRole('heading', { name: 'Inicia sesión' })
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    expect(screen.getByText('Escribe un correo electrónico válido.')).toBeInTheDocument()
    expect(screen.getByText('Escribe tu contraseña.')).toBeInTheDocument()
    expect(screen.getByLabelText('Correo electrónico')).toHaveFocus()
  })

  it('uses a generic error for invalid credentials without echoing identity', async () => {
    mockApi(getSession(json(null)), postSignIn(json({ code: 'INVALID' }, 401), 'persona@example.test', 'incorrecta-secreta'))
    const user = userEvent.setup()
    renderRoute('/login')
    await user.type(await screen.findByLabelText('Correo electrónico'), 'persona@example.test')
    await user.type(screen.getByLabelText('Contraseña'), 'incorrecta-secreta')
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    expect(await screen.findByText('El correo o la contraseña no son válidos.')).toBeInTheDocument()
    expect(screen.queryByText('persona@example.test')).not.toBeInTheDocument()
    expect(screen.queryByText('incorrecta-secreta')).not.toBeInTheDocument()
  })

  it('distinguishes a network failure from invalid credentials', async () => {
    mockApi(getSession(json(null)), postSignIn(new TypeError('offline')))
    const user = userEvent.setup()
    renderRoute('/login')
    await user.type(await screen.findByLabelText('Correo electrónico'), 'persona@example.test')
    await user.type(screen.getByLabelText('Contraseña'), 'secreto')
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    expect(await screen.findByText('No fue posible conectar con el servicio. Inténtalo de nuevo.')).toBeInTheDocument()
  })

  it('disables submission and announces progress while login is pending', async () => {
    let resolveLogin!: (response: Response) => void
    const pendingLogin = new Promise<Response>((resolve) => { resolveLogin = resolve })
    mockApi(getSession(json(null)), postSignIn(() => pendingLogin))
    const user = userEvent.setup()
    renderRoute('/login')
    await user.type(await screen.findByLabelText('Correo electrónico'), 'persona@example.test')
    await user.type(screen.getByLabelText('Contraseña'), 'secreto')
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    const pendingButton = screen.getByRole('button', { name: 'Procesando…' })
    expect(pendingButton).toBeDisabled()
    expect(pendingButton).toHaveAttribute('aria-busy', 'true')
    resolveLogin(json({ error: 'invalid' }, 401))
    expect(await screen.findByText('El correo o la contraseña no son válidos.')).toBeInTheDocument()
  })

  it('aborts an earlier submit and ignores its stale out-of-order response', async () => {
    const firstRequest: { signal: AbortSignal | null } = { signal: null }
    let resolveFirst!: (response: Response) => void
    let resolveSecond!: (response: Response) => void
    const first = new Promise<Response>((resolve) => { resolveFirst = resolve })
    const second = new Promise<Response>((resolve) => { resolveSecond = resolve })
    mockApi(
      getSession(json(null)),
      postSignIn((signal) => { firstRequest.signal = signal; return first }, 'persona@example.test', 'primera'),
      postSignIn(() => second, 'persona@example.test', 'segunda'),
    )
    const user = userEvent.setup()
    const view = renderRoute('/login')
    const email = await screen.findByLabelText('Correo electrónico')
    const password = screen.getByLabelText('Contraseña')
    const form = view.container.querySelector('form')!
    await user.type(email, 'persona@example.test')
    await user.type(password, 'primera')
    fireEvent.submit(form)
    await user.clear(password)
    await user.type(password, 'segunda')
    fireEvent.submit(form)
    expect(firstRequest.signal?.aborted).toBe(true)

    await act(async () => resolveSecond(json({ error: 'invalid' }, 401)))
    expect(await screen.findByText('El correo o la contraseña no son válidos.')).toBeInTheDocument()
    await act(async () => resolveFirst(json({ user: session.user })))
    expect(screen.getByRole('heading', { name: 'Inicia sesión' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).not.toBeDisabled()
  })

  it('redirects a successful login only to an allowed local app path', async () => {
    mockApi(getSession(json(null)), postSignIn(json({ user: session.user })), getSession(json(session)), getContext(json(context)))
    const user = userEvent.setup()
    renderRoute('/login?returnTo=%2Fapp%2Forders')
    await user.type(await screen.findByLabelText('Correo electrónico'), 'persona@example.test')
    await user.type(screen.getByLabelText('Contraseña'), 'secreto')
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    expect(await screen.findByRole('heading', { name: 'Pedidos' })).toBeInTheDocument()
  })

  it('redirects an existing authenticated session away from login', async () => {
    mockApi(getSession(json(session)), getContext(json(context)), getSession(json(session)), getContext(json(context)))
    renderRoute('/login?returnTo=%2Fapp%2Finbox')
    expect(await screen.findByRole('heading', { name: 'Inbox' })).toBeInTheDocument()
  })
})

describe('logout flow', () => {
  it('revokes the session and returns to login', async () => {
    const fetchMock = mockApi(getSession(json(session)), getContext(json(context)), postSignOut(json({ success: true })), getSession(json(null)))
    const user = userEvent.setup()
    renderRoute('/app')
    await user.click(await screen.findByRole('button', { name: 'Cerrar sesión' }))
    expect(await screen.findByRole('heading', { name: 'Inicia sesión' })).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([path, init]) => path === '/api/auth/sign-out' && init?.method === 'POST')).toBe(true)
  })

  it('keeps the verified shell visible when logout fails', async () => {
    mockApi(getSession(json(session)), getContext(json(context)), postSignOut(json({ error: 'failed' }, 500)))
    const user = userEvent.setup()
    renderRoute('/app')
    await user.click(await screen.findByRole('button', { name: 'Cerrar sesión' }))
    expect(await screen.findByText('Tu sesión sigue activa. Inténtalo de nuevo.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
  })
})
