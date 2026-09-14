CREATE TABLE `cart_items` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`product_id` text NOT NULL,
	`variant` text NOT NULL,
	`quantity` integer NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `contents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cart_user_variant` ON `cart_items` (`user_id`,`product_id`,`variant`);--> statement-breakpoint
CREATE TABLE `order_addresses` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`data` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `order_files` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`user_id` text NOT NULL,
	`purpose` text NOT NULL,
	`mime` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `order_history` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`data` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`product_id` text NOT NULL,
	`variant` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price` integer NOT NULL,
	`snapshot` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `contents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `order_item_variant` ON `order_items` (`order_id`,`product_id`,`variant`);--> statement-breakpoint
CREATE INDEX `order_items_product` ON `order_items` (`product_id`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`request_key` text NOT NULL,
	`status` text NOT NULL,
	`currency` text NOT NULL,
	`subtotal` integer NOT NULL,
	`shipping` integer NOT NULL,
	`total` integer NOT NULL,
	`data` text NOT NULL,
	`sandbox` integer DEFAULT 0 NOT NULL,
	`paid` integer DEFAULT 0 NOT NULL,
	`refunded` integer DEFAULT 0 NOT NULL,
	`restocked` integer DEFAULT 0 NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_request` ON `orders` (`user_id`,`request_key`);--> statement-breakpoint
CREATE INDEX `orders_user_created` ON `orders` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `orders_status_expires` ON `orders` (`status`,`expires_at`);--> statement-breakpoint
CREATE TRIGGER order_item_validate BEFORE INSERT ON order_items BEGIN
 SELECT CASE WHEN NEW.quantity<1 OR NEW.quantity>999 OR NEW.unit_price<0 OR NOT EXISTS(
 SELECT 1 FROM orders o JOIN contents c ON c.id=NEW.product_id JOIN json_each(c.data,'$.trade.variants') v
 WHERE o.id=NEW.order_id AND o.status='building' AND c.kind='products' AND c.status='published'
 AND json_extract(c.data,'$.trade.currency')=o.currency
 AND json_extract(v.value,'$.key')=NEW.variant AND json_extract(v.value,'$.enabled')=1
 AND json_extract(v.value,'$.priceMinor')=NEW.unit_price
 AND json_type(c.data,'$.trade.inventory')='integer'
 AND json_extract(c.data,'$.trade.inventory')>=NEW.quantity+COALESCE((SELECT SUM(i.quantity) FROM order_items i JOIN orders r ON r.id=i.order_id WHERE i.product_id=c.id AND r.paid=0 AND r.status IN ('building','pending_payment','pending_review')),0)
 ) THEN RAISE(ABORT,'商品价格或库存已变化，请重新结算') END;
END;
--> statement-breakpoint
CREATE TRIGGER order_finalize BEFORE UPDATE OF status ON orders WHEN OLD.status='building' BEGIN
 SELECT CASE WHEN NEW.status<>'pending_payment' OR NOT EXISTS(SELECT 1 FROM order_items WHERE order_id=NEW.id) OR NEW.subtotal<>(SELECT SUM(quantity*unit_price) FROM order_items WHERE order_id=NEW.id) OR NEW.total<>NEW.subtotal+NEW.shipping OR NEW.shipping<0 THEN RAISE(ABORT,'订单金额无效') END;
END;
--> statement-breakpoint
CREATE TRIGGER order_item_immutable BEFORE UPDATE ON order_items BEGIN SELECT RAISE(ABORT,'订单快照不可修改'); END;
--> statement-breakpoint
CREATE TRIGGER order_item_keep BEFORE DELETE ON order_items BEGIN SELECT RAISE(ABORT,'订单快照不可删除'); END;
--> statement-breakpoint
CREATE TRIGGER order_status_guard BEFORE UPDATE OF status ON orders WHEN OLD.status<>'building' AND NEW.status<>OLD.status BEGIN
 SELECT CASE WHEN NOT (
 (OLD.status='pending_payment' AND NEW.status IN ('pending_review','closed')) OR
 (OLD.status='pending_review' AND NEW.status IN ('pending_payment','pending_ship','closed')) OR
 (OLD.status='pending_ship' AND NEW.status IN ('pending_receive','aftersale')) OR
 (OLD.status='pending_receive' AND NEW.status IN ('completed','aftersale')) OR
 (OLD.status='completed' AND NEW.status='aftersale') OR
 (OLD.status='aftersale' AND NEW.status IN ('pending_ship','pending_receive','completed','closed'))
 ) THEN RAISE(ABORT,'订单状态已变化') END;
END;
--> statement-breakpoint
CREATE TRIGGER order_paid_guard BEFORE UPDATE OF paid ON orders WHEN OLD.paid<>NEW.paid BEGIN
 SELECT CASE WHEN OLD.paid<>0 OR NEW.paid<>1 OR OLD.status<>'pending_review' OR NEW.status<>'pending_ship' THEN RAISE(ABORT,'收款状态无效') END;
END;
--> statement-breakpoint
CREATE TRIGGER order_deduct AFTER UPDATE OF paid ON orders WHEN OLD.paid=0 AND NEW.paid=1 BEGIN
 UPDATE contents SET data=json_set(data,'$.trade.inventory',json_extract(data,'$.trade.inventory')-(SELECT SUM(quantity) FROM order_items WHERE order_id=NEW.id AND product_id=contents.id)),updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id IN(SELECT product_id FROM order_items WHERE order_id=NEW.id);
END;
--> statement-breakpoint
CREATE TRIGGER order_stock_guard BEFORE UPDATE OF data ON contents WHEN NEW.kind='products' AND EXISTS(SELECT 1 FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.product_id=NEW.id AND o.paid=0 AND o.status IN ('building','pending_payment','pending_review')) BEGIN
 SELECT CASE WHEN json_type(NEW.data,'$.trade.inventory')<>'integer' OR json_extract(NEW.data,'$.trade.inventory') IS NULL OR json_extract(NEW.data,'$.trade.inventory')<(SELECT COALESCE(SUM(i.quantity),0) FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.product_id=NEW.id AND o.paid=0 AND o.status IN ('building','pending_payment','pending_review')) THEN RAISE(ABORT,'库存不能低于已锁定数量') END;
END;
--> statement-breakpoint
CREATE TRIGGER order_restock_guard BEFORE UPDATE OF restocked ON orders WHEN NEW.restocked<>OLD.restocked BEGIN
 SELECT CASE WHEN OLD.restocked<>0 OR NEW.restocked<>1 OR NEW.refunded<>1 OR NEW.status<>'closed' THEN RAISE(ABORT,'库存不可重复返还') END;
END;
--> statement-breakpoint
CREATE TRIGGER order_restock AFTER UPDATE OF restocked ON orders WHEN OLD.restocked=0 AND NEW.restocked=1 BEGIN
 UPDATE contents SET data=json_set(data,'$.trade.inventory',COALESCE(json_extract(data,'$.trade.inventory'),0)+(SELECT SUM(quantity) FROM order_items WHERE order_id=NEW.id AND product_id=contents.id)),updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id IN(SELECT product_id FROM order_items WHERE order_id=NEW.id);
END;
--> statement-breakpoint
CREATE TRIGGER order_stock_revision BEFORE UPDATE OF data ON contents WHEN NEW.kind='products' AND json_extract(NEW.data,'$._expectedStockVersion') IS NOT json_extract(OLD.data,'$._expectedStockVersion') BEGIN
 SELECT CASE WHEN json_extract(NEW.data,'$._expectedStockVersion')<>OLD.updated_at THEN RAISE(ABORT,'商品库存已更新，请刷新后编辑') END;
END;
--> statement-breakpoint
CREATE TRIGGER order_payment_asset_keep BEFORE DELETE ON assets WHEN EXISTS(SELECT 1 FROM orders o,json_each(o.data,'$.methods') m WHERE json_extract(m.value,'$.imageId')=OLD.id) OR EXISTS(SELECT 1 FROM settings s,json_each(s.data,'$.methods') m WHERE s.id='commerce' AND json_extract(m.value,'$.imageId')=OLD.id) BEGIN SELECT RAISE(ABORT,'收款图片仍被交易配置或历史订单引用'); END;
