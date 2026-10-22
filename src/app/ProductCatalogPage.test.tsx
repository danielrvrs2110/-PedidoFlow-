// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { OrganizationContext } from '../lib/auth'
import { ProductCatalogPage } from './ProductCatalogPage'

const product = { id: 'prod_1', sku: 'SKU-1', name: 'Manzana', variant: 'Roja', orderUnit: 'caja', unitQuantityMilli: 12000, unitMeasure: 'kg', active: true, aliasCount: 1, createdAt: 1, updatedAt: 1 }
const detail = { ...product, aliasCount: undefined, aliases: [{ id: 'alias_1', value: 'Manzana roja', createdAt: 1, updatedAt: 1 }] }
delete (detail as Partial<typeof product>).aliasCount

function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }) }
type Expected = { url: string | RegExp; method?: string; body?: unknown; response: Response | ((signal: AbortSignal) => Promise<Response>) }
const queues: Expected[][] = []
function mockApi(...expected: Expected[]) {
  const queue = [...expected]; queues.push(queue)
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const next = queue.shift(); if (!next) throw new Error(`Unexpected ${String(input)}`)
    const url = String(input); if (typeof next.url === 'string') expect(url).toBe(next.url); else expect(url).toMatch(next.url)
    expect(init?.method ?? 'GET').toBe(next.method ?? 'GET'); expect(init?.credentials).toBe('same-origin'); expect(init?.signal).toBeInstanceOf(AbortSignal)
    if (next.body !== undefined) expect(JSON.parse(String(init?.body))).toEqual(next.body)
    return typeof next.response === 'function' ? next.response(init!.signal as AbortSignal) : next.response
  })
}
function Host({ role = 'operator' }: { role?: OrganizationContext['role'] }) { return <Outlet context={{ organization: { organizationId: 'org_verified', actorUserId: 'user_verified', role } }} /> }
function renderPage(role: OrganizationContext['role'] = 'operator') { return render(<MemoryRouter initialEntries={['/app/products']}><Routes><Route element={<Host role={role} />}><Route path="/app/products" element={<ProductCatalogPage />} /></Route><Route path="/login" element={<h1>Inicia sesión</h1>} /></Routes></MemoryRouter>) }

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); this.dispatchEvent(new Event('close')) }
})
afterEach(() => { cleanup(); for (const queue of queues) expect(queue).toHaveLength(0); queues.length = 0; vi.restoreAllMocks() })

