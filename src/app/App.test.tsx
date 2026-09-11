import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from './App'

function renderRoute(path: string) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('application shell', () => {
  it.each([
    ['/app', 'Inicio'],
    ['/app/inbox', 'Inbox'],
    ['/app/orders', 'Pedidos'],
    ['/app/picking', 'Picking'],
    ['/app/customers', 'Clientes'],
    ['/app/products', 'Productos'],
    ['/app/inventory', 'Inventario'],
    ['/app/pricing', 'Precios'],
    ['/app/import', 'Importar'],
    ['/app/settings', 'Configuración'],
  ])('renders %s inside the shell', (path, title) => {
    const markup = renderRoute(path)

    expect(markup).toContain('PedidoFlow')
    expect(markup).toContain(`<h1 id="module-title"`)
    expect(markup).toContain(`>${title}</h1>`)
    expect(markup).toContain('Módulo todavía no disponible')
    expect(markup).toContain('href="#main-content"')
  })

  it('exposes the active destination with aria-current', () => {
    const markup = renderRoute('/app/orders')

    expect(markup).toMatch(/aria-current="page"[^>]*href="\/app\/orders"/)
    expect(markup).not.toMatch(/aria-current="page"[^>]*href="\/app\/inbox"/)
  })

  it('renders a useful application 404 without redirecting', () => {
    const markup = renderRoute('/app/does-not-exist')

    expect(markup).toContain('Esta página no existe')
    expect(markup).toContain('href="/app"')
    expect(markup).toContain('Volver a Inicio')
  })
})
