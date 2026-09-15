import { sql } from 'drizzle-orm'
import { check, index, integer, primaryKey, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'
import { allowed, currencyCheck, exactInteger, identity, tenantKey, tenantReference, timestamps } from './helpers.js'

export * from './auth.js'

export const organizations = sqliteTable('organizations', {
  id: text('id').primaryKey().notNull(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  status: text('status', { enum: ['active', 'suspended'] }).notNull().default('active'),
  ...timestamps(),
}, t => [allowed('organizations_status_check', t.status, ['active', 'suspended'])])

export const organizationMembers = sqliteTable('organization_members', {
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
  userId: text('user_id').notNull(),
  role: text('role', { enum: ['owner', 'admin', 'operator', 'picker'] }).notNull(),
  status: text('status', { enum: ['active', 'invited'] }).notNull(),
  ...timestamps(),
}, t => [
  primaryKey({ columns: [t.organizationId, t.userId] }),
  allowed('organization_members_role_check', t.role, ['owner', 'admin', 'operator', 'picker']),
  allowed('organization_members_status_check', t.status, ['active', 'invited']),
])

export const customers = sqliteTable('customers', {
  ...identity(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
  code: text('code'),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  status: text('status', { enum: ['active', 'inactive'] }).notNull().default('active'),
  ...timestamps(),
}, t => [
  tenantKey('customers', t),
  unique('customers_code_unique').on(t.organizationId, t.code),
  index('customers_status_idx').on(t.organizationId, t.status),
  allowed('customers_status_check', t.status, ['active', 'inactive']),
])

export const customerAddresses = sqliteTable('customer_addresses', {
  ...identity(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
  customerId: text('customer_id').notNull(),
  label: text('label').notNull(),
  recipient: text('recipient').notNull(),
  streetLine1: text('street_line1').notNull(),
  streetLine2: text('street_line2'),
  locality: text('locality').notNull(),
  region: text('region').notNull(),
  postalCode: text('postal_code').notNull(),
  countryCode: text('country_code').notNull(),
  deliveryNotes: text('delivery_notes'),
  defaultDelivery: integer('default_delivery').notNull().default(0),
  ...timestamps(),
}, t => [
  tenantKey('customer_addresses', t),
  tenantReference('customer_addresses_customer_id_tenant_fk', t.organizationId, t.customerId, customers),
  index('customer_addresses_customer_id_idx').on(t.organizationId, t.customerId),
  exactInteger('customer_addresses_default_delivery_check', t.defaultDelivery, 0, 1),
])

export const products = sqliteTable('products', {
  ...identity(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
  sku: text('sku').notNull(),
  name: text('name').notNull(),
  variant: text('variant'),
  orderUnit: text('order_unit').notNull(),
  unitQuantityMilli: integer('unit_quantity_milli'),
  unitMeasure: text('unit_measure'),
  active: integer('active').notNull().default(1),
  ...timestamps(),
}, t => [
  tenantKey('products', t),
  unique('products_sku_unique').on(t.organizationId, t.sku),
  index('products_active_idx').on(t.organizationId, t.active),
  exactInteger('products_unit_quantity_milli_check', t.unitQuantityMilli, 1),
  exactInteger('products_active_check', t.active, 0, 1),
])

export const productAliases = sqliteTable('product_aliases', {
  ...identity(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
  productId: text('product_id').notNull(),
  alias: text('alias').notNull(),
  normalizedAlias: text('normalized_alias').notNull(),
  source: text('source', { enum: ['manual', 'import', 'correction'] }).notNull(),
  ...timestamps(),
}, t => [
  tenantKey('product_aliases', t),
  tenantReference('product_aliases_product_id_tenant_fk', t.organizationId, t.productId, products),
  unique('product_aliases_product_id_normalized_alias_unique').on(t.organizationId, t.productId, t.normalizedAlias),
  index('product_aliases_normalized_alias_idx').on(t.organizationId, t.normalizedAlias),
  allowed('product_aliases_source_check', t.source, ['manual', 'import', 'correction']),
])

export const priceLists = sqliteTable('price_lists', {
  ...identity(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
  name: text('name').notNull(),
  currency: text('currency').notNull(),
  active: integer('active').notNull().default(1),
  ...timestamps(),
}, t => [
  tenantKey('price_lists', t),
  unique('price_lists_name_unique').on(t.organizationId, t.name),
  index('price_lists_active_idx').on(t.organizationId, t.active),
  currencyCheck('price_lists_currency_check', t.currency),
  exactInteger('price_lists_active_check', t.active, 0, 1),
])

export const priceListItems = sqliteTable('price_list_items', {
  ...identity(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
  priceListId: text('price_list_id').notNull(),
  productId: text('product_id').notNull(),
  unitPriceMinor: integer('unit_price_minor').notNull(),
  validFrom: integer('valid_from').notNull(),
  validTo: integer('valid_to'),
  ...timestamps(),
}, t => [
  tenantKey('price_list_items', t),
  tenantReference('price_list_items_price_list_id_tenant_fk', t.organizationId, t.priceListId, priceLists),
  tenantReference('price_list_items_product_id_tenant_fk', t.organizationId, t.productId, products),
  unique('price_list_items_price_list_id_product_id_valid_from_unique').on(t.organizationId, t.priceListId, t.productId, t.validFrom),
  index('price_list_items_price_list_id_product_id_valid_from_valid_to_idx').on(t.organizationId, t.priceListId, t.productId, t.validFrom, t.validTo),
  exactInteger('price_list_items_unit_price_minor_check', t.unitPriceMinor, 0),
  exactInteger('price_list_items_valid_from_check', t.validFrom, 0),
  exactInteger('price_list_items_valid_to_check', t.validTo, 0),
  check('price_list_items_effective_range_check', sql`${t.validTo} is null or ${t.validTo} > ${t.validFrom}`),
])

export const customerPriceLists = sqliteTable('customer_price_lists', {
  ...identity(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
  customerId: text('customer_id').notNull(),
  priceListId: text('price_list_id').notNull(),
  validFrom: integer('valid_from').notNull(),
  validTo: integer('valid_to'),
  ...timestamps(),
}, t => [
  tenantKey('customer_price_lists', t),
  tenantReference('customer_price_lists_customer_id_tenant_fk', t.organizationId, t.customerId, customers),
  tenantReference('customer_price_lists_price_list_id_tenant_fk', t.organizationId, t.priceListId, priceLists),
  unique('customer_price_lists_customer_id_valid_from_unique').on(t.organizationId, t.customerId, t.validFrom),
  index('customer_price_lists_customer_id_valid_from_valid_to_idx').on(t.organizationId, t.customerId, t.validFrom, t.validTo),
  exactInteger('customer_price_lists_valid_from_check', t.validFrom, 0),
  exactInteger('customer_price_lists_valid_to_check', t.validTo, 0),
  check('customer_price_lists_effective_range_check', sql`${t.validTo} is null or ${t.validTo} > ${t.validFrom}`),
])

export const inventory = sqliteTable('inventory', {
  ...identity(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
  productId: text('product_id').notNull(),
  onHandMilli: integer('on_hand_milli').notNull().default(0),
  reservedMilli: integer('reserved_milli').notNull().default(0),
  ...timestamps(),
}, t => [
  tenantKey('inventory', t),
  tenantReference('inventory_product_id_tenant_fk', t.organizationId, t.productId, products),
  unique('inventory_product_id_unique').on(t.organizationId, t.productId),
  exactInteger('inventory_on_hand_milli_check', t.onHandMilli, 0),
  exactInteger('inventory_reserved_milli_check', t.reservedMilli, 0),
  check('inventory_reserved_check', sql`${t.reservedMilli} <= ${t.onHandMilli}`),
])

export const inventoryAdjustments = sqliteTable('inventory_adjustments', {
  ...identity(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
  productId: text('product_id').notNull(),
  deltaMilli: integer('delta_milli').notNull(),
  reason: text('reason').notNull(),
  sourceType: text('source_type').notNull(),
  sourceId: text('source_id'),
  actorUserId: text('actor_user_id'),
  occurredAt: integer('occurred_at').notNull(),
  ...timestamps(),
}, t => [
  tenantKey('inventory_adjustments', t),
  tenantReference('inventory_adjustments_product_id_tenant_fk', t.organizationId, t.productId, products),
  index('inventory_adjustments_product_id_occurred_at_idx').on(t.organizationId, t.productId, t.occurredAt),
  exactInteger('inventory_adjustments_delta_milli_check', t.deltaMilli, -Number.MAX_SAFE_INTEGER),
  exactInteger('inventory_adjustments_occurred_at_check', t.occurredAt, 0),
])

export const conversations = sqliteTable('conversations', {
  ...identity(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
  customerId: text('customer_id'),
  channel: text('channel', { enum: ['demo', 'whatsapp', 'email'] }).notNull(),
  providerConversationId: text('provider_conversation_id'),
  status: text('status', { enum: ['open', 'processing', 'needs_review', 'resolved'] }).notNull().default('open'),
  latestMessageAt: integer('latest_message_at'),
  ...timestamps(),
}, t => [
  tenantKey('conversations', t),
  tenantReference('conversations_customer_id_tenant_fk', t.organizationId, t.customerId, customers),
  unique('conversations_channel_provider_conversation_id_unique').on(t.organizationId, t.channel, t.providerConversationId),
  index('conversations_status_latest_message_at_idx').on(t.organizationId, t.status, t.latestMessageAt),
  allowed('conversations_channel_check', t.channel, ['demo', 'whatsapp', 'email']),
  allowed('conversations_status_check', t.status, ['open', 'processing', 'needs_review', 'resolved']),
  exactInteger('conversations_latest_message_at_check', t.latestMessageAt, 0),
])

export const messages = sqliteTable('messages', {
  ...identity(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
  conversationId: text('conversation_id').notNull(),
  direction: text('direction', { enum: ['inbound', 'outbound'] }).notNull(),
  providerMessageId: text('provider_message_id'),
  messageType: text('message_type').notNull(),
  body: text('body'),
  providerStatus: text('provider_status'),
  deliveryStatus: text('delivery_status'),
  occurredAt: integer('occurred_at').notNull(),
  ...timestamps(),
}, t => [
  tenantKey('messages', t),
  tenantReference('messages_conversation_id_tenant_fk', t.organizationId, t.conversationId, conversations),
  unique('messages_provider_message_id_unique').on(t.organizationId, t.providerMessageId),
  index('messages_conversation_id_occurred_at_idx').on(t.organizationId, t.conversationId, t.occurredAt),
  allowed('messages_direction_check', t.direction, ['inbound', 'outbound']),
  exactInteger('messages_occurred_at_check', t.occurredAt, 0),
])

export const messageAttachments = sqliteTable('message_attachments', {
  ...identity(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
  messageId: text('message_id').notNull(),
  providerAttachmentId: text('provider_attachment_id'),
  fileName: text('file_name'),
  contentType: text('content_type').notNull(),
  sizeBytes: integer('size_bytes'),
  r2ObjectKey: text('r2_object_key'),
  providerMetadata: text('provider_metadata'),
  ...timestamps(),
}, t => [
  tenantKey('message_attachments', t),
  tenantReference('message_attachments_message_id_tenant_fk', t.organizationId, t.messageId, messages),
  index('message_attachments_message_id_idx').on(t.organizationId, t.messageId),
  exactInteger('message_attachments_size_bytes_check', t.sizeBytes, 0),
  check('message_attachments_provider_metadata_json', sql`json_valid(${t.providerMetadata}) or ${t.providerMetadata} is null`),
])

export const orderDrafts = sqliteTable('order_drafts', {
  ...identity(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
  conversationId: text('conversation_id'),
  customerId: text('customer_id'),
  sourceText: text('source_text').notNull(),
  sourceType: text('source_type').notNull(),
  status: text('status', { enum: ['interpreting', 'needs_review', 'ready', 'confirmed', 'failed', 'discarded'] }).notNull().default('needs_review'),
  version: integer('version').notNull().default(1),
  creatorUserId: text('creator_user_id'),
  ...timestamps(),
}, t => [
  tenantKey('order_drafts', t),
  tenantReference('order_drafts_conversation_id_tenant_fk', t.organizationId, t.conversationId, conversations),
  tenantReference('order_drafts_customer_id_tenant_fk', t.organizationId, t.customerId, customers),
  index('order_drafts_status_updated_at_idx').on(t.organizationId, t.status, t.updatedAt),
  allowed('order_drafts_status_check', t.status, ['interpreting', 'needs_review', 'ready', 'confirmed', 'failed', 'discarded']),
  exactInteger('order_drafts_version_check', t.version, 1),
])

export const orderDraftItems = sqliteTable('order_draft_items', {
  ...identity(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
  draftId: text('draft_id').notNull(),
  position: integer('position').notNull(),
  orderedText: text('ordered_text').notNull(),
  productId: text('product_id'),
  quantityMilli: integer('quantity_milli'),
  unit: text('unit'),
  unitPriceMinor: integer('unit_price_minor'),
  confidenceBps: integer('confidence_bps'),
  matchMethod: text('match_method', { enum: ['deterministic', 'ai', 'manual', 'unmatched'] }).notNull().default('unmatched'),
  requiresReview: integer('requires_review').notNull().default(1),
  reviewReason: text('review_reason'),
  ...timestamps(),
}, t => [
  tenantKey('order_draft_items', t),
  tenantReference('order_draft_items_draft_id_tenant_fk', t.organizationId, t.draftId, orderDrafts),
  tenantReference('order_draft_items_product_id_tenant_fk', t.organizationId, t.productId, products),
  unique('order_draft_items_draft_id_position_unique').on(t.organizationId, t.draftId, t.position),
  exactInteger('order_draft_items_position_check', t.position, 0),
  exactInteger('order_draft_items_quantity_milli_check', t.quantityMilli, 1),
  exactInteger('order_draft_items_unit_price_minor_check', t.unitPriceMinor, 0),
  exactInteger('order_draft_items_confidence_bps_check', t.confidenceBps, 0, 10000),
  allowed('order_draft_items_match_method_check', t.matchMethod, ['deterministic', 'ai', 'manual', 'unmatched']),
  exactInteger('order_draft_items_requires_review_check', t.requiresReview, 0, 1),
])

export const orders = sqliteTable('orders', {
  ...identity(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
  orderNumber: text('order_number').notNull(),
  customerId: text('customer_id').notNull(),
  sourceDraftId: text('source_draft_id'),
  conversationId: text('conversation_id'),
  status: text('status', { enum: ['draft', 'needs_review', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'] }).notNull().default('draft'),
  currency: text('currency').notNull(),
  fulfillmentNotes: text('fulfillment_notes'),
  subtotalMinor: integer('subtotal_minor').notNull(),
  totalMinor: integer('total_minor').notNull(),
  version: integer('version').notNull().default(1),
  creatorUserId: text('creator_user_id'),
  confirmerUserId: text('confirmer_user_id'),
  confirmedAt: integer('confirmed_at'),
  cancellationReason: text('cancellation_reason'),
  ...timestamps(),
}, t => [
  tenantKey('orders', t),
  tenantReference('orders_customer_id_tenant_fk', t.organizationId, t.customerId, customers),
  tenantReference('orders_source_draft_id_tenant_fk', t.organizationId, t.sourceDraftId, orderDrafts),
  tenantReference('orders_conversation_id_tenant_fk', t.organizationId, t.conversationId, conversations),
  unique('orders_order_number_unique').on(t.organizationId, t.orderNumber),
  unique('orders_source_draft_id_unique').on(t.organizationId, t.sourceDraftId),
  index('orders_status_created_at_idx').on(t.organizationId, t.status, t.createdAt),
  index('orders_customer_id_created_at_idx').on(t.organizationId, t.customerId, t.createdAt),
  allowed('orders_status_check', t.status, ['draft', 'needs_review', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled']),
  currencyCheck('orders_currency_check', t.currency),
  exactInteger('orders_subtotal_minor_check', t.subtotalMinor, 0),
  exactInteger('orders_total_minor_check', t.totalMinor, 0),
  exactInteger('orders_version_check', t.version, 1),
  exactInteger('orders_confirmed_at_check', t.confirmedAt, 0),
  check('orders_cancellation_reason_check', sql`${t.status} <> 'cancelled' or length(trim(${t.cancellationReason})) > 0 and ${t.cancellationReason} is not null`),
])

export const orderItems = sqliteTable('order_items', {
  ...identity(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
  orderId: text('order_id').notNull(),
  position: integer('position').notNull(),
  productId: text('product_id'),
  orderedText: text('ordered_text').notNull(),
  skuSnapshot: text('sku_snapshot').notNull(),
  nameSnapshot: text('name_snapshot').notNull(),
  variantSnapshot: text('variant_snapshot'),
  quantityMilli: integer('quantity_milli').notNull(),
  unit: text('unit').notNull(),
  unitPriceMinor: integer('unit_price_minor').notNull(),
  lineTotalMinor: integer('line_total_minor').notNull(),
  currency: text('currency').notNull(),
  matchContext: text('match_context'),
  ...timestamps(),
}, t => [
  tenantKey('order_items', t),
  tenantReference('order_items_order_id_tenant_fk', t.organizationId, t.orderId, orders),
  tenantReference('order_items_product_id_tenant_fk', t.organizationId, t.productId, products),
  unique('order_items_order_id_position_unique').on(t.organizationId, t.orderId, t.position),
  exactInteger('order_items_position_check', t.position, 0),
  exactInteger('order_items_quantity_milli_check', t.quantityMilli, 1),
  exactInteger('order_items_unit_price_minor_check', t.unitPriceMinor, 0),
  exactInteger('order_items_line_total_minor_check', t.lineTotalMinor, 0),
  currencyCheck('order_items_currency_check', t.currency),
  check('order_items_match_context_json', sql`json_valid(${t.matchContext}) or ${t.matchContext} is null`),
])

export const orderStatusEvents = sqliteTable('order_status_events', {
  ...identity(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
  orderId: text('order_id').notNull(),
  fromStatus: text('from_status', { enum: ['draft', 'needs_review', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'] }),
  toStatus: text('to_status', { enum: ['draft', 'needs_review', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'] }).notNull(),
  actorUserId: text('actor_user_id'),
  reason: text('reason'),
  note: text('note'),
  occurredAt: integer('occurred_at').notNull(),
  ...timestamps(),
}, t => [
  tenantKey('order_status_events', t),
  tenantReference('order_status_events_order_id_tenant_fk', t.organizationId, t.orderId, orders),
  index('order_status_events_order_id_occurred_at_idx').on(t.organizationId, t.orderId, t.occurredAt),
  allowed('order_status_events_from_status_check', t.fromStatus, ['draft', 'needs_review', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled']),
  allowed('order_status_events_to_status_check', t.toStatus, ['draft', 'needs_review', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled']),
  exactInteger('order_status_events_occurred_at_check', t.occurredAt, 0),
])

export const payments = sqliteTable('payments', {
  ...identity(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
  orderId: text('order_id').notNull(),
  status: text('status', { enum: ['pending', 'partial', 'paid', 'overdue', 'void'] }).notNull().default('pending'),
  expectedMinor: integer('expected_minor').notNull(),
  receivedMinor: integer('received_minor').notNull().default(0),
  currency: text('currency').notNull(),
  dueDate: text('due_date'),
  paidAt: integer('paid_at'),
  actorUserId: text('actor_user_id'),
  ...timestamps(),
}, t => [
  tenantKey('payments', t),
  tenantReference('payments_order_id_tenant_fk', t.organizationId, t.orderId, orders),
  index('payments_order_id_status_due_date_idx').on(t.organizationId, t.orderId, t.status, t.dueDate),
  index('payments_status_due_date_idx').on(t.organizationId, t.status, t.dueDate),
  allowed('payments_status_check', t.status, ['pending', 'partial', 'paid', 'overdue', 'void']),
  exactInteger('payments_expected_minor_check', t.expectedMinor, 0),
  exactInteger('payments_received_minor_check', t.receivedMinor, 0),
  currencyCheck('payments_currency_check', t.currency),
  exactInteger('payments_paid_at_check', t.paidAt, 0),
])

export const aiProcessingRuns = sqliteTable('ai_processing_runs', {
  ...identity(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
  draftId: text('draft_id').notNull(),
  taskType: text('task_type').notNull(),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  status: text('status', { enum: ['queued', 'running', 'succeeded', 'failed'] }).notNull(),
  startedAt: integer('started_at'),
  finishedAt: integer('finished_at'),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  estimatedCostMinor: integer('estimated_cost_minor'),
  costCurrency: text('cost_currency'),
  costMinorUnitScale: integer('cost_minor_unit_scale'),
  safeErrorCode: text('safe_error_code'),
  ...timestamps(),
}, t => [
  tenantKey('ai_processing_runs', t),
  tenantReference('ai_processing_runs_draft_id_tenant_fk', t.organizationId, t.draftId, orderDrafts),
  index('ai_processing_runs_draft_id_created_at_idx').on(t.organizationId, t.draftId, t.createdAt),
  allowed('ai_processing_runs_status_check', t.status, ['queued', 'running', 'succeeded', 'failed']),
  exactInteger('ai_processing_runs_started_at_check', t.startedAt, 0),
  exactInteger('ai_processing_runs_finished_at_check', t.finishedAt, 0),
  exactInteger('ai_processing_runs_input_tokens_check', t.inputTokens, 0),
  exactInteger('ai_processing_runs_output_tokens_check', t.outputTokens, 0),
  exactInteger('ai_processing_runs_estimated_cost_minor_check', t.estimatedCostMinor, 0),
  currencyCheck('ai_processing_runs_cost_currency_check', t.costCurrency),
  exactInteger('ai_processing_runs_cost_minor_unit_scale_check', t.costMinorUnitScale, 1),
  check('ai_processing_runs_cost_unit_check', sql`${t.estimatedCostMinor} is null or (${t.costCurrency} is not null and ${t.costMinorUnitScale} is not null)`),
])

export const auditEvents = sqliteTable('audit_events', {
  ...identity(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
  actorUserId: text('actor_user_id'),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  metadata: text('metadata'),
  requestId: text('request_id'),
  occurredAt: integer('occurred_at').notNull(),
  ...timestamps(),
}, t => [
  tenantKey('audit_events', t),
  index('audit_events_entity_type_entity_id_created_at_idx').on(t.organizationId, t.entityType, t.entityId, t.createdAt),
  check('audit_events_metadata_json', sql`json_valid(${t.metadata}) or ${t.metadata} is null`),
  exactInteger('audit_events_occurred_at_check', t.occurredAt, 0),
])
