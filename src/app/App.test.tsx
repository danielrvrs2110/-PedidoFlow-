// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
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

function mockFetch(...results: Array<Response | Error>) {
  const queue = [...results]
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
    const result = queue.shift()
    if (!result) throw new Error('Unexpected fetch')
    if (result instanceof Error) throw result
    return result
  })
}

function renderRoute(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>)
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('protected application routing', () => {
  it('does not flash protected content while validating and redirects a revoked session to login', async () => {
    mockFetch(json(null), json(null))
    renderRoute('/app/inbox')
    expect(screen.getByLabelText('Validando acceso')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Inbox' })).not.toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Inicia sesión' })).toBeInTheDocument()
  })

  it('recovers to login when the session expires between identity and context checks', async () => {
    mockFetch(json(session), json({ error: 'unauthenticated' }, 401), json(null))
    renderRoute('/app/orders')
    expect(await screen.findByRole('heading', { name: 'Inicia sesión' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Pedidos' })).not.toBeInTheDocument()
  })

  it('renders the shell only with verified organization context', async () => {
    mockFetch(json(session), json(context))
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
    mockFetch(json(session), json({ error }, 403))
    renderRoute('/app')
    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Inicia sesión' })).not.toBeInTheDocument()
  })

  it('offers a recoverable retry when session validation has a network failure', async () => {
    mockFetch(new TypeError('offline'))
    renderRoute('/app')
    expect(await screen.findByText('No pudimos validar tu acceso')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })

  it('aborts session validation when the guard unmounts', () => {
    const captured: { signal: AbortSignal | null } = { signal: null }
    vi.spyOn(globalThis, 'fetch').mockImplementation((_input, init) => {
      captured.signal = init?.signal as AbortSignal
      return new Promise(() => undefined)
    })
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
    ['/app/orders?status=ready', '/app/orders?status=ready'],
  ])('normalizes returnTo %s safely', (value, expected) => {
    expect(safeAppReturnTo(value)).toBe(expected)
  })

  it('validates fields and focuses the first invalid control', async () => {
    mockFetch(json(null))
    const user = userEvent.setup()
    renderRoute('/login')
    await screen.findByRole('heading', { name: 'Inicia sesión' })
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    expect(screen.getByText('Escribe un correo electrónico válido.')).toBeInTheDocument()
    expect(screen.getByLabelText('Correo electrónico')).toHaveFocus()
  })

  it('uses a generic error for invalid credentials without echoing identity', async () => {
    mockFetch(json(null), json({ code: 'INVALID' }, 401))
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
    mockFetch(json(null), new TypeError('offline'))
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
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json(null))
      .mockImplementationOnce(() => pendingLogin)
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

  it('redirects a successful login only to an allowed local app path', async () => {
    mockFetch(json(null), json({ user: session.user }), json(session), json(context))
    const user = userEvent.setup()
    renderRoute('/login?returnTo=%2Fapp%2Forders')
    await user.type(await screen.findByLabelText('Correo electrónico'), 'persona@example.test')
    await user.type(screen.getByLabelText('Contraseña'), 'secreto')
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    expect(await screen.findByRole('heading', { name: 'Pedidos' })).toBeInTheDocument()
  })

  it('redirects an existing authenticated session away from login', async () => {
    mockFetch(json(session), json(context), json(session), json(context))
    renderRoute('/login?returnTo=%2Fapp%2Finbox')
    expect(await screen.findByRole('heading', { name: 'Inbox' })).toBeInTheDocument()
  })
})

describe('logout flow', () => {
  it('revokes the session and returns to login', async () => {
    const fetchMock = mockFetch(json(session), json(context), json({ success: true }), json(null))
    const user = userEvent.setup()
    renderRoute('/app')
    await user.click(await screen.findByRole('button', { name: 'Cerrar sesión' }))
    expect(await screen.findByRole('heading', { name: 'Inicia sesión' })).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([path, init]) => path === '/api/auth/sign-out' && init?.method === 'POST')).toBe(true)
  })

  it('keeps the verified shell visible when logout fails', async () => {
    mockFetch(json(session), json(context), json({ error: 'failed' }, 500))
    const user = userEvent.setup()
    renderRoute('/app')
    await user.click(await screen.findByRole('button', { name: 'Cerrar sesión' }))
    expect(await screen.findByText('Tu sesión sigue activa. Inténtalo de nuevo.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
  })
})
