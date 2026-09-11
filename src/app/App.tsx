import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { getHealth, type HealthState } from '../lib/health'
import './app.css'

const initialHealth: HealthState = {
  state: 'loading',
  message: 'Comprobando la API…',
}

function FoundationPage() {
  const [health, setHealth] = useState<HealthState>(initialHealth)

  useEffect(() => {
    const controller = new AbortController()

    getHealth(controller.signal)
      .then(() => {
        setHealth({ state: 'ready', message: 'API disponible' })
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }

        setHealth({
          state: 'error',
          message: 'No fue posible conectar con la API',
        })
      })

    return () => controller.abort()
  }, [])

  return (
    <main className="foundation-shell">
      <section className="foundation-panel" aria-labelledby="page-title">
        <div className="brand-mark" aria-hidden="true">
          PF
        </div>
        <div>
          <p className="eyebrow">Fundación del producto</p>
          <h1 id="page-title">PedidoFlow</h1>
          <p className="summary">
            Convierte pedidos B2B en órdenes listas para revisar y surtir.
          </p>
        </div>

        <dl className="readiness-list">
          <div>
            <dt>Aplicación</dt>
            <dd>React + Vite</dd>
          </div>
          <div>
            <dt>Runtime</dt>
            <dd>Cloudflare Workers</dd>
          </div>
          <div>
            <dt>Estado</dt>
            <dd>
              <span className={`status status--${health.state}`}>
                <span className="status-dot" aria-hidden="true" />
                {health.message}
              </span>
            </dd>
          </div>
        </dl>
      </section>
    </main>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<FoundationPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
