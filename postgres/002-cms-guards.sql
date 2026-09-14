-- Native PostgreSQL equivalents of the active guards through drizzle/0013.
CREATE FUNCTION cms_json_array(value jsonb) RETURNS SETOF jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_array_elements(CASE WHEN jsonb_typeof(value)='array' THEN value ELSE '[]'::jsonb END)
$$;
CREATE FUNCTION cms_json_integer(value jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
 SELECT COALESCE(jsonb_typeof(value)='number' AND value::text ~ '^-?[0-9]+$',false)
$$;
CREATE FUNCTION cms_json_number(value jsonb) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
 SELECT CASE WHEN jsonb_typeof(value)='number' THEN (value::text)::numeric ELSE NULL END
$$;
CREATE FUNCTION cms_json_flag(value jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
 SELECT COALESCE(value IN ('true'::jsonb,'1'::jsonb),false)
$$;
CREATE FUNCTION cms_write_lock() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 -- Retain SQLite's serialized writer semantics for the initial UAT migration.
 -- Transaction-scoped, same key for every CMS mutation; no session lock leaks.
 PERFORM pg_advisory_xact_lock(194870315,1);
 RETURN NULL;
END $$;
DO $$ DECLARE relation text; BEGIN
 FOREACH relation IN ARRAY ARRAY['assets','contents','evidence','rates','settings','submissions','visits','admin_memberships','audit_logs','categories','content_assets','asset_folders_map','asset_folders','navigation_items','policies','submission_files','submission_history','submission_workflows','marketing_assets','cart_items','order_addresses','order_files','order_history','order_items','orders','order_counters'] LOOP
  EXECUTE format('CREATE TRIGGER cms_00_write_lock BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH STATEMENT EXECUTE FUNCTION cms_write_lock()',relation);
 END LOOP;
END $$;

CREATE FUNCTION cms_category_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  IF EXISTS(SELECT 1 FROM categories WHERE parent_id=OLD.id) OR EXISTS(SELECT 1 FROM contents WHERE data::jsonb->>'categoryId'=OLD.id) OR EXISTS(SELECT 1 FROM navigation_items WHERE data::jsonb->>'targetId'=OLD.id) THEN RAISE EXCEPTION 'Category is referenced'; END IF;
  RETURN OLD;
 END IF;
 IF NEW.kind NOT IN ('articles','products') OR (TG_OP='UPDATE' AND NEW.kind<>OLD.kind) OR (NEW.parent_id IS NOT NULL AND (NEW.parent_id=NEW.id OR NOT EXISTS(SELECT 1 FROM categories WHERE id=NEW.parent_id AND kind=NEW.kind AND parent_id IS NULL) OR EXISTS(SELECT 1 FROM categories WHERE parent_id=NEW.id))) THEN RAISE EXCEPTION 'Invalid category hierarchy'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER category_insert_guard BEFORE INSERT ON categories FOR EACH ROW EXECUTE FUNCTION cms_category_guard();
CREATE TRIGGER category_update_guard BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION cms_category_guard();
CREATE TRIGGER category_delete_guard BEFORE DELETE ON categories FOR EACH ROW EXECUTE FUNCTION cms_category_guard();

CREATE FUNCTION cms_asset_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='content_assets' THEN
  IF NOT EXISTS(SELECT 1 FROM assets WHERE id=NEW.asset_id) THEN RAISE EXCEPTION '素材不存在'; END IF;
 ELSIF TG_TABLE_NAME='asset_folders_map' THEN
  IF NOT EXISTS(SELECT 1 FROM assets WHERE id=NEW.asset_id) OR NOT EXISTS(SELECT 1 FROM asset_folders WHERE id=NEW.folder_id) THEN RAISE EXCEPTION '素材或文件夹不存在'; END IF;
 ELSIF TG_TABLE_NAME='settings' THEN
  IF (COALESCE(NEW.data::jsonb#>>'{footer,logoId}','')<>'' AND NOT EXISTS(SELECT 1 FROM assets WHERE id=NEW.data::jsonb#>>'{footer,logoId}')) OR EXISTS(SELECT 1 FROM cms_json_array(NEW.data::jsonb#>'{footer,socials}') s WHERE COALESCE(s->>'imageId','')<>'' AND NOT EXISTS(SELECT 1 FROM assets WHERE id=s->>'imageId')) THEN RAISE EXCEPTION '页脚图片不存在'; END IF;
 ELSE
  IF EXISTS(SELECT 1 FROM content_assets WHERE asset_id=OLD.id) OR EXISTS(SELECT 1 FROM contents WHERE data::jsonb->>'imageId'=OLD.id OR EXISTS(SELECT 1 FROM cms_json_array(data::jsonb->'imageIds') v WHERE v#>>'{}'=OLD.id)) OR EXISTS(SELECT 1 FROM settings WHERE data::jsonb#>>'{footer,logoId}'=OLD.id OR EXISTS(SELECT 1 FROM cms_json_array(data::jsonb#>'{footer,socials}') v WHERE v->>'imageId'=OLD.id)) THEN RAISE EXCEPTION '素材仍被引用'; END IF;
  RETURN OLD;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_content_asset_insert BEFORE INSERT ON content_assets FOR EACH ROW EXECUTE FUNCTION cms_asset_guard();
CREATE TRIGGER guard_asset_delete BEFORE DELETE ON assets FOR EACH ROW EXECUTE FUNCTION cms_asset_guard();
CREATE TRIGGER guard_asset_folder_insert BEFORE INSERT ON asset_folders_map FOR EACH ROW EXECUTE FUNCTION cms_asset_guard();
CREATE TRIGGER guard_asset_folder_update BEFORE UPDATE ON asset_folders_map FOR EACH ROW EXECUTE FUNCTION cms_asset_guard();
CREATE TRIGGER guard_footer_insert BEFORE INSERT ON settings FOR EACH ROW EXECUTE FUNCTION cms_asset_guard();
CREATE TRIGGER guard_footer_update BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION cms_asset_guard();

CREATE FUNCTION cms_brand_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE key text; asset text;
BEGIN
 IF TG_OP='DELETE' THEN
  IF EXISTS(SELECT 1 FROM settings WHERE data::jsonb#>>'{brand,logoId}'=OLD.id OR data::jsonb#>>'{brand,faviconId}'=OLD.id) THEN RAISE EXCEPTION '素材正在被品牌与图标引用'; END IF;
  RETURN OLD;
 END IF;
 FOREACH key IN ARRAY ARRAY['logoId','faviconId'] LOOP
  asset:=NEW.data::jsonb->'brand'->>key;
  IF COALESCE(asset,'')<>'' AND NOT EXISTS(SELECT 1 FROM assets WHERE id=asset) THEN RAISE EXCEPTION '品牌素材不存在'; END IF;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_brand_asset_delete BEFORE DELETE ON assets FOR EACH ROW EXECUTE FUNCTION cms_brand_guard();
CREATE TRIGGER guard_brand_settings_insert BEFORE INSERT ON settings FOR EACH ROW EXECUTE FUNCTION cms_brand_guard();
CREATE TRIGGER guard_brand_settings_update BEFORE UPDATE OF data ON settings FOR EACH ROW EXECUTE FUNCTION cms_brand_guard();

CREATE FUNCTION cms_payment_asset_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM orders o CROSS JOIN LATERAL cms_json_array(o.data::jsonb->'methods') m WHERE m->>'imageId'=OLD.id) OR EXISTS(SELECT 1 FROM settings s CROSS JOIN LATERAL cms_json_array(s.data::jsonb->'methods') m WHERE s.id='commerce' AND m->>'imageId'=OLD.id) THEN RAISE EXCEPTION '收款图片仍被交易配置或历史订单引用'; END IF;
 RETURN OLD;
END $$;
CREATE TRIGGER order_payment_asset_keep BEFORE DELETE ON assets FOR EACH ROW EXECUTE FUNCTION cms_payment_asset_guard();

CREATE FUNCTION cms_order_item_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE purchase orders%ROWTYPE; product contents%ROWTYPE; variant jsonb; reserved numeric; used_quota numeric; used_person numeric; trade jsonb;
BEGIN
 SELECT * INTO purchase FROM orders WHERE id=NEW.order_id;
 SELECT * INTO product FROM contents WHERE id=NEW.product_id FOR UPDATE;
 trade:=product.data::jsonb->'trade';
 SELECT v INTO variant FROM cms_json_array(trade->'variants') v WHERE v->>'key'=NEW.variant AND cms_json_flag(v->'enabled') LIMIT 1;
 SELECT COALESCE(SUM(i.quantity),0) INTO reserved FROM order_items i JOIN orders r ON r.id=i.order_id WHERE i.product_id=NEW.product_id AND r.paid=0 AND r.status IN ('building','pending_payment','pending_review');
 IF NEW.quantity<1 OR NEW.quantity>999 OR NEW.unit_price<0 OR purchase.id IS NULL OR purchase.status<>'building' OR product.kind<>'products' OR product.status<>'published' OR variant IS NULL OR NOT cms_json_integer(trade->'inventory') OR cms_json_number(trade->'inventory')<NEW.quantity+reserved THEN RAISE EXCEPTION '商品价格或库存已变化，请重新结算'; END IF;
 IF purchase.currency='PTS' THEN
  SELECT COALESCE(SUM(i.quantity),0), COALESCE(SUM(i.quantity) FILTER(WHERE r.user_id=purchase.user_id),0) INTO used_quota,used_person FROM order_items i JOIN orders r ON r.id=i.order_id WHERE i.product_id=NEW.product_id AND r.currency='PTS' AND r.status<>'closed';
  IF (purchase.data::jsonb->>'orderType') IS DISTINCT FROM 'points' OR NOT cms_json_flag(trade->'redemptionEnabled') OR cms_json_number(variant->'pointsPrice') IS DISTINCT FROM NEW.unit_price::numeric OR NEW.unit_price<=0 OR COALESCE(cms_json_number(trade->'redemptionQuota'),0)<NEW.quantity+used_quota OR (COALESCE(cms_json_number(trade->'redemptionLimit'),0)<>0 AND cms_json_number(trade->'redemptionLimit')<NEW.quantity+used_person) THEN RAISE EXCEPTION '商品价格或库存已变化，请重新结算'; END IF;
 ELSE
  IF (trade->>'currency') IS DISTINCT FROM purchase.currency OR cms_json_number(variant->'priceMinor') IS DISTINCT FROM NEW.unit_price::numeric THEN RAISE EXCEPTION '商品价格或库存已变化，请重新结算'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER order_item_validate BEFORE INSERT ON order_items FOR EACH ROW EXECUTE FUNCTION cms_order_item_guard();

CREATE FUNCTION cms_order_channel_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM orders o JOIN contents c ON c.id=NEW.product_id WHERE o.id=NEW.order_id AND c.status='published' AND ((o.data::jsonb->>'sourceEnd'='mini' AND cms_json_flag(c.data::jsonb#>'{channels,mini}')) OR (COALESCE(o.data::jsonb->>'sourceEnd','web')<>'mini' AND cms_json_flag(COALESCE(c.data::jsonb#>'{channels,website}','true'::jsonb))))) THEN RAISE EXCEPTION '商品展示渠道已变化，请重新结算'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER order_item_channel_guard BEFORE INSERT ON order_items FOR EACH ROW EXECUTE FUNCTION cms_order_channel_guard();

CREATE FUNCTION cms_variant_item_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE trade jsonb; variant jsonb; reserved numeric;
BEGIN
 SELECT data::jsonb->'trade' INTO trade FROM contents WHERE id=NEW.product_id FOR UPDATE;
 IF trade->>'inventoryMode'='variants' THEN
  SELECT v INTO variant FROM cms_json_array(trade->'variants') v WHERE v->>'key'=NEW.variant LIMIT 1;
  SELECT COALESCE(SUM(i.quantity),0) INTO reserved FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.product_id=NEW.product_id AND i.variant=NEW.variant AND o.paid=0 AND o.status IN ('building','pending_payment','pending_review');
  IF NOT cms_json_integer(variant->'inventory') OR cms_json_number(variant->'inventory')<NEW.quantity+reserved THEN RAISE EXCEPTION '所选规格库存不足，请重新结算'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER variant_item_stock BEFORE INSERT ON order_items FOR EACH ROW EXECUTE FUNCTION cms_variant_item_guard();

CREATE FUNCTION cms_order_immutable_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION '订单快照不可删除'; END IF;
 RAISE EXCEPTION '订单快照不可修改';
END $$;
CREATE TRIGGER order_item_immutable BEFORE UPDATE ON order_items FOR EACH ROW EXECUTE FUNCTION cms_order_immutable_guard();
CREATE TRIGGER order_item_keep BEFORE DELETE ON order_items FOR EACH ROW EXECUTE FUNCTION cms_order_immutable_guard();

CREATE FUNCTION cms_order_state_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_NAME='order_finalize' AND OLD.status='building' THEN
  IF NEW.status<>'pending_payment' OR NOT EXISTS(SELECT 1 FROM order_items WHERE order_id=NEW.id) OR NEW.subtotal<>(SELECT SUM(quantity*unit_price) FROM order_items WHERE order_id=NEW.id) OR NEW.total<>NEW.subtotal+NEW.shipping OR NEW.shipping<0 THEN RAISE EXCEPTION '订单金额无效'; END IF;
 ELSIF TG_NAME='order_status_guard' AND OLD.status<>'building' AND NEW.status<>OLD.status THEN
  IF NOT ((OLD.status='pending_payment' AND NEW.status IN ('pending_review','closed')) OR (OLD.status='pending_review' AND NEW.status IN ('pending_payment','pending_ship','closed')) OR (OLD.status='pending_ship' AND NEW.status IN ('pending_receive','aftersale')) OR (OLD.status='pending_receive' AND NEW.status IN ('completed','aftersale')) OR (OLD.status='completed' AND NEW.status='aftersale') OR (OLD.status='aftersale' AND NEW.status IN ('pending_ship','pending_receive','completed','closed'))) THEN RAISE EXCEPTION '订单状态已变化'; END IF;
 ELSIF TG_NAME='order_paid_guard' AND OLD.paid<>NEW.paid THEN
  IF OLD.paid<>0 OR NEW.paid<>1 OR OLD.status<>'pending_review' OR NEW.status<>'pending_ship' THEN RAISE EXCEPTION '收款状态无效'; END IF;
 ELSIF TG_NAME='order_restock_guard' AND OLD.restocked<>NEW.restocked THEN
  IF OLD.restocked<>0 OR NEW.restocked<>1 OR NEW.refunded<>1 OR NEW.status<>'closed' THEN RAISE EXCEPTION '库存不可重复返还'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER order_finalize BEFORE UPDATE OF status ON orders FOR EACH ROW EXECUTE FUNCTION cms_order_state_guard();
CREATE TRIGGER order_status_guard BEFORE UPDATE OF status ON orders FOR EACH ROW EXECUTE FUNCTION cms_order_state_guard();
CREATE TRIGGER order_paid_guard BEFORE UPDATE OF paid ON orders FOR EACH ROW EXECUTE FUNCTION cms_order_state_guard();
CREATE TRIGGER order_restock_guard BEFORE UPDATE OF restocked ON orders FOR EACH ROW EXECUTE FUNCTION cms_order_state_guard();

CREATE FUNCTION cms_stock_edit_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE reserved numeric; item record; variant jsonb; trade jsonb; oldtrade jsonb;
BEGIN
 trade:=NEW.data::jsonb->'trade'; oldtrade:=OLD.data::jsonb->'trade';
 IF TG_NAME='order_stock_revision' THEN
  IF NEW.kind='products' AND (NEW.data::jsonb->>'_expectedStockVersion') IS DISTINCT FROM (OLD.data::jsonb->>'_expectedStockVersion') AND (NEW.data::jsonb->>'_expectedStockVersion')<>OLD.updated_at THEN RAISE EXCEPTION '商品库存已更新，请刷新后编辑'; END IF;
 ELSIF TG_NAME='order_stock_guard' AND NEW.kind='products' THEN
  SELECT SUM(i.quantity) INTO reserved FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.product_id=NEW.id AND o.paid=0 AND o.status IN ('building','pending_payment','pending_review');
  IF reserved IS NOT NULL AND (NOT cms_json_integer(trade->'inventory') OR cms_json_number(trade->'inventory')<reserved) THEN RAISE EXCEPTION '库存不能低于已锁定数量'; END IF;
 ELSIF TG_NAME='variant_stock_edit_guard' AND NEW.kind='products' AND (trade->>'inventoryMode'='variants' OR oldtrade->>'inventoryMode'='variants') THEN
  FOR item IN SELECT i.variant, SUM(i.quantity) AS quantity FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.product_id=NEW.id AND o.paid=0 AND o.status IN ('building','pending_payment','pending_review') GROUP BY i.variant LOOP
   SELECT v INTO variant FROM cms_json_array(trade->'variants') v WHERE v->>'key'=item.variant LIMIT 1;
   IF (trade->>'inventoryMode') IS DISTINCT FROM 'variants' OR NOT cms_json_integer(variant->'inventory') OR cms_json_number(variant->'inventory')<item.quantity THEN RAISE EXCEPTION '规格库存不能低于已占用数量，也不能删除占用中的规格'; END IF;
  END LOOP;
 ELSIF TG_NAME='variant_paid_reference_guard' AND oldtrade->>'inventoryMode'='variants' THEN
  FOR item IN SELECT DISTINCT i.variant FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.product_id=NEW.id AND o.paid=1 AND o.restocked=0 LOOP
   SELECT v INTO variant FROM cms_json_array(trade->'variants') v WHERE v->>'key'=item.variant LIMIT 1;
   IF (trade->>'inventoryMode') IS DISTINCT FROM 'variants' OR NOT cms_json_integer(variant->'inventory') THEN RAISE EXCEPTION '规格关联已付款订单，请保留规格及库存；不再销售可停用'; END IF;
  END LOOP;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER order_stock_guard BEFORE UPDATE OF data ON contents FOR EACH ROW EXECUTE FUNCTION cms_stock_edit_guard();
CREATE TRIGGER order_stock_revision BEFORE UPDATE OF data ON contents FOR EACH ROW EXECUTE FUNCTION cms_stock_edit_guard();
CREATE TRIGGER variant_stock_edit_guard BEFORE UPDATE OF data ON contents FOR EACH ROW EXECUTE FUNCTION cms_stock_edit_guard();
CREATE TRIGGER variant_paid_reference_guard BEFORE UPDATE OF data ON contents FOR EACH ROW EXECUTE FUNCTION cms_stock_edit_guard();

CREATE FUNCTION cms_order_stock_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE factor integer; product record; document jsonb; variants jsonb; item jsonb; amount numeric;
BEGIN
 factor:=CASE WHEN TG_NAME IN ('order_deduct','variant_order_deduct') THEN -1 ELSE 1 END;
 IF (factor=-1 AND NOT(OLD.paid=0 AND NEW.paid=1)) OR (factor=1 AND NOT(OLD.restocked=0 AND NEW.restocked=1)) THEN RETURN NEW; END IF;
 FOR product IN SELECT c.id,c.data,SUM(i.quantity) AS quantity FROM contents c JOIN order_items i ON i.product_id=c.id WHERE i.order_id=NEW.id GROUP BY c.id,c.data ORDER BY c.id LOOP
  document:=product.data::jsonb;
  IF TG_NAME IN ('order_deduct','order_restock') THEN
   document:=jsonb_set(document,'{trade,inventory}',to_jsonb(COALESCE(cms_json_number(document#>'{trade,inventory}'),0)+factor*product.quantity));
   UPDATE contents SET data=document::text,updated_at=to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') WHERE id=product.id;
  ELSIF document#>>'{trade,inventoryMode}'='variants' THEN
   variants:='[]'::jsonb;
   FOR item IN SELECT v FROM cms_json_array(document#>'{trade,variants}') v LOOP
    IF cms_json_integer(item->'inventory') THEN
     SELECT COALESCE(SUM(i.quantity),0) INTO amount FROM order_items i WHERE i.order_id=NEW.id AND i.product_id=product.id AND i.variant=item->>'key';
     item:=jsonb_set(item,'{inventory}',to_jsonb(cms_json_number(item->'inventory')+factor*amount));
    END IF;
    variants:=variants||jsonb_build_array(item);
   END LOOP;
   UPDATE contents SET data=jsonb_set(document,'{trade,variants}',variants)::text WHERE id=product.id;
  END IF;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER order_deduct AFTER UPDATE OF paid ON orders FOR EACH ROW EXECUTE FUNCTION cms_order_stock_change();
CREATE TRIGGER order_restock AFTER UPDATE OF restocked ON orders FOR EACH ROW EXECUTE FUNCTION cms_order_stock_change();
CREATE TRIGGER variant_order_deduct AFTER UPDATE OF paid ON orders FOR EACH ROW EXECUTE FUNCTION cms_order_stock_change();
CREATE TRIGGER variant_order_restock AFTER UPDATE OF restocked ON orders FOR EACH ROW EXECUTE FUNCTION cms_order_stock_change();

CREATE FUNCTION cms_order_number_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE instant timestamptz; local_time timestamp; next_sequence bigint; country text;
BEGIN
 IF TG_NAME='order_number_immutable' THEN
  IF OLD.order_number IS NOT NULL AND NEW.order_number IS DISTINCT FROM OLD.order_number THEN RAISE EXCEPTION '订单编号不可修改'; END IF;
  RETURN NEW;
 END IF;
 BEGIN instant:=NEW.created_at::timestamptz;
 EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION '订单编号由系统生成，创建时间必须有效'; END;
 IF instant IS NULL OR NOT isfinite(instant) THEN RAISE EXCEPTION '订单编号由系统生成，创建时间必须有效'; END IF;
 IF TG_NAME='order_number_input' THEN
  IF NEW.order_number IS NOT NULL THEN RAISE EXCEPTION '订单编号由系统生成，创建时间必须有效'; END IF;
  RETURN NEW;
 END IF;
 local_time:=instant AT TIME ZONE 'Asia/Shanghai';
 INSERT INTO order_counters(day,sequence) VALUES(to_char(local_time,'YYYYMMDD'),1) ON CONFLICT(day) DO UPDATE SET sequence=order_counters.sequence+1 RETURNING sequence INTO next_sequence;
 country:=upper(trim(NEW.data::jsonb#>>'{address,country}'));
 IF country IN ('AD','AE','AF','AG','AI','AL','AM','AO','AQ','AR','AS','AT','AU','AW','AX','AZ','BA','BB','BD','BE','BF','BG','BH','BI','BJ','BL','BM','BN','BO','BQ','BR','BS','BT','BV','BW','BY','BZ','CA','CC','CD','CF','CG','CH','CI','CK','CL','CM','CN','CO','CR','CU','CV','CW','CX','CY','CZ','DE','DJ','DK','DM','DO','DZ','EC','EE','EG','EH','ER','ES','ET','FI','FJ','FK','FM','FO','FR','GA','GB','GD','GE','GF','GG','GH','GI','GL','GM','GN','GP','GQ','GR','GS','GT','GU','GW','GY','HK','HM','HN','HR','HT','HU','ID','IE','IL','IM','IN','IO','IQ','IR','IS','IT','JE','JM','JO','JP','KE','KG','KH','KI','KM','KN','KP','KR','KW','KY','KZ','LA','LB','LC','LI','LK','LR','LS','LT','LU','LV','LY','MA','MC','MD','ME','MF','MG','MH','MK','ML','MM','MN','MO','MP','MQ','MR','MS','MT','MU','MV','MW','MX','MY','MZ','NA','NC','NE','NF','NG','NI','NL','NO','NP','NR','NU','NZ','OM','PA','PE','PF','PG','PH','PK','PL','PM','PN','PR','PS','PT','PW','PY','QA','RE','RO','RS','RU','RW','SA','SB','SC','SD','SE','SG','SH','SI','SJ','SK','SL','SM','SN','SO','SR','SS','ST','SV','SX','SY','SZ','TC','TD','TF','TG','TH','TJ','TK','TL','TM','TN','TO','TR','TT','TV','TW','TZ','UA','UG','UM','US','UY','UZ','VA','VC','VE','VG','VI','VN','VU','WF','WS','YE','YT','ZA','ZM','ZW') THEN NULL;
 ELSIF NEW.data::jsonb#>>'{address,country}' IN ('中国','China','中国大陆') THEN country:='CN';
 ELSE country:='ZZ'; END IF;
 UPDATE orders SET order_number=CASE WHEN NEW.sandbox=1 THEN 'TEST-' ELSE '' END || to_char(local_time,'YYYYMMDDHH24MISS') || '-' || country || '-' || lpad(next_sequence::text,greatest(6,length(next_sequence::text)), '0') WHERE id=NEW.id;
 RETURN NEW;
END $$;
CREATE TRIGGER order_number_input BEFORE INSERT ON orders FOR EACH ROW EXECUTE FUNCTION cms_order_number_guard();
CREATE TRIGGER order_number_assign AFTER INSERT ON orders FOR EACH ROW EXECUTE FUNCTION cms_order_number_guard();
CREATE TRIGGER order_number_immutable BEFORE UPDATE OF order_number ON orders FOR EACH ROW EXECUTE FUNCTION cms_order_number_guard();
