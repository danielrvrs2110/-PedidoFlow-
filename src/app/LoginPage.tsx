import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Alert, Button } from '../components/ui'
import { AuthServiceError, loadAuthState, safeAppReturnTo, signIn } from '../lib/auth'

interface FieldErrors {
  email?: string
  password?: string
}

export function LoginPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const returnTo = safeAppReturnTo(new URLSearchParams(location.search).get('returnTo'))
  const [checking, setChecking] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)
  const [checkWarning, setCheckWarning] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<'credentials' | 'service' | null>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const errorRef = useRef<HTMLDivElement>(null)
  const submitControllerRef = useRef<AbortController | null>(null)
  const submitGenerationRef = useRef(0)

  useEffect(() => {
    const controller = new AbortController()
    loadAuthState(controller.signal)
      .then((state) => {
        if (state.status === 'authenticated' || state.status === 'no_access' || state.status === 'selection_required') {
          setAuthenticated(true)
        }
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setCheckWarning(true)
      })
      .finally(() => {
        if (!controller.signal.aborted) setChecking(false)
      })
    return () => {
      controller.abort()
      submitGenerationRef.current += 1
      submitControllerRef.current?.abort()
    }
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    submitControllerRef.current?.abort()
    submitControllerRef.current = null
    const generation = submitGenerationRef.current + 1
    submitGenerationRef.current = generation
    const data = new FormData(event.currentTarget)
    const email = String(data.get('email') ?? '').trim()
    const password = String(data.get('password') ?? '')
    const nextErrors: FieldErrors = {}
    if (!email || !/^\S+@\S+\.\S+$/u.test(email)) nextErrors.email = 'Escribe un correo electrónico válido.'
    if (!password) nextErrors.password = 'Escribe tu contraseña.'
    setErrors(nextErrors)
    setFormError(null)
    if (Object.keys(nextErrors).length > 0) setSubmitting(false)
    if (nextErrors.email) return emailRef.current?.focus()
    if (nextErrors.password) return passwordRef.current?.focus()

    setSubmitting(true)
    const controller = new AbortController()
    submitControllerRef.current = controller
    try {
      const result = await signIn(email, password, controller.signal)
      if (controller.signal.aborted || submitGenerationRef.current !== generation) return
      if (result === 'success') {
        navigate(returnTo, { replace: true })
        return
      }
      setFormError(result === 'invalid_credentials' ? 'credentials' : 'service')
      window.requestAnimationFrame(() => errorRef.current?.focus())
    } catch (error) {
      if (controller.signal.aborted || submitGenerationRef.current !== generation) return
      if (error instanceof AuthServiceError) {
        setFormError('service')
        window.requestAnimationFrame(() => errorRef.current?.focus())
      }
    } finally {
      if (submitControllerRef.current === controller && submitGenerationRef.current === generation) {
        submitControllerRef.current = null
        setSubmitting(false)
      }
    }
  }

  if (authenticated) return <Navigate replace to={returnTo} />
  if (checking) return <main aria-label="Validando sesión" className="min-h-screen animate-pulse bg-neutral-50" />

  return (
    <main className="grid min-h-screen place-items-center bg-neutral-50 px-5 py-8">
      <section className="w-full max-w-105 rounded-panel border border-neutral-200 bg-neutral-0 p-6 sm:p-8" aria-labelledby="login-title">
        <div className="mb-7 flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-control bg-brand-700 text-xs font-bold text-white" aria-hidden="true">PF</div>
          <span className="font-semibold tracking-[-0.02em]">PedidoFlow</span>
        </div>
        <p className="mb-2 text-xs font-semibold tracking-[0.08em] text-neutral-500 uppercase">Acceso operativo</p>
        <h1 id="login-title" className="text-2xl font-semibold tracking-[-0.02em]">Inicia sesión</h1>
        <p className="mt-2 mb-6 text-sm leading-6 text-neutral-700">Usa la cuenta asignada por tu organización.</p>

        {checkWarning ? <Alert className="mb-5" tone="warning" title="No pudimos comprobar una sesión existente">Puedes intentar iniciar sesión.</Alert> : null}
        {formError ? (
          <div ref={errorRef} tabIndex={-1} className="outline-none">
            <Alert className="mb-5" tone="danger" title={formError === 'credentials' ? 'No pudimos iniciar sesión' : 'Servicio no disponible'}>
              {formError === 'credentials'
                ? 'El correo o la contraseña no son válidos.'
                : 'No fue posible conectar con el servicio. Inténtalo de nuevo.'}
            </Alert>
          </div>
        ) : null}

        <form noValidate onSubmit={handleSubmit} className="grid gap-5">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-neutral-900">Correo electrónico</label>
            <input ref={emailRef} id="email" name="email" type="email" autoComplete="username" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'email-error' : undefined} className="min-h-11 w-full rounded-control border border-neutral-300 px-3 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100" />
            {errors.email ? <p id="email-error" className="mt-1.5 text-sm text-danger-fg">{errors.email}</p> : null}
          </div>
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-neutral-900">Contraseña</label>
            <input ref={passwordRef} id="password" name="password" type="password" autoComplete="current-password" aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'password-error' : undefined} className="min-h-11 w-full rounded-control border border-neutral-300 px-3 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100" />
            {errors.password ? <p id="password-error" className="mt-1.5 text-sm text-danger-fg">{errors.password}</p> : null}
          </div>
          <Button type="submit" loading={submitting} className="w-full">Iniciar sesión</Button>
        </form>
      </section>
    </main>
  )
}
