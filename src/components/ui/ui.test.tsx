import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Alert, Badge, Button } from './index'

describe('UI primitives', () => {
  it('renders a loading button as busy and disabled', () => {
    const markup = renderToStaticMarkup(<Button loading>Guardar</Button>)

    expect(markup).toContain('aria-busy="true"')
    expect(markup).toContain('disabled=""')
    expect(markup).toContain('Procesando…')
  })

  it('renders a textual status badge with an optional decorative dot', () => {
    const markup = renderToStaticMarkup(
      <Badge tone="success" showDot>
        API disponible
      </Badge>,
    )

    expect(markup).toContain('API disponible')
    expect(markup).toContain('aria-hidden="true"')
  })

  it('uses an alert role for danger messages', () => {
    const markup = renderToStaticMarkup(
      <Alert tone="danger" title="No se pudo guardar">
        Intenta nuevamente.
      </Alert>,
    )

    expect(markup).toContain('role="alert"')
    expect(markup).toContain('No se pudo guardar')
  })
})
