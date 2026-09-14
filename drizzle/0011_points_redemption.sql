DROP TRIGGER order_item_validate;
--> statement-breakpoint
CREATE TRIGGER order_item_validate BEFORE INSERT ON order_items BEGIN
 SELECT CASE WHEN NEW.quantity<1 OR NEW.quantity>999 OR NEW.unit_price<0 OR NOT EXISTS(
 SELECT 1 FROM orders o JOIN contents c ON c.id=NEW.product_id JOIN json_each(c.data,'$.trade.variants') v
 WHERE o.id=NEW.order_id AND o.status='building' AND c.kind='products' AND c.status='published'
 AND (json_extract(c.data,'$.trade.currency')=o.currency OR (o.currency='PTS' AND json_extract(o.data,'$.orderType')='points'))
 AND json_extract(v.value,'$.key')=NEW.variant AND json_extract(v.value,'$.enabled')=1
 AND ((o.currency<>'PTS' AND json_extract(v.value,'$.priceMinor')=NEW.unit_price) OR (o.currency='PTS' AND json_extract(c.data,'$.trade.redemptionEnabled')=1 AND json_extract(v.value,'$.pointsPrice')=NEW.unit_price AND NEW.unit_price>0
 AND json_extract(c.data,'$.trade.redemptionQuota')>=NEW.quantity+COALESCE((SELECT SUM(i.quantity) FROM order_items i JOIN orders r ON r.id=i.order_id WHERE i.product_id=c.id AND r.currency='PTS' AND r.status<>'closed'),0)
 AND (COALESCE(json_extract(c.data,'$.trade.redemptionLimit'),0)=0 OR json_extract(c.data,'$.trade.redemptionLimit')>=NEW.quantity+COALESCE((SELECT SUM(i.quantity) FROM order_items i JOIN orders r ON r.id=i.order_id WHERE i.product_id=c.id AND r.currency='PTS' AND r.status<>'closed' AND r.user_id=o.user_id),0))))
 AND json_type(c.data,'$.trade.inventory')='integer'
 AND json_extract(c.data,'$.trade.inventory')>=NEW.quantity+COALESCE((SELECT SUM(i.quantity) FROM order_items i JOIN orders r ON r.id=i.order_id WHERE i.product_id=c.id AND r.paid=0 AND r.status IN ('building','pending_payment','pending_review')),0)
 ) THEN RAISE(ABORT,'商品价格或库存已变化，请重新结算') END;
END;
