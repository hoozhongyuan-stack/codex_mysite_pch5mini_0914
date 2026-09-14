-- Existing shared-stock records retain their mode until explicitly configured.
CREATE TRIGGER variant_item_stock BEFORE INSERT ON order_items
WHEN EXISTS(SELECT 1 FROM contents WHERE id=NEW.product_id AND json_extract(data,'$.trade.inventoryMode')='variants') BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM contents c,json_each(c.data,'$.trade.variants') v
 WHERE c.id=NEW.product_id AND json_extract(v.value,'$.key')=NEW.variant
 AND json_type(v.value,'$.inventory')='integer' AND json_extract(v.value,'$.inventory')>=NEW.quantity+COALESCE((SELECT SUM(i.quantity) FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.product_id=NEW.product_id AND i.variant=NEW.variant AND o.paid=0 AND o.status IN ('building','pending_payment','pending_review')),0)) THEN RAISE(ABORT,'所选规格库存不足，请重新结算') END;
END;
--> statement-breakpoint
CREATE TRIGGER variant_stock_edit_guard BEFORE UPDATE OF data ON contents
WHEN NEW.kind='products' BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.product_id=NEW.id AND o.paid=0 AND o.status IN ('building','pending_payment','pending_review') AND
 (json_extract(NEW.data,'$.trade.inventoryMode')='variants' OR json_extract(OLD.data,'$.trade.inventoryMode')='variants') AND
 (json_extract(NEW.data,'$.trade.inventoryMode') IS NOT 'variants' OR NOT EXISTS(SELECT 1 FROM json_each(NEW.data,'$.trade.variants') v WHERE json_extract(v.value,'$.key')=i.variant AND json_type(v.value,'$.inventory')='integer' AND json_extract(v.value,'$.inventory')>=(SELECT SUM(j.quantity) FROM order_items j JOIN orders r ON r.id=j.order_id WHERE j.product_id=NEW.id AND j.variant=i.variant AND r.paid=0 AND r.status IN ('building','pending_payment','pending_review'))))) THEN RAISE(ABORT,'规格库存不能低于已占用数量，也不能删除占用中的规格') END;
END;
--> statement-breakpoint
CREATE TRIGGER variant_order_deduct AFTER UPDATE OF paid ON orders WHEN OLD.paid=0 AND NEW.paid=1 BEGIN
 UPDATE contents SET data=json_set(data,'$.trade.variants',json((SELECT json_group_array(json(CASE WHEN json_type(v.value,'$.inventory')='integer' THEN json_set(v.value,'$.inventory',json_extract(v.value,'$.inventory')-COALESCE((SELECT SUM(i.quantity) FROM order_items i WHERE i.order_id=NEW.id AND i.product_id=contents.id AND i.variant=json_extract(v.value,'$.key')),0)) ELSE v.value END)) FROM json_each(contents.data,'$.trade.variants') v))) WHERE json_extract(data,'$.trade.inventoryMode')='variants' AND id IN(SELECT product_id FROM order_items WHERE order_id=NEW.id);
END;
--> statement-breakpoint
CREATE TRIGGER variant_order_restock AFTER UPDATE OF restocked ON orders WHEN OLD.restocked=0 AND NEW.restocked=1 BEGIN
 UPDATE contents SET data=json_set(data,'$.trade.variants',json((SELECT json_group_array(json(CASE WHEN json_type(v.value,'$.inventory')='integer' THEN json_set(v.value,'$.inventory',json_extract(v.value,'$.inventory')+COALESCE((SELECT SUM(i.quantity) FROM order_items i WHERE i.order_id=NEW.id AND i.product_id=contents.id AND i.variant=json_extract(v.value,'$.key')),0)) ELSE v.value END)) FROM json_each(contents.data,'$.trade.variants') v))) WHERE json_extract(data,'$.trade.inventoryMode')='variants' AND id IN(SELECT product_id FROM order_items WHERE order_id=NEW.id);
END;
--> statement-breakpoint
-- Preserve SKU identity for paid orders that may still be returned to stock.
CREATE TRIGGER variant_paid_reference_guard BEFORE UPDATE OF data ON contents
WHEN json_extract(OLD.data,'$.trade.inventoryMode')='variants' BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.product_id=NEW.id AND o.paid=1 AND o.restocked=0 AND (json_extract(NEW.data,'$.trade.inventoryMode') IS NOT 'variants' OR NOT EXISTS(SELECT 1 FROM json_each(NEW.data,'$.trade.variants') v WHERE json_extract(v.value,'$.key')=i.variant AND json_type(v.value,'$.inventory')='integer'))) THEN RAISE(ABORT,'规格关联已付款订单，请保留规格及库存；不再销售可停用') END;
END;
