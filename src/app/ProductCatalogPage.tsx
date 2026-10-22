import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useOutletContext } from 'react-router-dom'
import { z } from 'zod'
import { Alert, Badge, Button } from '../components/ui'
import {
  CatalogServiceError, createAlias, createProduct, deleteAlias, getProduct, listProducts,
  updateAlias, updateProduct, type ManualAlias, type ProductDetail, type ProductInput,
  type ProductStatus, type ProductSummary,
} from '../lib/catalog'
import type { ProtectedOutletContext } from './ProtectedRoute'

const fieldClass = 'min-h-11 w-full rounded-control border border-neutral-300 bg-neutral-0 px-3 text-sm text-neutral-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100'
const labelClass = 'mb-1.5 block text-sm font-medium text-neutral-900'
const schema = z.object({
  sku: z.string().trim().min(1, 'Escribe el SKU.').max(64, 'Usa máximo 64 caracteres.'),
  name: z.string().trim().min(1, 'Escribe el nombre.').max(160, 'Usa máximo 160 caracteres.'),
  variant: z.string().trim().max(120, 'Usa máximo 120 caracteres.'),
  orderUnit: z.string().trim().min(1, 'Escribe la unidad de pedido.').max(40, 'Usa máximo 40 caracteres.'),
  unitQuantity: z.string(),
  unitMeasure: z.string().trim().max(24, 'Usa máximo 24 caracteres.'),
}).superRefine((value, context) => {
  const quantity = value.unitQuantity.trim()
  if ((quantity === '') !== (value.unitMeasure === '')) context.addIssue({ code: 'custom', path: [quantity ? 'unitMeasure' : 'unitQuantity'], message: 'Cantidad y medida deben capturarse juntas.' })
  if (quantity && (!/^\d+$/u.test(quantity) || Number(quantity) <= 0 || !Number.isSafeInteger(Number(quantity)))) context.addIssue({ code: 'custom', path: ['unitQuantity'], message: 'Escribe un entero mayor que cero.' })
})
type ProductFormValues = z.input<typeof schema>

function isAbort(error: unknown) { return error instanceof DOMException && error.name === 'AbortError' }
function errorMessage(error: unknown) {
  if (error instanceof CatalogServiceError && error.kind === 'network') return 'No fue posible conectar con el catálogo. Revisa tu conexión.'
  if (error instanceof CatalogServiceError && error.kind === 'forbidden') return 'Tu rol no permite realizar esta operación.'
  if (error instanceof CatalogServiceError && error.kind === 'not_found') return 'El producto ya no está disponible.'
  return 'No fue posible completar la operación. Inténtalo de nuevo.'
}

function Dialog({ children, initialFocusSelector, label, onClose, open, triggerRef }: { children: React.ReactNode; initialFocusSelector?: string; label: string; onClose: () => void; open: boolean; triggerRef?: RefObject<HTMLElement | null> }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { const dialog = ref.current; if (!dialog) return; if (open && !dialog.open) { dialog.showModal(); if (initialFocusSelector) dialog.querySelector<HTMLElement>(initialFocusSelector)?.focus() } if (!open && dialog.open) dialog.close() }, [initialFocusSelector, open])
  return <dialog ref={ref} aria-label={label} className="m-auto max-h-[90vh] w-[min(42rem,calc(100%-2rem))] overflow-y-auto rounded-overlay border border-neutral-200 bg-neutral-0 p-0 text-neutral-900 shadow-overlay backdrop:bg-neutral-900/40" onClose={() => { onClose(); requestAnimationFrame(() => triggerRef?.current?.focus()) }}>{children}</dialog>
}

