CREATE TRIGGER IF NOT EXISTS guard_brand_asset_delete BEFORE DELETE ON assets
WHEN EXISTS(SELECT 1 FROM settings WHERE json_extract(data,'$.brand.logoId')=OLD.id OR json_extract(data,'$.brand.faviconId')=OLD.id)
BEGIN SELECT RAISE(ABORT,'素材正在被品牌与图标引用'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS guard_brand_settings_insert BEFORE INSERT ON settings
WHEN EXISTS(SELECT 1 FROM json_each(NEW.data,'$.brand') WHERE key IN ('logoId','faviconId') AND value<>'' AND NOT EXISTS(SELECT 1 FROM assets WHERE id=value))
BEGIN SELECT RAISE(ABORT,'品牌素材不存在'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS guard_brand_settings_update BEFORE UPDATE OF data ON settings
WHEN EXISTS(SELECT 1 FROM json_each(NEW.data,'$.brand') WHERE key IN ('logoId','faviconId') AND value<>'' AND NOT EXISTS(SELECT 1 FROM assets WHERE id=value))
BEGIN SELECT RAISE(ABORT,'品牌素材不存在'); END;
