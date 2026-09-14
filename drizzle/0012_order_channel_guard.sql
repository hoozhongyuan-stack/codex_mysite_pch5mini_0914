CREATE TRIGGER IF NOT EXISTS order_item_channel_guard BEFORE INSERT ON order_items BEGIN
 SELECT CASE WHEN NOT EXISTS (
 SELECT 1 FROM orders o JOIN contents c ON c.id=NEW.product_id WHERE o.id=NEW.order_id AND c.status='published'
 AND ((json_extract(o.data,'$.sourceEnd')='mini' AND json_extract(c.data,'$.channels.mini')=1)
 OR (COALESCE(json_extract(o.data,'$.sourceEnd'),'web')<>'mini' AND COALESCE(json_extract(c.data,'$.channels.website'),1)=1))
 ) THEN RAISE(ABORT,'商品展示渠道已变化，请重新结算') END;
END;
