import { useCallback, useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Alert, Button } from '../components/ui'
import { loadAuthState, type AuthState, type OrganizationContext } from '../lib/auth'

export interface ProtectedOutletContext {
  organization: OrganizationContext
}

type GuardState = AuthState | { status: 'loading' | 'network_error' }

function AccessState({ status }: { status: 'no_access' | 'selection_required' }) {
  const selectionRequired = status === 'selection_required'
  return (
    <main className="grid min-h-screen place-items-center bg-neutral-50 px-5 py-8">
      <section className="w-full max-w-150" aria-labelledby="access-title">
        <p className="mb-2 text-xs font-semibold tracking-[0.08em] text-neutral-500 uppercase">Acceso a PedidoFlow</p>
        <h1 id="access-title" tabIndex={-1} className="text-2xl font-semibold tracking-[-0.02em] outline-none">
          {selectionRequired ? 'Selecciona una organización' : 'Sin acceso operativo'}
        </h1>
        <Alert className="mt-5" tone="warning" title={selectionRequired ? 'Selección necesaria' : 'Membresía no disponible'}>
          {selectionRequired
            ? 'Tu cuenta pertenece a más de una organización. El cambio de organización todavía no está disponible.'
            : 'Tu sesión es válida, pero no tienes una membresía activa en una organización disponible.'}
        </Alert>
      </section>
    </main>
  )
}

export function ProtectedRoute() {
  const location = useLocation()
  const [state, setState] = useState<GuardState>({ status: 'loading' })
  const [retry, setRetry] = useState(0)
  const retryLoad = useCallback(() => {
    setState({ status: 'loading' })
    setRetry((value) => value + 1)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    loadAuthState(controller.signal)
      .then(setState)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setState({ status: 'network_error' })
      })
    return () => controller.abort()
  }, [retry])

  if (state.status === 'loading') {
    return <main aria-label="Validando acceso" className="min-h-screen animate-pulse bg-neutral-50" />
  }
  if (state.status === 'unauthenticated') {
    const returnTo = `${location.pathname}${location.search}${location.hash}`
    return <Navigate replace to={`/login?returnTo=${encodeURIComponent(returnTo)}`} />
  }
  if (state.status === 'no_access' || state.status === 'selection_required') {
    return <AccessState status={state.status} />
  }
  if (state.status === 'network_error') {
    return (
      <main className="grid min-h-screen place-items-center bg-neutral-50 px-5">
        <Alert tone="danger" title="No pudimos validar tu acceso">
          Revisa tu conexión e inténtalo de nuevo.
          <div className="mt-4"><Button onClick={retryLoad}>Reintentar</Button></div>
        </Alert>
      </main>
    )
  }
  if (state.status === 'authenticated') {
    return <Outlet context={{ organization: state.context } satisfies ProtectedOutletContext} />
  }
  return null
}