function ProductForm({ initial, onCancel, onSaved, onSessionExpired }: { initial?: ProductDetail; onCancel: () => void; onSaved: (message: string) => void; onSessionExpired: () => void }) {
  const controller = useRef<AbortController | null>(null)
  const { register, handleSubmit, setError, setFocus, formState: { errors, isSubmitting } } = useForm<ProductFormValues>({
    defaultValues: { sku: initial?.sku ?? '', name: initial?.name ?? '', variant: initial?.variant ?? '', orderUnit: initial?.orderUnit ?? '', unitQuantity: initial?.unitQuantityMilli?.toString() ?? '', unitMeasure: initial?.unitMeasure ?? '' },
  })
  useEffect(() => () => controller.current?.abort(), [])
  async function saveProduct(raw: ProductFormValues) {
    const parsed = schema.safeParse(raw)
    if (!parsed.success) { for (const issue of parsed.error.issues) setError(issue.path[0] as keyof ProductFormValues, { message: issue.message }); const first = parsed.error.issues[0]?.path[0]; if (typeof first === 'string') setFocus(first as keyof ProductFormValues); return }
    const value: ProductInput = { sku: parsed.data.sku, name: parsed.data.name, variant: parsed.data.variant || null, orderUnit: parsed.data.orderUnit, unitQuantityMilli: parsed.data.unitQuantity ? Number(parsed.data.unitQuantity) : null, unitMeasure: parsed.data.unitMeasure || null }
    const next = new AbortController(); controller.current?.abort(); controller.current = next
    try {
      if (initial) await updateProduct(initial.id, value, next.signal); else await createProduct(value, next.signal)
      onSaved(initial ? 'Producto actualizado.' : 'Producto creado.')
    } catch (error) {
      if (isAbort(error)) return
      if (error instanceof CatalogServiceError && error.kind === 'unauthenticated') onSessionExpired()
      else if (error instanceof CatalogServiceError && error.kind === 'conflict' && error.field === 'sku') setError('sku', { message: 'Ese SKU ya existe en tu organización.' }, { shouldFocus: true })
      else setError('root', { message: errorMessage(error) })
    }
  }
  const field = (name: keyof ProductFormValues, label: string, options?: { placeholder?: string }) => <div><label className={labelClass} htmlFor={`product-${name}`}>{label}</label><input id={`product-${name}`} className={fieldClass} aria-invalid={!!errors[name]} aria-describedby={errors[name] ? `product-${name}-error` : undefined} {...register(name)} placeholder={options?.placeholder} autoFocus={name === 'sku'} />{errors[name] ? <p id={`product-${name}-error`} className="mt-1 text-sm text-danger-fg">{errors[name]?.message}</p> : null}</div>
  // react-hook-form owns internal refs; invoking its stable submit wrapper during render is its public API.
  // oxlint-disable-next-line react/refs
  return <form noValidate onSubmit={handleSubmit(saveProduct)} className="grid gap-4 p-5 sm:p-6">
    {errors.root ? <Alert tone="danger" title="No se guardó el producto">{errors.root.message}</Alert> : null}
    <div className="grid gap-4 sm:grid-cols-2">{field('sku', 'SKU')}{field('name', 'Nombre')}</div>
    <div className="grid gap-4 sm:grid-cols-2">{field('variant', 'Variante (opcional)')}{field('orderUnit', 'Unidad de pedido', { placeholder: 'caja, pieza…' })}</div>
    <fieldset className="grid gap-4 rounded-panel border border-neutral-200 p-4 sm:grid-cols-2"><legend className="px-1 text-sm font-medium">Presentación opcional</legend>{field('unitQuantity', 'Cantidad en milésimas')}{field('unitMeasure', 'Medida')}</fieldset>
    <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onCancel} disabled={isSubmitting}>Cancelar</Button><Button type="submit" loading={isSubmitting}>Guardar producto</Button></div>
  </form>
}

