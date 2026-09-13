-- Custom Drizzle migration: SQLite triggers are not represented by Drizzle tables.
CREATE TRIGGER audit_events_no_update BEFORE UPDATE ON audit_events BEGIN SELECT RAISE(ABORT, 'audit_events are append-only'); END;
--> statement-breakpoint
CREATE TRIGGER audit_events_no_delete BEFORE DELETE ON audit_events BEGIN SELECT RAISE(ABORT, 'audit_events are append-only'); END;
--> statement-breakpoint
CREATE TRIGGER order_status_events_no_update BEFORE UPDATE ON order_status_events BEGIN SELECT RAISE(ABORT, 'order_status_events are append-only'); END;
--> statement-breakpoint
CREATE TRIGGER order_status_events_no_delete BEFORE DELETE ON order_status_events BEGIN SELECT RAISE(ABORT, 'order_status_events are append-only'); END;
--> statement-breakpoint
CREATE TRIGGER inventory_adjustments_no_update BEFORE UPDATE ON inventory_adjustments BEGIN SELECT RAISE(ABORT, 'inventory_adjustments are append-only'); END;
--> statement-breakpoint
CREATE TRIGGER inventory_adjustments_no_delete BEFORE DELETE ON inventory_adjustments BEGIN SELECT RAISE(ABORT, 'inventory_adjustments are append-only'); END;
--> statement-breakpoint
CREATE TRIGGER confirmed_items_no_update BEFORE UPDATE ON order_items
WHEN EXISTS (SELECT 1 FROM orders WHERE organization_id = OLD.organization_id AND id = OLD.order_id AND confirmed_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT, 'confirmed item snapshots are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER confirmed_items_no_delete BEFORE DELETE ON order_items
WHEN EXISTS (SELECT 1 FROM orders WHERE organization_id = OLD.organization_id AND id = OLD.order_id AND confirmed_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT, 'confirmed item snapshots are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER confirmed_order_prices_no_update BEFORE UPDATE OF subtotal_minor, total_minor, currency, confirmed_at ON orders
WHEN OLD.confirmed_at IS NOT NULL AND
(NEW.subtotal_minor IS NOT OLD.subtotal_minor OR NEW.total_minor IS NOT OLD.total_minor OR NEW.currency IS NOT OLD.currency OR NEW.confirmed_at IS NOT OLD.confirmed_at)
BEGIN SELECT RAISE(ABORT, 'confirmed order prices are immutable'); END;
