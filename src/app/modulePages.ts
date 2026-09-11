export interface ModulePageDefinition {
  eyebrow: string
  title: string
  purpose: string
  plannedWork: string
}

export const modulePages: Record<string, ModulePageDefinition> = {
  home: {
    eyebrow: 'Operación', title: 'Inicio',
    purpose: 'Reunirá las prioridades reales del equipo cuando existan datos operativos.',
    plannedWork: 'La vista de inicio se conectará después de definir pedidos y estados reales.',
  },
  inbox: {
    eyebrow: 'Pedidos entrantes', title: 'Inbox',
    purpose: 'Centralizará conversaciones y borradores que necesitan revisión humana.',
    plannedWork: 'La bandeja, la conversación y la revisión interpretada se construirán en su propio hito.',
  },
  orders: {
    eyebrow: 'Operación', title: 'Pedidos',
    purpose: 'Permitirá consultar y dar seguimiento a pedidos confirmados.',
    plannedWork: 'El listado y los detalles aparecerán cuando exista el modelo de pedido.',
  },
  picking: {
    eyebrow: 'Almacén', title: 'Picking',
    purpose: 'Organizará el trabajo de surtido para pedidos confirmados.',
    plannedWork: 'Las listas de surtido se habilitarán después del flujo de confirmación.',
  },
  customers: {
    eyebrow: 'Catálogo comercial', title: 'Clientes',
    purpose: 'Mantendrá la información operativa necesaria para procesar pedidos B2B.',
    plannedWork: 'Los registros de clientes se incorporarán con aislamiento por organización.',
  },
  products: {
    eyebrow: 'Catálogo', title: 'Productos',
    purpose: 'Administrará productos, presentaciones y SKU usados para hacer coincidencias.',
    plannedWork: 'El catálogo se implementará con validación y alcance multi-tenant.',
  },
  inventory: {
    eyebrow: 'Catálogo', title: 'Inventario',
    purpose: 'Mostrará disponibilidad útil para revisar y surtir pedidos.',
    plannedWork: 'No se mostrarán existencias hasta definir su fuente y reglas operativas.',
  },
  pricing: {
    eyebrow: 'Catálogo comercial', title: 'Precios',
    purpose: 'Concentrará reglas de precio aplicables a clientes y productos.',
    plannedWork: 'Las reglas se diseñarán antes de permitir cambios o cálculos.',
  },
  import: {
    eyebrow: 'Configuración de datos', title: 'Importar',
    purpose: 'Permitirá cargar datos iniciales de forma revisable y segura.',
    plannedWork: 'Los formatos y validaciones se definirán antes de aceptar archivos.',
  },
  settings: {
    eyebrow: 'Administración', title: 'Configuración',
    purpose: 'Reunirá preferencias reales de la organización y sus integraciones.',
    plannedWork: 'No se simulan usuarios, organizaciones ni proveedores durante esta fase.',
  },
}
