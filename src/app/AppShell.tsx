import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Badge } from '../components/ui'
import { cn } from '../lib/cn'

interface NavigationItem {
  label: string
  path: string
  icon: IconName
  end?: boolean
}

type IconName = 'home' | 'inbox' | 'orders' | 'picking' | 'customers' | 'products' | 'inventory' | 'pricing' | 'import' | 'settings' | 'grid' | 'more'

const primaryNavigation: NavigationItem[] = [
  { label: 'Inicio', path: '/app', icon: 'home', end: true },
  { label: 'Inbox', path: '/app/inbox', icon: 'inbox' },
  { label: 'Pedidos', path: '/app/orders', icon: 'orders' },
  { label: 'Picking', path: '/app/picking', icon: 'picking' },
]

const managementNavigation: NavigationItem[] = [
  { label: 'Clientes', path: '/app/customers', icon: 'customers' },
  { label: 'Productos', path: '/app/products', icon: 'products' },
  { label: 'Inventario', path: '/app/inventory', icon: 'inventory' },
  { label: 'Precios', path: '/app/pricing', icon: 'pricing' },
  { label: 'Importar', path: '/app/import', icon: 'import' },
]

const utilityNavigation: NavigationItem[] = [
  { label: 'Configuración', path: '/app/settings', icon: 'settings' },
]

const catalogPaths = ['/app/products', '/app/inventory']
const morePaths = ['/app/picking', '/app/customers', '/app/pricing', '/app/import', '/app/settings']

function isSectionActive(pathname: string, paths: string[]) {
  return paths.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9" /><path d="M9 20v-6h6v6" /></>,
    inbox: <><path d="M4 5h16v14H4z" /><path d="M4 13h4l2 3h4l2-3h4" /></>,
    orders: <><path d="M6 3h12v18H6z" /><path d="M9 8h6M9 12h6M9 16h4" /></>,
    picking: <><path d="M4 7h16v13H4z" /><path d="m8 7 2-4h4l2 4M9 13l2 2 4-5" /></>,
    customers: <><circle cx="9" cy="8" r="3" /><path d="M3 20c0-4 2-6 6-6s6 2 6 6M16 5a3 3 0 0 1 0 6M17 14c2.7.4 4 2.4 4 6" /></>,
    products: <><path d="m4 7 8-4 8 4-8 4z" /><path d="m4 7v10l8 4 8-4V7M12 11v10" /></>,
    inventory: <><path d="M4 5h16v15H4zM8 5V3h8v2M8 10h8M8 15h8" /></>,
    pricing: <><path d="M4 4h7l9 9-7 7-9-9z" /><circle cx="8" cy="8" r="1" /></>,
    import: <><path d="M12 3v12M8 7l4-4 4 4" /><path d="M5 13v7h14v-7" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a8 8 0 0 0-1.7-1L14.5 3h-5l-.4 3.1a8 8 0 0 0-1.7 1l-2.4-1-2 3.4L5.1 11a7 7 0 0 0 0 2L3 14.5l2 3.4 2.4-1a8 8 0 0 0 1.7 1l.4 3.1h5l.4-3.1a8 8 0 0 0 1.7-1l2.4 1 2-3.4-2.1-1.5a7 7 0 0 0 .1-1Z" /></>,
    grid: <><rect x="4" y="4" width="6" height="6" /><rect x="14" y="4" width="6" height="6" /><rect x="4" y="14" width="6" height="6" /><rect x="14" y="14" width="6" height="6" /></>,
    more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  }

  return (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}

function DesktopNavigationLink({ item }: { item: NavigationItem }) {
  return (
    <NavLink
      to={item.path}
      end={item.end}
      className={({ isActive }) => cn(
        'flex min-h-10 items-center gap-3 rounded-control border-l-2 px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
        isActive ? 'border-brand-700 bg-brand-50 text-brand-700' : 'border-transparent text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900',
      )}
    >
      <Icon name={item.icon} />
      <span>{item.label}</span>
    </NavLink>
  )
}

function DesktopNavigationGroup({ label, items }: { label: string; items: NavigationItem[] }) {
  return (
    <div className="mt-6 first:mt-0">
      <p className="mb-2 px-3 text-[0.6875rem] font-semibold tracking-[0.08em] text-neutral-500 uppercase">{label}</p>
      <div className="grid gap-1">
        {items.map((item) => <DesktopNavigationLink key={item.path} item={item} />)}
      </div>
    </div>
  )
}

function MobileNavigationLink({ item }: { item: NavigationItem }) {
  return (
    <NavLink
      to={item.path}
      end={item.end}
      className={({ isActive }) => cn(
        'flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-control px-1 text-[0.6875rem] font-medium focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-600',
        isActive ? 'bg-brand-50 text-brand-700' : 'text-neutral-700',
      )}
    >
      <Icon name={item.icon} />
      <span className="max-w-full truncate">{item.label}</span>
    </NavLink>
  )
}

interface MobileDrawerProps {
  id: string
  label: string
  items: NavigationItem[]
  open: boolean
  onClose: () => void
  triggerRef: RefObject<HTMLButtonElement | null>
}