describe('product catalog page', () => {
  it('shows loading without stale data and renders the responsive list', async () => {
    let resolve!: (value: Response) => void
    mockApi({ url: '/api/products?status=active&limit=50', response: () => new Promise(done => { resolve = done }) })
    renderPage(); expect(screen.getByLabelText('Cargando productos')).toBeInTheDocument(); expect(screen.queryByText('Manzana')).not.toBeInTheDocument(); await waitFor(() => expect(resolve).toBeTypeOf('function'))
    resolve(json({ items: [product], nextCursor: null }))
    expect((await screen.findAllByText('Manzana')).length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('SKU-1').length).toBeGreaterThanOrEqual(2)
  })

  it('searches, filters and loads a real next page', async () => {
    mockApi(
      { url: '/api/products?status=active&limit=50', response: json({ items: [product], nextCursor: 'next' }) },
      { url: '/api/products?status=active&limit=50&q=pera', response: json({ items: [], nextCursor: null }) },
      { url: '/api/products?status=inactive&limit=50&q=pera', response: json({ items: [], nextCursor: null }) },
    )
    const user = userEvent.setup(); renderPage(); await screen.findAllByText('Manzana')
    await user.type(screen.getByLabelText('Buscar por SKU, nombre o variante'), 'pera'); await user.click(screen.getByRole('button', { name: 'Buscar' }))
    expect(await screen.findByText('No hay resultados')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Estado'), 'inactive'); await waitFor(() => expect(screen.getByText('No hay resultados')).toBeInTheDocument())
  })

  it('appends the next cursor page without replacing existing products', async () => {
    const second = { ...product, id: 'prod_2', sku: 'SKU-2', name: 'Pera' }
    mockApi(
      { url: '/api/products?status=active&limit=50', response: json({ items: [product], nextCursor: 'cursor_2' }) },
      { url: '/api/products?status=active&limit=50&cursor=cursor_2', response: json({ items: [second], nextCursor: null }) },
    )
    const user = userEvent.setup(); renderPage(); await screen.findAllByText('Manzana'); await user.click(screen.getByRole('button', { name: 'Cargar más' }))
    expect((await screen.findAllByText('Pera')).length).toBeGreaterThanOrEqual(2); expect(screen.getAllByText('Manzana').length).toBeGreaterThanOrEqual(2)
  })

  it('renders initial empty and recovers from a fetch error', async () => {
    mockApi(
      { url: '/api/products?status=active&limit=50', response: json({ error: 'internal_error' }, 500) },
      { url: '/api/products?status=active&limit=50', response: json({ items: [], nextCursor: null }) },
    )
    const user = userEvent.setup(); renderPage(); expect(await screen.findByText('No pudimos cargar los productos')).toBeInTheDocument(); await user.click(screen.getByRole('button', { name: 'Reintentar' })); expect(await screen.findByText('Aún no hay productos')).toBeInTheDocument()
  })

  it('does not request catalog data for picker and explains permission', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch'); renderPage('picker'); expect(screen.getByText('Catálogo no disponible')).toBeInTheDocument(); expect(fetchMock).not.toHaveBeenCalled()
  })

  it('validates create, focuses SKU, handles duplicate, then saves', async () => {
    mockApi(
      { url: '/api/products?status=active&limit=50', response: json({ items: [], nextCursor: null }) },
      { url: '/api/products', method: 'POST', body: { sku: 'SKU-X', name: 'Pera', variant: null, orderUnit: 'caja', unitQuantityMilli: null, unitMeasure: null }, response: json({ error: 'conflict', field: 'sku', message: 'duplicate' }, 409) },
    )
    const user = userEvent.setup(); renderPage(); await screen.findByText('Aún no hay productos'); await user.click(screen.getAllByRole('button', { name: 'Nuevo producto' })[0])
    expect(screen.getByLabelText('SKU')).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Guardar producto' })); expect(screen.getByText('Escribe el SKU.')).toBeInTheDocument(); expect(screen.getByLabelText('SKU')).toHaveFocus()
    await user.type(screen.getByLabelText('SKU'), 'SKU-X'); await user.type(screen.getByLabelText('Nombre'), 'Pera'); await user.type(screen.getByLabelText('Unidad de pedido'), 'caja'); await user.click(screen.getByRole('button', { name: 'Guardar producto' }))
    expect(await screen.findByText('Ese SKU ya existe en tu organización.')).toBeInTheDocument(); expect(screen.getByLabelText('SKU')).toHaveFocus()
  })

  it('edits product data and manages aliases against exact endpoints', async () => {
    mockApi(
      { url: '/api/products?status=active&limit=50', response: json({ items: [product], nextCursor: null }) },
      { url: '/api/products/prod_1', response: json(detail) },
      { url: '/api/products/prod_1/aliases', method: 'POST', body: { value: 'Fruta roja' }, response: json({ id: 'alias_2', value: 'Fruta roja', createdAt: 2, updatedAt: 2 }, 201) },
      { url: '/api/products/prod_1/aliases/alias_2', method: 'DELETE', response: new Response(null, { status: 204 }) },
    )
    const user = userEvent.setup(); renderPage(); const edit = (await screen.findAllByRole('button', { name: 'Editar' }))[0]; await user.click(edit)
    expect(await screen.findByText('Manzana roja')).toBeInTheDocument(); await user.type(screen.getByLabelText('Alias'), 'Fruta roja'); await user.click(screen.getByRole('button', { name: 'Agregar' })); expect(await screen.findByText('Fruta roja')).toBeInTheDocument()
    expect(within(screen.getByRole('table')).getByText('2')).toBeInTheDocument()
    const remove = screen.getAllByRole('button', { name: 'Eliminar alias' }).at(-1)!; await user.click(remove)
    const confirmation = screen.getByRole('group', { name: 'Confirmar eliminación de Fruta roja' })
    expect(screen.getByText('Fruta roja')).toBeInTheDocument()
    await user.click(within(confirmation).getByRole('button', { name: 'Eliminar definitivamente' })); await waitFor(() => expect(screen.queryByText('Fruta roja')).not.toBeInTheDocument())
    expect(within(screen.getByRole('table')).getByText('1')).toBeInTheDocument()
  })

  it('submits an edited product and announces the committed change', async () => {
    mockApi(
      { url: '/api/products?status=active&limit=50', response: json({ items: [product], nextCursor: null }) },
      { url: '/api/products/prod_1', response: json(detail) },
      { url: '/api/products/prod_1', method: 'PATCH', body: { sku: 'SKU-1', name: 'Manzana premium', variant: 'Roja', orderUnit: 'caja', unitQuantityMilli: 12000, unitMeasure: 'kg' }, response: json({ ...detail, name: 'Manzana premium' }) },
      { url: '/api/products?status=active&limit=50', response: json({ items: [{ ...product, name: 'Manzana premium' }], nextCursor: null }) },
    )
    const user = userEvent.setup(); renderPage(); await user.click((await screen.findAllByRole('button', { name: 'Editar' }))[0]); const name = await screen.findByLabelText('Nombre'); await user.clear(name); await user.type(name, 'Manzana premium'); await user.click(screen.getByRole('button', { name: 'Guardar producto' }))
    expect(await screen.findByText('Producto actualizado.')).toBeInTheDocument()
  })

  it('requires confirmation before deactivation', async () => {
    mockApi(
      { url: '/api/products?status=active&limit=50', response: json({ items: [product], nextCursor: null }) },
      { url: '/api/products/prod_1', method: 'PATCH', body: { active: false }, response: json({ ...detail, active: false }) },
      { url: '/api/products?status=active&limit=50', response: json({ items: [], nextCursor: null }) },
    )
    const user = userEvent.setup(); renderPage(); await user.click((await screen.findAllByRole('button', { name: 'Desactivar' }))[0]); const dialog = screen.getByRole('dialog', { name: 'Desactivar producto' }); await user.click(within(dialog).getByRole('button', { name: 'Desactivar' })); expect(await screen.findByText('Producto desactivado.')).toBeInTheDocument()
  })

  it('recovers an expired session during a product mutation', async () => {
    mockApi(
      { url: '/api/products?status=active&limit=50', response: json({ items: [], nextCursor: null }) },
      { url: '/api/products', method: 'POST', body: { sku: 'SKU-X', name: 'Pera', variant: null, orderUnit: 'caja', unitQuantityMilli: null, unitMeasure: null }, response: json({ error: 'unauthenticated', message: 'Authentication required' }, 401) },
    )
    const user = userEvent.setup(); renderPage(); await screen.findByText('Aún no hay productos'); await user.click(screen.getAllByRole('button', { name: 'Nuevo producto' })[0])
    await user.type(screen.getByLabelText('SKU'), 'SKU-X'); await user.type(screen.getByLabelText('Nombre'), 'Pera'); await user.type(screen.getByLabelText('Unidad de pedido'), 'caja'); await user.click(screen.getByRole('button', { name: 'Guardar producto' }))
    expect(await screen.findByRole('heading', { name: 'Inicia sesión' })).toBeInTheDocument()
  })

  it('ignores stale search responses, aborts them and recovers a 401 to login', async () => {
    const first: { signal?: AbortSignal } = {}; let resolve!: (response: Response) => void
    mockApi(
      { url: '/api/products?status=active&limit=50', response: signal => { first.signal = signal; return new Promise(done => { resolve = done }) } },
      { url: '/api/products?status=inactive&limit=50', response: json({ error: 'unauthenticated' }, 401) },
    )
    const user = userEvent.setup(); renderPage(); await user.selectOptions(screen.getByLabelText('Estado'), 'inactive'); expect(first.signal?.aborted).toBe(true); expect(await screen.findByRole('heading', { name: 'Inicia sesión' })).toBeInTheDocument(); resolve(json({ items: [product], nextCursor: null }))
  })
})
