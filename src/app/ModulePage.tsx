import { Link } from 'react-router-dom'
import { Alert, Badge } from '../components/ui'
import type { ModulePageDefinition } from './modulePages'

export function ModulePage({ page }: { page: ModulePageDefinition }) {
  return (
    <section aria-labelledby="module-title" className="max-w-225">
      <header className="mb-8 border-b border-neutral-200 pb-6">
        <p className="mb-2 text-xs font-semibold tracking-[0.08em] text-neutral-500 uppercase">
          {page.eyebrow}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 id="module-title" tabIndex={-1} className="text-2xl leading-8 font-semibold tracking-[-0.02em] text-neutral-900 outline-none">
            {page.title}
          </h1>
          <Badge tone="neutral">En desarrollo</Badge>
        </div>
        <p className="mt-2 max-w-170 text-sm leading-6 text-neutral-700">{page.purpose}</p>
      </header>

      <Alert title="Módulo todavía no disponible" tone="info">
        {page.plannedWork} Esta pantalla confirma la ruta y su lugar en la navegación; no contiene datos ni
        controles simulados.
      </Alert>
    </section>
  )
}

export function ApplicationNotFound({ publicRoute = false }: { publicRoute?: boolean }) {
  const destination = publicRoute ? '/' : '/app'
  const label = publicRoute ? 'Volver a PedidoFlow' : 'Volver a Inicio'

  return (
    <main className={publicRoute ? 'grid min-h-screen place-items-center px-5' : ''}>
      <section aria-labelledby="not-found-title" className="max-w-150">
        <p className="mb-2 text-xs font-semibold tracking-[0.08em] text-neutral-500 uppercase">Error 404</p>
        <h1 id="not-found-title" tabIndex={-1} className="text-2xl font-semibold tracking-[-0.02em] text-neutral-900 outline-none">
          Esta página no existe
        </h1>
        <p className="mt-3 mb-6 text-sm leading-6 text-neutral-700">
          Revisa la dirección o vuelve a una sección disponible de PedidoFlow.
        </p>
        <Link
          to={destination}
          className="inline-flex min-h-11 items-center rounded-control border border-brand-600 bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          {label}
        </Link>
      </section>
    </main>
  )
}
