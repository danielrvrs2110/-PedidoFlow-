import { useEffect, useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Badge } from '../components/ui'
import { getHealth, type HealthState } from '../lib/health'
import { AppShell } from './AppShell'
import { ApplicationNotFound, ModulePage } from './ModulePage'
import { modulePages } from './modulePages'

const initialHealth: HealthState = {
  state: 'loading',
  message: 'Comprobando la API…',
}

function FoundationPage() {
  const [health, setHealth] = useState<HealthState>(initialHealth)

  useEffect(() => {
    const controller = new AbortController()

    getHealth(controller.signal)
      .then(() => setHealth({ state: 'ready', message: 'API disponible' }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setHealth({ state: 'error', message: 'No fue posible conectar con la API' })
      })

    return () => controller.abort()
  }, [])

  return (
    <main className="grid min-h-screen place-items-center bg-neutral-50 px-5 py-8 max-[520px]:place-items-stretch max-[520px]:p-0">
      <section
        className="w-full max-w-170 rounded-overlay border border-neutral-200 bg-neutral-0 p-8 max-[520px]:min-h-screen max-[520px]:rounded-none max-[520px]:border-0 max-[520px]:p-5 max-[520px]:pt-7"
        aria-labelledby="page-title"
      >
        <div className="mb-8 grid size-10 place-items-center rounded-panel bg-brand-700 text-sm font-bold tracking-tight text-white" aria-hidden="true">
          PF
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold tracking-[0.08em] text-neutral-500 uppercase">
            Fundación del producto
          </p>
          <h1 id="page-title" className="m-0 text-[clamp(2rem,7vw,3rem)] leading-[1.05] font-semibold tracking-[-0.04em] text-neutral-900">
            PedidoFlow
          </h1>
          <p className="mt-4 mb-9 max-w-130 text-lg leading-7 text-neutral-700">
            Convierte pedidos B2B en órdenes listas para revisar y surtir.
          </p>
        </div>

        <dl className="m-0 border-t border-neutral-200">
          <div className="grid grid-cols-[minmax(100px,1fr)_minmax(180px,2fr)] gap-6 border-b border-neutral-200 py-4 max-[520px]:grid-cols-1 max-[520px]:gap-1.5">
            <dt className="text-neutral-500">Aplicación</dt>
            <dd className="m-0 font-semibold text-neutral-900">React + Vite</dd>
          </div>
          <div className="grid grid-cols-[minmax(100px,1fr)_minmax(180px,2fr)] gap-6 border-b border-neutral-200 py-4 max-[520px]:grid-cols-1 max-[520px]:gap-1.5">
            <dt className="text-neutral-500">Runtime</dt>
            <dd className="m-0 font-semibold text-neutral-900">Cloudflare Workers</dd>
          </div>
          <div className="grid grid-cols-[minmax(100px,1fr)_minmax(180px,2fr)] gap-6 border-b border-neutral-200 py-4 max-[520px]:grid-cols-1 max-[520px]:gap-1.5">
            <dt className="text-neutral-500">Estado</dt>
            <dd className="m-0">
              <Badge tone={health.state === 'ready' ? 'success' : health.state === 'error' ? 'danger' : 'neutral'} showDot>
                {health.message}
              </Badge>
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
      <Route path="/app" element={<AppShell />}>
        <Route index element={<ModulePage page={modulePages.home} />} />
        <Route path="inbox" element={<ModulePage page={modulePages.inbox} />} />
        <Route path="orders" element={<ModulePage page={modulePages.orders} />} />
        <Route path="picking" element={<ModulePage page={modulePages.picking} />} />
        <Route path="customers" element={<ModulePage page={modulePages.customers} />} />
        <Route path="products" element={<ModulePage page={modulePages.products} />} />
        <Route path="inventory" element={<ModulePage page={modulePages.inventory} />} />
        <Route path="pricing" element={<ModulePage page={modulePages.pricing} />} />
        <Route path="import" element={<ModulePage page={modulePages.import} />} />
        <Route path="settings" element={<ModulePage page={modulePages.settings} />} />
        <Route path="*" element={<ApplicationNotFound />} />
      </Route>
      <Route path="*" element={<ApplicationNotFound publicRoute />} />
    </Routes>
  )
}