function MobileDrawer({ id, items, label, onClose, open, triggerRef }: MobileDrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  function handleClose() {
    onClose()
    window.requestAnimationFrame(() => triggerRef.current?.focus())
  }

  return (
    <dialog
      ref={dialogRef}
      id={id}
      aria-labelledby={`${id}-title`}
      className="m-0 mt-auto w-full max-w-none rounded-t-overlay border border-neutral-200 bg-neutral-0 p-0 text-neutral-900 shadow-overlay backdrop:bg-neutral-900/40"
      onClose={handleClose}
    >
      <div className="flex min-h-14 items-center justify-between border-b border-neutral-200 px-5">
        <h2 id={`${id}-title`} className="text-base font-semibold">{label}</h2>
        <button type="button" className="grid size-11 place-items-center rounded-control text-neutral-700 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-brand-600" aria-label={`Cerrar ${label}`} onClick={() => dialogRef.current?.close()}>
          <span aria-hidden="true" className="text-2xl leading-none">×</span>
        </button>
      </div>
      <nav aria-label={label} className="grid gap-1 px-3 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={() => dialogRef.current?.close()}
            className={({ isActive }) => cn(
              'flex min-h-12 items-center gap-3 rounded-control border-l-2 px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-brand-600',
              isActive ? 'border-brand-700 bg-brand-50 text-brand-700' : 'border-transparent text-neutral-700 hover:bg-neutral-100',
            )}
          >
            <Icon name={item.icon} />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </dialog>
  )
}

function MobileNavigation() {
  const location = useLocation()
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const catalogTriggerRef = useRef<HTMLButtonElement>(null)
  const moreTriggerRef = useRef<HTMLButtonElement>(null)
  const catalogActive = isSectionActive(location.pathname, catalogPaths)
  const moreActive = isSectionActive(location.pathname, morePaths)
  const triggerClasses = (active: boolean) => cn(
    'flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-control px-1 text-[0.6875rem] font-medium focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-600',
    active ? 'bg-brand-50 text-brand-700' : 'text-neutral-700',
  )

  return (
    <>
      <nav aria-label="Navegación principal móvil" className="fixed inset-x-0 bottom-0 z-20 flex border-t border-neutral-200 bg-neutral-0 px-1 pb-[env(safe-area-inset-bottom)] md:hidden">
        <MobileNavigationLink item={primaryNavigation[0]} />
        <MobileNavigationLink item={primaryNavigation[1]} />
        <MobileNavigationLink item={primaryNavigation[2]} />
        <button ref={catalogTriggerRef} type="button" className={triggerClasses(catalogActive)} aria-expanded={catalogOpen} aria-controls="catalog-navigation" aria-current={catalogActive ? 'page' : undefined} onClick={() => setCatalogOpen(true)}>
          <Icon name="grid" /><span className="max-w-full truncate">Catálogo</span>
        </button>
        <button ref={moreTriggerRef} type="button" className={triggerClasses(moreActive)} aria-expanded={moreOpen} aria-controls="more-navigation" aria-current={moreActive ? 'page' : undefined} onClick={() => setMoreOpen(true)}>
          <Icon name="more" /><span className="max-w-full truncate">Más</span>
        </button>
      </nav>

      <MobileDrawer id="catalog-navigation" label="Catálogo" items={managementNavigation.filter((item) => catalogPaths.includes(item.path))} open={catalogOpen} onClose={() => setCatalogOpen(false)} triggerRef={catalogTriggerRef} />
      <MobileDrawer id="more-navigation" label="Más secciones" items={[primaryNavigation[3], ...managementNavigation.filter((item) => morePaths.includes(item.path)), ...utilityNavigation]} open={moreOpen} onClose={() => setMoreOpen(false)} triggerRef={moreTriggerRef} />
    </>
  )
}

export function AppShell() {
  const location = useLocation()
  const initialRender = useRef(true)

  useEffect(() => {
    const heading = document.querySelector<HTMLElement>('#main-content h1')
    if (heading) document.title = `${heading.textContent} | PedidoFlow`
    if (initialRender.current) {
      initialRender.current = false
      return
    }
    heading?.focus()
  }, [location.pathname])

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 md:grid md:grid-cols-[13rem_minmax(0,1fr)] lg:grid-cols-[15rem_minmax(0,1fr)]">
      <a href="#main-content" className="fixed top-3 left-3 z-50 -translate-y-20 rounded-control bg-brand-700 px-4 py-2 text-sm font-medium text-white focus:translate-y-0">
        Saltar al contenido principal
      </a>

      <aside className="hidden min-h-screen border-r border-neutral-200 bg-neutral-0 md:flex md:flex-col">
        <div className="flex h-16 items-center gap-3 border-b border-neutral-200 px-4 lg:px-5">
          <div className="grid size-8 shrink-0 place-items-center rounded-control bg-brand-700 text-xs font-bold text-white" aria-hidden="true">PF</div>
          <span className="min-w-0 truncate text-base font-semibold tracking-[-0.02em]">PedidoFlow</span>
        </div>
        <nav aria-label="Navegación principal" className="flex-1 overflow-y-auto px-3 py-5">
          <DesktopNavigationGroup label="Operación" items={primaryNavigation} />
          <DesktopNavigationGroup label="Gestión" items={managementNavigation} />
          <DesktopNavigationGroup label="Sistema" items={utilityNavigation} />
        </nav>
      </aside>

      <div className="min-w-0">
        <header className="flex h-14 items-center justify-between border-b border-neutral-200 bg-neutral-0 px-4 sm:px-5 lg:px-8">
          <div className="flex items-center gap-2 md:hidden">
            <div className="grid size-8 place-items-center rounded-control bg-brand-700 text-xs font-bold text-white" aria-hidden="true">PF</div>
            <span className="font-semibold tracking-[-0.02em]">PedidoFlow</span>
          </div>
          <p className="hidden text-sm text-neutral-500 md:block">Espacio operativo</p>
          <Badge tone="neutral">Estructura inicial</Badge>
        </header>

        <main id="main-content" tabIndex={-1} className="px-4 pt-6 pb-24 outline-none sm:px-5 md:px-6 md:py-8 lg:px-8">
          <Outlet />
        </main>
      </div>

      <MobileNavigation />
    </div>
  )
}
