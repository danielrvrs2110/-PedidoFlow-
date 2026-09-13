CREATE TABLE `ai_processing_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`draft_id` text NOT NULL,
	`task_type` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`status` text NOT NULL,
	`started_at` integer,
	`finished_at` integer,
	`input_tokens` integer,
	`output_tokens` integer,
	`estimated_cost_minor` integer,
	`cost_currency` text,
	`cost_minor_unit_scale` integer,
	`safe_error_code` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE restrict ON DELETE restrict,
	FOREIGN KEY (`organization_id`,`draft_id`) REFERENCES `order_drafts`(`organization_id`,`id`) ON UPDATE restrict ON DELETE restrict,
	CONSTRAINT "ai_processing_runs_status_check" CHECK("ai_processing_runs"."status" in ('queued', 'running', 'succeeded', 'failed')),
	CONSTRAINT "ai_processing_runs_started_at_check" CHECK("ai_processing_runs"."started_at" is null or (typeof("ai_processing_runs"."started_at") = 'integer' and "ai_processing_runs"."started_at" between 0 and 9007199254740991)),
	CONSTRAINT "ai_processing_runs_finished_at_check" CHECK("ai_processing_runs"."finished_at" is null or (typeof("ai_processing_runs"."finished_at") = 'integer' and "ai_processing_runs"."finished_at" between 0 and 9007199254740991)),
	CONSTRAINT "ai_processing_runs_input_tokens_check" CHECK("ai_processing_runs"."input_tokens" is null or (typeof("ai_processing_runs"."input_tokens") = 'integer' and "ai_processing_runs"."input_tokens" between 0 and 9007199254740991)),
	CONSTRAINT "ai_processing_runs_output_tokens_check" CHECK("ai_processing_runs"."output_tokens" is null or (typeof("ai_processing_runs"."output_tokens") = 'integer' and "ai_processing_runs"."output_tokens" between 0 and 9007199254740991)),
	CONSTRAINT "ai_processing_runs_estimated_cost_minor_check" CHECK("ai_processing_runs"."estimated_cost_minor" is null or (typeof("ai_processing_runs"."estimated_cost_minor") = 'integer' and "ai_processing_runs"."estimated_cost_minor" between 0 and 9007199254740991)),
	CONSTRAINT "ai_processing_runs_cost_currency_check" CHECK(length("ai_processing_runs"."cost_currency") = 3 and "ai_processing_runs"."cost_currency" not glob '*[^A-Z]*'),
	CONSTRAINT "ai_processing_runs_cost_minor_unit_scale_check" CHECK("ai_processing_runs"."cost_minor_unit_scale" is null or (typeof("ai_processing_runs"."cost_minor_unit_scale") = 'integer' and "ai_processing_runs"."cost_minor_unit_scale" between 1 and 9007199254740991)),
	CONSTRAINT "ai_processing_runs_cost_unit_check" CHECK("ai_processing_runs"."estimated_cost_minor" is null or ("ai_processing_runs"."cost_currency" is not null and "ai_processing_runs"."cost_minor_unit_scale" is not null))
);
--> statement-breakpoint
CREATE INDEX `ai_processing_runs_draft_id_created_at_idx` ON `ai_processing_runs` (`organization_id`,`draft_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `ai_processing_runs_organization_id_unique` ON `ai_processing_runs` (`organization_id`,`id`);--> statement-breakpoint
CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`actor_user_id` text,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`metadata` text,
	`request_id` text,
	`occurred_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE restrict ON DELETE restrict,
	CONSTRAINT "audit_events_metadata_json" CHECK(json_valid("audit_events"."metadata") or "audit_events"."metadata" is null),
	CONSTRAINT "audit_events_occurred_at_check" CHECK("audit_events"."occurred_at" is null or (typeof("audit_events"."occurred_at") = 'integer' and "audit_events"."occurred_at" between 0 and 9007199254740991))
);
--> statement-breakpoint
CREATE INDEX `audit_events_entity_type_entity_id_created_at_idx` ON `audit_events` (`organization_id`,`entity_type`,`entity_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `audit_events_organization_id_unique` ON `audit_events` (`organization_id`,`id`);--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`customer_id` text,
	`channel` text NOT NULL,
	`provider_conversation_id` text,
	`status` text DEFAULT 'open' NOT NULL,
	`latest_message_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE restrict ON DELETE restrict,
	FOREIGN KEY (`organization_id`,`customer_id`) REFERENCES `customers`(`organization_id`,`id`) ON UPDATE restrict ON DELETE restrict,
	CONSTRAINT "conversations_channel_check" CHECK("conversations"."channel" in ('demo', 'whatsapp', 'email')),
	CONSTRAINT "conversations_status_check" CHECK("conversations"."status" in ('open', 'processing', 'needs_review', 'resolved')),
	CONSTRAINT "conversations_latest_message_at_check" CHECK("conversations"."latest_message_at" is null or (typeof("conversations"."latest_message_at") = 'integer' and "conversations"."latest_message_at" between 0 and 9007199254740991))
);
--> statement-breakpoint
CREATE INDEX `conversations_status_latest_message_at_idx` ON `conversations` (`organization_id`,`status`,`latest_message_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `conversations_organization_id_unique` ON `conversations` (`organization_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `conversations_channel_provider_conversation_id_unique` ON `conversations` (`organization_id`,`channel`,`provider_conversation_id`);--> statement-breakpoint
CREATE TABLE `customer_addresses` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`label` text NOT NULL,
	`recipient` text NOT NULL,
	`street_line1` text NOT NULL,
	`street_line2` text,
	`locality` text NOT NULL,
	`region` text NOT NULL,
	`postal_code` text NOT NULL,
	`country_code` text NOT NULL,
	`delivery_notes` text,
	`default_delivery` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE restrict ON DELETE restrict,
	FOREIGN KEY (`organization_id`,`customer_id`) REFERENCES `customers`(`organization_id`,`id`) ON UPDATE restrict ON DELETE restrict,
	CONSTRAINT "customer_addresses_default_delivery_check" CHECK("customer_addresses"."default_delivery" is null or (typeof("customer_addresses"."default_delivery") = 'integer' and "customer_addresses"."default_delivery" between 0 and 1))
);
--> statement-breakpoint
CREATE INDEX `customer_addresses_customer_id_idx` ON `customer_addresses` (`organization_id`,`customer_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `customer_addresses_organization_id_unique` ON `customer_addresses` (`organization_id`,`id`);--> statement-breakpoint
CREATE TABLE `customer_price_lists` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`price_list_id` text NOT NULL,
	`valid_from` integer NOT NULL,
	`valid_to` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE restrict ON DELETE restrict,
	FOREIGN KEY (`organization_id`,`customer_id`) REFERENCES `customers`(`organization_id`,`id`) ON UPDATE restrict ON DELETE restrict,
	FOREIGN KEY (`organization_id`,`price_list_id`) REFERENCES `price_lists`(`organization_id`,`id`) ON UPDATE restrict ON DELETE restrict,
	CONSTRAINT "customer_price_lists_valid_from_check" CHECK("customer_price_lists"."valid_from" is null or (typeof("customer_price_lists"."valid_from") = 'integer' and "customer_price_lists"."valid_from" between 0 and 9007199254740991)),
	CONSTRAINT "customer_price_lists_valid_to_check" CHECK("customer_price_lists"."valid_to" is null or (typeof("customer_price_lists"."valid_to") = 'integer' and "customer_price_lists"."valid_to" between 0 and 9007199254740991)),
	CONSTRAINT "customer_price_lists_effective_range_check" CHECK("customer_price_lists"."valid_to" is null or "customer_price_lists"."valid_to" > "customer_price_lists"."valid_from")
);
--> statement-breakpoint
CREATE INDEX `customer_price_lists_customer_id_valid_from_valid_to_idx` ON `customer_price_lists` (`organization_id`,`customer_id`,`valid_from`,`valid_to`);--> statement-breakpoint
CREATE UNIQUE INDEX `customer_price_lists_organization_id_unique` ON `customer_price_lists` (`organization_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `customer_price_lists_customer_id_valid_from_unique` ON `customer_price_lists` (`organization_id`,`customer_id`,`valid_from`);--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`code` text,
	`name` text NOT NULL,
	`email` text,
	`phone` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE restrict ON DELETE restrict,
	CONSTRAINT "customers_status_check" CHECK("customers"."status" in ('active', 'inactive'))
);
--> statement-breakpoint
CREATE INDEX `customers_status_idx` ON `customers` (`organization_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `customers_organization_id_unique` ON `customers` (`organization_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `customers_code_unique` ON `customers` (`organization_id`,`code`);--> statement-breakpoint
CREATE TABLE `inventory` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`product_id` text NOT NULL,
	`on_hand_milli` integer DEFAULT 0 NOT NULL,
	`reserved_milli` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE restrict ON DELETE restrict,
	FOREIGN KEY (`organization_id`,`product_id`) REFERENCES `products`(`organization_id`,`id`) ON UPDATE restrict ON DELETE restrict,
	CONSTRAINT "inventory_on_hand_milli_check" CHECK("inventory"."on_hand_milli" is null or (typeof("inventory"."on_hand_milli") = 'integer' and "inventory"."on_hand_milli" between 0 and 9007199254740991)),
	CONSTRAINT "inventory_reserved_milli_check" CHECK("inventory"."reserved_milli" is null or (typeof("inventory"."reserved_milli") = 'integer' and "inventory"."reserved_milli" between 0 and 9007199254740991)),
	CONSTRAINT "inventory_reserved_check" CHECK("inventory"."reserved_milli" <= "inventory"."on_hand_milli")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_organization_id_unique` ON `inventory` (`organization_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_product_id_unique` ON `inventory` (`organization_id`,`product_id`);--> statement-breakpoint
CREATE TABLE `inventory_adjustments` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`product_id` text NOT NULL,
	`delta_milli` integer NOT NULL,
	`reason` text NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text,
	`actor_user_id` text,
	`occurred_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE restrict ON DELETE restrict,
	FOREIGN KEY (`organization_id`,`product_id`) REFERENCES `products`(`organization_id`,`id`) ON UPDATE restrict ON DELETE restrict,
	CONSTRAINT "inventory_adjustments_delta_milli_check" CHECK("inventory_adjustments"."delta_milli" is null or (typeof("inventory_adjustments"."delta_milli") = 'integer' and "inventory_adjustments"."delta_milli" between -9007199254740991 and 9007199254740991)),
	CONSTRAINT "inventory_adjustments_occurred_at_check" CHECK("inventory_adjustments"."occurred_at" is null or (typeof("inventory_adjustments"."occurred_at") = 'integer' and "inventory_adjustments"."occurred_at" between 0 and 9007199254740991))
);
--> statement-breakpoint
CREATE INDEX `inventory_adjustments_product_id_occurred_at_idx` ON `inventory_adjustments` (`organization_id`,`product_id`,`occurred_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_adjustments_organization_id_unique` ON `inventory_adjustments` (`organization_id`,`id`);--> statement-breakpoint
CREATE TABLE `message_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`message_id` text NOT NULL,
	`provider_attachment_id` text,
	`file_name` text,
	`content_type` text NOT NULL,
	`size_bytes` integer,
	`r2_object_key` text,
	`provider_metadata` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE restrict ON DELETE restrict,
	FOREIGN KEY (`organization_id`,`message_id`) REFERENCES `messages`(`organization_id`,`id`) ON UPDATE restrict ON DELETE restrict,
	CONSTRAINT "message_attachments_size_bytes_check" CHECK("message_attachments"."size_bytes" is null or (typeof("message_attachments"."size_bytes") = 'integer' and "message_attachments"."size_bytes" between 0 and 9007199254740991)),
	CONSTRAINT "message_attachments_provider_metadata_json" CHECK(json_valid("message_attachments"."provider_metadata") or "message_attachments"."provider_metadata" is null)
);
--> statement-breakpoint
CREATE INDEX `message_attachments_message_id_idx` ON `message_attachments` (`organization_id`,`message_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `message_attachments_organization_id_unique` ON `message_attachments` (`organization_id`,`id`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`conversation_id` text NOT NULL,
	`direction` text NOT NULL,
	`provider_message_id` text,
	`message_type` text NOT NULL,
	`body` text,
	`provider_status` text,
	`delivery_status` text,
	`occurred_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE restrict ON DELETE restrict,
	FOREIGN KEY (`organization_id`,`conversation_id`) REFERENCES `conversations`(`organization_id`,`id`) ON UPDATE restrict ON DELETE restrict,
	CONSTRAINT "messages_direction_check" CHECK("messages"."direction" in ('inbound', 'outbound')),
	CONSTRAINT "messages_occurred_at_check" CHECK("messages"."occurred_at" is null or (typeof("messages"."occurred_at") = 'integer' and "messages"."occurred_at" between 0 and 9007199254740991))
);
--> statement-breakpoint
CREATE INDEX `messages_conversation_id_occurred_at_idx` ON `messages` (`organization_id`,`conversation_id`,`occurred_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `messages_organization_id_unique` ON `messages` (`organization_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `messages_provider_message_id_unique` ON `messages` (`organization_id`,`provider_message_id`);--> statement-breakpoint
CREATE TABLE `order_draft_items` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`draft_id` text NOT NULL,
	`position` integer NOT NULL,
	`ordered_text` text NOT NULL,
	`product_id` text,
	`quantity_milli` integer,
	`unit` text,
	`unit_price_minor` integer,
	`confidence_bps` integer,
	`match_method` text DEFAULT 'unmatched' NOT NULL,
	`requires_review` integer DEFAULT 1 NOT NULL,
	`review_reason` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE restrict ON DELETE restrict,
	FOREIGN KEY (`organization_id`,`draft_id`) REFERENCES `order_drafts`(`organization_id`,`id`) ON UPDATE restrict ON DELETE restrict,
	FOREIGN KEY (`organization_id`,`product_id`) REFERENCES `products`(`organization_id`,`id`) ON UPDATE restrict ON DELETE restrict,
	CONSTRAINT "order_draft_items_position_check" CHECK("order_draft_items"."position" is null or (typeof("order_draft_items"."position") = 'integer' and "order_draft_items"."position" between 0 and 9007199254740991)),
	CONSTRAINT "order_draft_items_quantity_milli_check" CHECK("order_draft_items"."quantity_milli" is null or (typeof("order_draft_items"."quantity_milli") = 'integer' and "order_draft_items"."quantity_milli" between 1 and 9007199254740991)),
	CONSTRAINT "order_draft_items_unit_price_minor_check" CHECK("order_draft_items"."unit_price_minor" is null or (typeof("order_draft_items"."unit_price_minor") = 'integer' and "order_draft_items"."unit_price_minor" between 0 and 9007199254740991)),
	CONSTRAINT "order_draft_items_confidence_bps_check" CHECK("order_draft_items"."confidence_bps" is null or (typeof("order_draft_items"."confidence_bps") = 'integer' and "order_draft_items"."confidence_bps" between 0 and 10000)),
	CONSTRAINT "order_draft_items_match_method_check" CHECK("order_draft_items"."match_method" in ('deterministic', 'ai', 'manual', 'unmatched')),
	CONSTRAINT "order_draft_items_requires_review_check" CHECK("order_draft_items"."requires_review" is null or (typeof("order_draft_items"."requires_review") = 'integer' and "order_draft_items"."requires_review" between 0 and 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `order_draft_items_organization_id_unique` ON `order_draft_items` (`organization_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `order_draft_items_draft_id_position_unique` ON `order_draft_items` (`organization_id`,`draft_id`,`position`);--> statement-breakpoint
CREATE TABLE `order_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`conversation_id` text,
	`customer_id` text,
	`source_text` text NOT NULL,
	`source_type` text NOT NULL,
	`status` text DEFAULT 'needs_review' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`creator_user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE restrict ON DELETE restrict,
	FOREIGN KEY (`organization_id`,`conversation_id`) REFERENCES `conversations`(`organization_id`,`id`) ON UPDATE restrict ON DELETE restrict,
	FOREIGN KEY (`organization_id`,`customer_id`) REFERENCES `customers`(`organization_id`,`id`) ON UPDATE restrict ON DELETE restrict,
	CONSTRAINT "order_drafts_status_check" CHECK("order_drafts"."status" in ('interpreting', 'needs_review', 'ready', 'confirmed', 'failed', 'discarded')),
	CONSTRAINT "order_drafts_version_check" CHECK("order_drafts"."version" is null or (typeof("order_drafts"."version") = 'integer' and "order_drafts"."version" between 1 and 9007199254740991))
);
--> statement-breakpoint
CREATE INDEX `order_drafts_status_updated_at_idx` ON `order_drafts` (`organization_id`,`status`,`updated_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `order_drafts_organization_id_unique` ON `order_drafts` (`organization_id`,`id`);--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`order_id` text NOT NULL,
	`position` integer NOT NULL,
	`product_id` text,
	`ordered_text` text NOT NULL,
	`sku_snapshot` text NOT NULL,
	`name_snapshot` text NOT NULL,
	`variant_snapshot` text,
	`quantity_milli` integer NOT NULL,
	`unit` text NOT NULL,
	`unit_price_minor` integer NOT NULL,
	`line_total_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`match_context` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE restrict ON DELETE restrict,
	FOREIGN KEY (`organization_id`,`order_id`) REFERENCES `orders`(`organization_id`,`id`) ON UPDATE restrict ON DELETE restrict,
	FOREIGN KEY (`organization_id`,`product_id`) REFERENCES `products`(`organization_id`,`id`) ON UPDATE restrict ON DELETE restrict,
	CONSTRAINT "order_items_position_check" CHECK("order_items"."position" is null or (typeof("order_items"."position") = 'integer' and "order_items"."position" between 0 and 9007199254740991)),
	CONSTRAINT "order_items_quantity_milli_check" CHECK("order_items"."quantity_milli" is null or (typeof("order_items"."quantity_milli") = 'integer' and "order_items"."quantity_milli" between 1 and 9007199254740991)),
	CONSTRAINT "order_items_unit_price_minor_check" CHECK("order_items"."unit_price_minor" is null or (typeof("order_items"."unit_price_minor") = 'integer' and "order_items"."unit_price_minor" between 0 and 9007199254740991)),
	CONSTRAINT "order_items_line_total_minor_check" CHECK("order_items"."line_total_minor" is null or (typeof("order_items"."line_total_minor") = 'integer' and "order_items"."line_total_minor" between 0 and 9007199254740991)),
	CONSTRAINT "order_items_currency_check" CHECK(length("order_items"."currency") = 3 and "order_items"."currency" not glob '*[^A-Z]*'),
	CONSTRAINT "order_items_match_context_json" CHECK(json_valid("order_items"."match_context") or "order_items"."match_context" is null)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `order_items_organization_id_unique` ON `order_items` (`organization_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `order_items_order_id_position_unique` ON `order_items` (`organization_id`,`order_id`,`position`);--> statement-breakpoint
CREATE TABLE `order_status_events` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`order_id` text NOT NULL,
	`from_status` text,
	`to_status` text NOT NULL,
	`actor_user_id` text,
	`reason` text,
	`note` text,
	`occurred_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE restrict ON DELETE restrict,
	FOREIGN KEY (`organization_id`,`order_id`) REFERENCES `orders`(`organization_id`,`id`) ON UPDATE restrict ON DELETE restrict,
	CONSTRAINT "order_status_events_from_status_check" CHECK("order_status_events"."from_status" in ('draft', 'needs_review', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled')),
	CONSTRAINT "order_status_events_to_status_check" CHECK("order_status_events"."to_status" in ('draft', 'needs_review', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled')),
	CONSTRAINT "order_status_events_occurred_at_check" CHECK("order_status_events"."occurred_at" is null or (typeof("order_status_events"."occurred_at") = 'integer' and "order_status_events"."occurred_at" between 0 and 9007199254740991))
);
--> statement-breakpoint
CREATE INDEX `order_status_events_order_id_occurred_at_idx` ON `order_status_events` (`organization_id`,`order_id`,`occurred_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `order_status_events_organization_id_unique` ON `order_status_events` (`organization_id`,`id`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`order_number` text NOT NULL,
	`customer_id` text NOT NULL,
	`source_draft_id` text,
	`conversation_id` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`currency` text NOT NULL,
	`fulfillment_notes` text,
	`subtotal_minor` integer NOT NULL,
	`total_minor` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`creator_user_id` text,
	`confirmer_user_id` text,
	`confirmed_at` integer,
	`cancellation_reason` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE restrict ON DELETE restrict,
	FOREIGN KEY (`organization_id`,`customer_id`) REFERENCES `customers`(`organization_id`,`id`) ON UPDATE restrict ON DELETE restrict,
	FOREIGN KEY (`organization_id`,`source_draft_id`) REFERENCES `order_drafts`(`organization_id`,`id`) ON UPDATE restrict ON DELETE restrict,
	FOREIGN KEY (`organization_id`,`conversation_id`) REFERENCES `conversations`(`organization_id`,`id`) ON UPDATE restrict ON DELETE restrict,
	CONSTRAINT "orders_status_check" CHECK("orders"."status" in ('draft', 'needs_review', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled')),
	CONSTRAINT "orders_currency_check" CHECK(length("orders"."currency") = 3 and "orders"."currency" not glob '*[^A-Z]*'),
	CONSTRAINT "orders_subtotal_minor_check" CHECK("orders"."subtotal_minor" is null or (typeof("orders"."subtotal_minor") = 'integer' and "orders"."subtotal_minor" between 0 and 9007199254740991)),
	CONSTRAINT "orders_total_minor_check" CHECK("orders"."total_minor" is null or (typeof("orders"."total_minor") = 'integer' and "orders"."total_minor" between 0 and 9007199254740991)),
	CONSTRAINT "orders_version_check" CHECK("orders"."version" is null or (typeof("orders"."version") = 'integer' and "orders"."version" between 1 and 9007199254740991)),
	CONSTRAINT "orders_confirmed_at_check" CHECK("orders"."confirmed_at" is null or (typeof("orders"."confirmed_at") = 'integer' and "orders"."confirmed_at" between 0 and 9007199254740991)),
	CONSTRAINT "orders_cancellation_reason_check" CHECK("orders"."status" <> 'cancelled' or length(trim("orders"."cancellation_reason")) > 0 and "orders"."cancellation_reason" is not null)
);
--> statement-breakpoint
CREATE INDEX `orders_status_created_at_idx` ON `orders` (`organization_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `orders_customer_id_created_at_idx` ON `orders` (`organization_id`,`customer_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_organization_id_unique` ON `orders` (`organization_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_order_number_unique` ON `orders` (`organization_id`,`order_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_source_draft_id_unique` ON `orders` (`organization_id`,`source_draft_id`);--> statement-breakpoint
CREATE TABLE `organization_members` (
	`organization_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`organization_id`, `user_id`),
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE restrict ON DELETE restrict,
	CONSTRAINT "organization_members_role_check" CHECK("organization_members"."role" in ('owner', 'admin', 'operator', 'picker')),
	CONSTRAINT "organization_members_status_check" CHECK("organization_members"."status" in ('active', 'invited'))
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "organizations_status_check" CHECK("organizations"."status" in ('active', 'suspended'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organizations_slug_unique` ON `organizations` (`slug`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`order_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`expected_minor` integer NOT NULL,
	`received_minor` integer DEFAULT 0 NOT NULL,
	`currency` text NOT NULL,
	`due_date` text,
	`paid_at` integer,
	`actor_user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE restrict ON DELETE restrict,
	FOREIGN KEY (`organization_id`,`order_id`) REFERENCES `orders`(`organization_id`,`id`) ON UPDATE restrict ON DELETE restrict,
	CONSTRAINT "payments_status_check" CHECK("payments"."status" in ('pending', 'partial', 'paid', 'overdue', 'void')),
	CONSTRAINT "payments_expected_minor_check" CHECK("payments"."expected_minor" is null or (typeof("payments"."expected_minor") = 'integer' and "payments"."expected_minor" between 0 and 9007199254740991)),
	CONSTRAINT "payments_received_minor_check" CHECK("payments"."received_minor" is null or (typeof("payments"."received_minor") = 'integer' and "payments"."received_minor" between 0 and 9007199254740991)),
	CONSTRAINT "payments_currency_check" CHECK(length("payments"."currency") = 3 and "payments"."currency" not glob '*[^A-Z]*'),
	CONSTRAINT "payments_paid_at_check" CHECK("payments"."paid_at" is null or (typeof("payments"."paid_at") = 'integer' and "payments"."paid_at" between 0 and 9007199254740991))
);
--> statement-breakpoint
CREATE INDEX `payments_order_id_status_due_date_idx` ON `payments` (`organization_id`,`order_id`,`status`,`due_date`);--> statement-breakpoint
CREATE INDEX `payments_status_due_date_idx` ON `payments` (`organization_id`,`status`,`due_date`);--> statement-breakpoint
CREATE UNIQUE INDEX `payments_organization_id_unique` ON `payments` (`organization_id`,`id`);--> statement-breakpoint
CREATE TABLE `price_list_items` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`price_list_id` text NOT NULL,
	`product_id` text NOT NULL,
	`unit_price_minor` integer NOT NULL,
	`valid_from` integer NOT NULL,
	`valid_to` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE restrict ON DELETE restrict,
	FOREIGN KEY (`organization_id`,`price_list_id`) REFERENCES `price_lists`(`organization_id`,`id`) ON UPDATE restrict ON DELETE restrict,
	FOREIGN KEY (`organization_id`,`product_id`) REFERENCES `products`(`organization_id`,`id`) ON UPDATE restrict ON DELETE restrict,
	CONSTRAINT "price_list_items_unit_price_minor_check" CHECK("price_list_items"."unit_price_minor" is null or (typeof("price_list_items"."unit_price_minor") = 'integer' and "price_list_items"."unit_price_minor" between 0 and 9007199254740991)),
	CONSTRAINT "price_list_items_valid_from_check" CHECK("price_list_items"."valid_from" is null or (typeof("price_list_items"."valid_from") = 'integer' and "price_list_items"."valid_from" between 0 and 9007199254740991)),
	CONSTRAINT "price_list_items_valid_to_check" CHECK("price_list_items"."valid_to" is null or (typeof("price_list_items"."valid_to") = 'integer' and "price_list_items"."valid_to" between 0 and 9007199254740991)),
	CONSTRAINT "price_list_items_effective_range_check" CHECK("price_list_items"."valid_to" is null or "price_list_items"."valid_to" > "price_list_items"."valid_from")
);
--> statement-breakpoint
CREATE INDEX `price_list_items_price_list_id_product_id_valid_from_valid_to_idx` ON `price_list_items` (`organization_id`,`price_list_id`,`product_id`,`valid_from`,`valid_to`);--> statement-breakpoint
CREATE UNIQUE INDEX `price_list_items_organization_id_unique` ON `price_list_items` (`organization_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `price_list_items_price_list_id_product_id_valid_from_unique` ON `price_list_items` (`organization_id`,`price_list_id`,`product_id`,`valid_from`);--> statement-breakpoint
CREATE TABLE `price_lists` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`currency` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE restrict ON DELETE restrict,
	CONSTRAINT "price_lists_currency_check" CHECK(length("price_lists"."currency") = 3 and "price_lists"."currency" not glob '*[^A-Z]*'),
	CONSTRAINT "price_lists_active_check" CHECK("price_lists"."active" is null or (typeof("price_lists"."active") = 'integer' and "price_lists"."active" between 0 and 1))
);
--> statement-breakpoint
CREATE INDEX `price_lists_active_idx` ON `price_lists` (`organization_id`,`active`);--> statement-breakpoint
CREATE UNIQUE INDEX `price_lists_organization_id_unique` ON `price_lists` (`organization_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `price_lists_name_unique` ON `price_lists` (`organization_id`,`name`);--> statement-breakpoint
CREATE TABLE `product_aliases` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`product_id` text NOT NULL,
	`alias` text NOT NULL,
	`normalized_alias` text NOT NULL,
	`source` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE restrict ON DELETE restrict,
	FOREIGN KEY (`organization_id`,`product_id`) REFERENCES `products`(`organization_id`,`id`) ON UPDATE restrict ON DELETE restrict,
	CONSTRAINT "product_aliases_source_check" CHECK("product_aliases"."source" in ('manual', 'import', 'correction'))
);
--> statement-breakpoint
CREATE INDEX `product_aliases_normalized_alias_idx` ON `product_aliases` (`organization_id`,`normalized_alias`);--> statement-breakpoint
CREATE UNIQUE INDEX `product_aliases_organization_id_unique` ON `product_aliases` (`organization_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `product_aliases_product_id_normalized_alias_unique` ON `product_aliases` (`organization_id`,`product_id`,`normalized_alias`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`sku` text NOT NULL,
	`name` text NOT NULL,
	`variant` text,
	`order_unit` text NOT NULL,
	`unit_quantity_milli` integer,
	`unit_measure` text,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE restrict ON DELETE restrict,
	CONSTRAINT "products_unit_quantity_milli_check" CHECK("products"."unit_quantity_milli" is null or (typeof("products"."unit_quantity_milli") = 'integer' and "products"."unit_quantity_milli" between 1 and 9007199254740991)),
	CONSTRAINT "products_active_check" CHECK("products"."active" is null or (typeof("products"."active") = 'integer' and "products"."active" between 0 and 1))
);
--> statement-breakpoint
CREATE INDEX `products_active_idx` ON `products` (`organization_id`,`active`);--> statement-breakpoint
CREATE UNIQUE INDEX `products_organization_id_unique` ON `products` (`organization_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `products_sku_unique` ON `products` (`organization_id`,`sku`);