function AliasManager({ product, onChanged, onSessionExpired }: { product: ProductDetail; onChanged: (product: ProductDetail, message: string) => void; onSessionExpired: () => void }) {
  const [value, setValue] = useState(''); const [editing, setEditing] = useState<ManualAlias | null>(null); const [pendingDelete, setPendingDelete] = useState<ManualAlias | null>(null); const [busy, setBusy] = useState<string | null>(null); const [error, setError] = useState(''); const controller = useRef<AbortController | null>(null); const inputRef = useRef<HTMLInputElement | null>(null)
  useEffect(() => () => controller.current?.abort(), [])
  async function save(event: React.FormEvent) {
    event.preventDefault(); const clean = value.normalize('NFC').trim(); if (!clean) { setError('Escribe un alias.'); inputRef.current?.focus(); return }; if ([...clean].length > 160) { setError('Usa máximo 160 caracteres.'); inputRef.current?.focus(); return }
    setBusy(editing?.id ?? 'new'); setError(''); const next = new AbortController(); controller.current?.abort(); controller.current = next
    try {
      const alias = editing ? await updateAlias(product.id, editing.id, clean, next.signal) : await createAlias(product.id, clean, next.signal)
      const aliases = editing ? product.aliases.map(item => item.id === alias.id ? alias : item) : [...product.aliases, alias]
      setValue(''); setEditing(null); onChanged({ ...product, aliases }, editing ? 'Alias actualizado.' : 'Alias agregado.')
    } catch (cause) { if (!isAbort(cause)) { if (cause instanceof CatalogServiceError && cause.kind === 'unauthenticated') onSessionExpired(); else setError(cause instanceof CatalogServiceError && cause.kind === 'conflict' ? 'Ese alias ya existe para este producto.' : errorMessage(cause)) } } finally { setBusy(null) }
  }
  async function remove(alias: ManualAlias) {
    setBusy(alias.id); setError(''); const next = new AbortController(); controller.current?.abort(); controller.current = next
    try { await deleteAlias(product.id, alias.id, next.signal); setPendingDelete(null); onChanged({ ...product, aliases: product.aliases.filter(item => item.id !== alias.id) }, 'Alias eliminado.') } catch (cause) { if (!isAbort(cause)) { if (cause instanceof CatalogServiceError && cause.kind === 'unauthenticated') onSessionExpired(); else setError(errorMessage(cause)) } } finally { setBusy(null) }
  }
  return <section className="border-t border-neutral-200 p-5 sm:p-6" aria-labelledby="aliases-title"><h3 id="aliases-title" className="font-semibold">Aliases manuales</h3><p className="mt-1 text-sm text-neutral-500">Nombres alternativos usados al interpretar pedidos.</p>
    <form onSubmit={save} className="mt-4 flex flex-col gap-2 sm:flex-row"><label className="sr-only" htmlFor="alias-value">Alias</label><input ref={inputRef} id="alias-value" className={fieldClass} value={value} onChange={event => setValue(event.target.value)} placeholder="Ej. Manzana roja" maxLength={160} disabled={!!busy} /><Button type="submit" loading={busy === (editing?.id ?? 'new')}>{editing ? 'Actualizar' : 'Agregar'}</Button>{editing ? <Button variant="ghost" onClick={() => { setEditing(null); setValue('') }}>Cancelar</Button> : null}</form>
    {error ? <p role="alert" className="mt-2 text-sm text-danger-fg">{error}</p> : null}
    {product.aliases.length ? <ul className="mt-4 divide-y divide-neutral-200 border-y border-neutral-200">{product.aliases.map(alias => <li key={alias.id} className="min-h-12 py-2"><div className="flex items-center justify-between gap-3"><span className="min-w-0 truncate text-sm">{alias.value}</span><div className="flex gap-1"><Button size="sm" variant="ghost" disabled={!!busy} onClick={() => { setEditing(alias); setValue(alias.value); requestAnimationFrame(() => inputRef.current?.focus()) }}>Editar alias</Button><Button size="sm" variant="ghost" disabled={!!busy} onClick={() => setPendingDelete(alias)}>Eliminar alias</Button></div></div>{pendingDelete?.id === alias.id ? <div role="group" aria-label={`Confirmar eliminación de ${alias.value}`} className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-control border border-danger-border bg-danger-bg p-2 text-sm text-danger-fg"><span>¿Eliminar este alias?</span><div className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => setPendingDelete(null)}>Conservar</Button><Button size="sm" variant="danger" loading={busy === alias.id} onClick={() => void remove(alias)}>Eliminar definitivamente</Button></div></div> : null}</li>)}</ul> : <p className="mt-4 text-sm text-neutral-500">Sin aliases manuales.</p>}
  </section>
}

export function ProductCatalogPage() {
  const { organization } = useOutletContext<ProtectedOutletContext>()
  const canManage = organization.role !== 'picker'
  const [items, setItems] = useState<ProductSummary[]>([]); const [status, setStatus] = useState<ProductStatus>('active'); const [query, setQuery] = useState(''); const [draftQuery, setDraftQuery] = useState(''); const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'unauthenticated'>(canManage ? 'loading' : 'ready'); const [loadingMore, setLoadingMore] = useState(false); const [retry, setRetry] = useState(0); const requestId = useRef(0)
  const listController = useRef<AbortController | null>(null); const actionController = useRef<AbortController | null>(null)
  const [editor, setEditor] = useState<{ mode: 'create' } | { mode: 'edit'; product: ProductDetail } | null>(null); const [editorLoading, setEditorLoading] = useState(false); const [confirm, setConfirm] = useState<ProductSummary | null>(null); const [success, setSuccess] = useState(''); const actionTrigger = useRef<HTMLElement | null>(null)
  const load = useCallback(async (cursor?: string) => {
    await Promise.resolve()
    const id = ++requestId.current; const controller = new AbortController(); listController.current?.abort(); listController.current = controller; if (cursor) setLoadingMore(true); else setState('loading')
    try { const result = await listProducts({ status, q: query, cursor }, controller.signal); if (id !== requestId.current) return; setItems(current => cursor ? [...current, ...result.items] : result.items); setNextCursor(result.nextCursor); setState('ready') }
    catch (error) { if (id !== requestId.current || isAbort(error)) return; if (error instanceof CatalogServiceError && error.kind === 'unauthenticated') setState('unauthenticated'); else setState('error') }
    finally { if (id === requestId.current) { setLoadingMore(false); if (listController.current === controller) listController.current = null } }
  }, [query, status])
  // A filter/retry transition intentionally starts a fresh remote request and loading state.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { if (!canManage) return; void load(); return () => { requestId.current += 1; listController.current?.abort() } }, [canManage, load, retry])
  useEffect(() => () => actionController.current?.abort(), [])
  if (state === 'unauthenticated') return <Navigate replace to="/login?returnTo=%2Fapp%2Fproducts" />
  if (!canManage) return <section aria-labelledby="products-title"><h1 id="products-title" tabIndex={-1} className="text-2xl font-semibold outline-none">Productos</h1><Alert className="mt-5" tone="warning" title="Catálogo no disponible">Tu rol de picker no tiene acceso al catálogo. Pide a un administrador el acceso necesario.</Alert></section>
  async function openEdit(product: ProductSummary, trigger: HTMLElement) { actionTrigger.current = trigger; setEditorLoading(true); const controller = new AbortController(); actionController.current?.abort(); actionController.current = controller; try { const detail = await getProduct(product.id, controller.signal); setEditor({ mode: 'edit', product: detail }) } catch (error) { if (!isAbort(error)) { setSuccess(''); setState(error instanceof CatalogServiceError && error.kind === 'unauthenticated' ? 'unauthenticated' : 'error') } } finally { if (actionController.current === controller) { actionController.current = null; setEditorLoading(false) } } }
  function saved(message: string) { setEditor(null); setSuccess(message); setRetry(value => value + 1) }
  async function toggleActive() { if (!confirm) return; const product = confirm; const controller = new AbortController(); actionController.current?.abort(); actionController.current = controller; try { await updateProduct(product.id, { active: !product.active }, controller.signal); setConfirm(null); setSuccess(product.active ? 'Producto desactivado.' : 'Producto reactivado.'); setRetry(value => value + 1) } catch (error) { if (!isAbort(error)) { setConfirm(null); setSuccess(''); setState(error instanceof CatalogServiceError && error.kind === 'unauthenticated' ? 'unauthenticated' : 'error') } } finally { if (actionController.current === controller) actionController.current = null } }
  const empty = state === 'ready' && items.length === 0
  return <section aria-labelledby="products-title">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-semibold tracking-[.08em] text-neutral-500 uppercase">Catálogo</p><h1 id="products-title" tabIndex={-1} className="mt-1 text-2xl font-semibold tracking-[-.02em] outline-none">Productos</h1><p className="mt-2 max-w-2xl text-sm text-neutral-500">Mantén SKUs, presentaciones y nombres alternativos listos para recibir pedidos.</p></div><Button onClick={event => { actionTrigger.current = event.currentTarget; setEditor({ mode: 'create' }) }}>Nuevo producto</Button></div>
    <div aria-live="polite" className="mt-5">{success ? <Alert tone="success" title="Cambio guardado">{success}</Alert> : null}</div>
    <form className="mt-5 flex flex-col gap-3 rounded-panel border border-neutral-200 bg-neutral-0 p-4 sm:flex-row sm:items-end" onSubmit={event => { event.preventDefault(); setQuery(draftQuery); setNextCursor(null) }}><div className="min-w-0 flex-1"><label className={labelClass} htmlFor="product-search">Buscar por SKU, nombre o variante</label><input id="product-search" className={fieldClass} value={draftQuery} onChange={event => setDraftQuery(event.target.value)} maxLength={160} /></div><div><label className={labelClass} htmlFor="product-status">Estado</label><select id="product-status" className={fieldClass} value={status} onChange={event => { setStatus(event.target.value as ProductStatus); setNextCursor(null) }}><option value="active">Activos</option><option value="inactive">Inactivos</option><option value="all">Todos</option></select></div><Button type="submit">Buscar</Button>{query ? <Button variant="ghost" onClick={() => { setDraftQuery(''); setQuery('') }}>Limpiar</Button> : null}</form>
    {state === 'loading' ? <div aria-label="Cargando productos" className="mt-5 grid animate-pulse gap-2">{[1,2,3].map(value => <div key={value} className="h-16 rounded-panel bg-neutral-200" />)}</div> : null}
    {state === 'error' ? <Alert className="mt-5" tone="danger" title="No pudimos cargar los productos">Revisa tu conexión e inténtalo de nuevo.<div className="mt-3"><Button onClick={() => setRetry(value => value + 1)}>Reintentar</Button></div></Alert> : null}
    {empty ? <div className="mt-5 rounded-panel border border-dashed border-neutral-300 bg-neutral-0 p-8 text-center"><h2 className="font-semibold">{query || status !== 'active' ? 'No hay resultados' : 'Aún no hay productos'}</h2><p className="mt-2 text-sm text-neutral-500">{query || status !== 'active' ? 'Conservamos tus filtros. Ajusta la búsqueda para volver a intentar.' : 'Crea el primer producto para comenzar tu catálogo.'}</p>{!query && status === 'active' ? <Button className="mt-4" onClick={event => { actionTrigger.current = event.currentTarget; setEditor({ mode: 'create' }) }}>Nuevo producto</Button> : null}</div> : null}
    {state === 'ready' && items.length ? <><div className="mt-5 hidden overflow-hidden rounded-panel border border-neutral-200 bg-neutral-0 md:block"><table className="w-full border-collapse text-left text-sm"><thead className="bg-neutral-100 text-xs text-neutral-500 uppercase"><tr><th className="px-4 py-3">SKU</th><th className="px-4 py-3">Producto</th><th className="px-4 py-3">Presentación</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Aliases</th><th className="px-4 py-3 text-right">Acciones</th></tr></thead><tbody className="divide-y divide-neutral-200">{items.map(product => <ProductRow key={product.id} product={product} loading={editorLoading} onEdit={openEdit} onToggle={(item, trigger) => { actionTrigger.current = trigger; setConfirm(item) }} />)}</tbody></table></div><div className="mt-5 grid gap-3 md:hidden">{items.map(product => <ProductCard key={product.id} product={product} loading={editorLoading} onEdit={openEdit} onToggle={(item, trigger) => { actionTrigger.current = trigger; setConfirm(item) }} />)}</div>{nextCursor ? <div className="mt-5 flex justify-center"><Button variant="secondary" loading={loadingMore} onClick={() => void load(nextCursor)}>Cargar más</Button></div> : null}</> : null}
    <Dialog open={!!editor} initialFocusSelector="#product-sku" label={editor?.mode === 'create' ? 'Nuevo producto' : 'Editar producto'} onClose={() => setEditor(null)} triggerRef={actionTrigger}><div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4"><h2 className="text-lg font-semibold">{editor?.mode === 'create' ? 'Nuevo producto' : 'Editar producto'}</h2><button className="grid size-10 place-items-center rounded-control hover:bg-neutral-100" aria-label="Cerrar" onClick={() => setEditor(null)}>×</button></div>{editor ? <><ProductForm initial={editor.mode === 'edit' ? editor.product : undefined} onCancel={() => setEditor(null)} onSaved={saved} onSessionExpired={() => setState('unauthenticated')} />{editor.mode === 'edit' ? <AliasManager product={editor.product} onChanged={(product, message) => { setEditor({ mode: 'edit', product }); setItems(current => current.map(item => item.id === product.id ? { ...item, aliasCount: product.aliases.length } : item)); setSuccess(message) }} onSessionExpired={() => setState('unauthenticated')} /> : null}</> : null}</Dialog>
    <Dialog open={!!confirm} label={confirm?.active ? 'Desactivar producto' : 'Reactivar producto'} onClose={() => setConfirm(null)} triggerRef={actionTrigger}><div className="p-6"><h2 className="text-lg font-semibold">{confirm?.active ? 'Desactivar producto' : 'Reactivar producto'}</h2><p className="mt-3 text-sm text-neutral-700">{confirm?.active ? 'Dejará de aparecer en la lista activa. Sus datos históricos se conservan.' : 'Volverá a estar disponible en el catálogo activo.'}</p><div className="mt-6 flex justify-end gap-2"><Button variant="secondary" onClick={() => setConfirm(null)}>Cancelar</Button><Button variant={confirm?.active ? 'danger' : 'primary'} onClick={() => void toggleActive()}>{confirm?.active ? 'Desactivar' : 'Reactivar'}</Button></div></div></Dialog>
  </section>
}

type ProductItemProps = { product: ProductSummary; loading: boolean; onEdit: (product: ProductSummary, trigger: HTMLElement) => void; onToggle: (product: ProductSummary, trigger: HTMLElement) => void }
function presentation(product: ProductSummary) { return product.unitQuantityMilli && product.unitMeasure ? `${product.unitQuantityMilli} ${product.unitMeasure} / ${product.orderUnit}` : product.orderUnit }
function ProductRow({ product, loading, onEdit, onToggle }: ProductItemProps) { return <tr><td className="px-4 py-3 font-medium">{product.sku}</td><td className="px-4 py-3"><span className="block font-medium">{product.name}</span>{product.variant ? <span className="text-neutral-500">{product.variant}</span> : null}</td><td className="px-4 py-3 text-neutral-700">{presentation(product)}</td><td className="px-4 py-3"><Badge tone={product.active ? 'success' : 'neutral'}>{product.active ? 'Activo' : 'Inactivo'}</Badge></td><td className="px-4 py-3">{product.aliasCount}</td><td className="px-4 py-3 text-right"><div className="inline-flex gap-1"><Button size="sm" variant="ghost" disabled={loading} onClick={event => void onEdit(product, event.currentTarget)}>Editar</Button><Button size="sm" variant="ghost" onClick={event => onToggle(product, event.currentTarget)}>{product.active ? 'Desactivar' : 'Reactivar'}</Button></div></td></tr> }
function ProductCard({ product, loading, onEdit, onToggle }: ProductItemProps) { return <article className="rounded-panel border border-neutral-200 bg-neutral-0 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-semibold text-neutral-500">{product.sku}</p><h2 className="mt-1 truncate font-semibold">{product.name}</h2>{product.variant ? <p className="text-sm text-neutral-500">{product.variant}</p> : null}</div><Badge tone={product.active ? 'success' : 'neutral'}>{product.active ? 'Activo' : 'Inactivo'}</Badge></div><dl className="mt-3 grid grid-cols-2 gap-3 border-t border-neutral-200 pt-3 text-sm"><div><dt className="text-neutral-500">Presentación</dt><dd className="mt-1">{presentation(product)}</dd></div><div><dt className="text-neutral-500">Aliases</dt><dd className="mt-1">{product.aliasCount}</dd></div></dl><div className="mt-4 flex gap-2"><Button size="sm" variant="secondary" disabled={loading} onClick={event => void onEdit(product, event.currentTarget)}>Editar</Button><Button size="sm" variant="ghost" onClick={event => onToggle(product, event.currentTarget)}>{product.active ? 'Desactivar' : 'Reactivar'}</Button></div></article> }
