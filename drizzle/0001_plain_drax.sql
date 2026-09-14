CREATE TABLE `admin_memberships` (
	`email` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`status` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`target` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`parent_id` text,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `category_kind_parent` ON `categories` (`kind`,`parent_id`);--> statement-breakpoint
CREATE TABLE `content_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`content_id` text NOT NULL,
	`asset_id` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `content_asset_lookup` ON `content_assets` (`asset_id`,`content_id`);--> statement-breakpoint
CREATE TABLE `asset_folders_map` (
	`asset_id` text PRIMARY KEY NOT NULL,
	`folder_id` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `asset_folders` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `navigation_items` (
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `policies` (
	`kind` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`published` text,
	`version` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `submission_files` (
	`id` text PRIMARY KEY NOT NULL,
	`form_id` text NOT NULL,
	`field_id` text NOT NULL,
	`session` text NOT NULL,
	`name` text NOT NULL,
	`mime` text NOT NULL,
	`submission_id` text,
	`created_at` text NOT NULL
);

--> statement-breakpoint
CREATE TRIGGER category_insert_guard BEFORE INSERT ON categories
WHEN NEW.kind NOT IN ('articles','products') OR (NEW.parent_id IS NOT NULL AND (NEW.kind!='products' OR NEW.parent_id=NEW.id OR NOT EXISTS(SELECT 1 FROM categories WHERE id=NEW.parent_id AND kind='products' AND parent_id IS NULL) OR EXISTS(SELECT 1 FROM categories WHERE parent_id=NEW.id)))
BEGIN SELECT RAISE(ABORT, 'Invalid category hierarchy'); END;
--> statement-breakpoint
CREATE TRIGGER category_update_guard BEFORE UPDATE ON categories
WHEN NEW.kind!=OLD.kind OR (NEW.parent_id IS NOT NULL AND (NEW.kind!='products' OR NEW.parent_id=NEW.id OR NOT EXISTS(SELECT 1 FROM categories WHERE id=NEW.parent_id AND kind='products' AND parent_id IS NULL) OR EXISTS(SELECT 1 FROM categories WHERE parent_id=NEW.id)))
BEGIN SELECT RAISE(ABORT, 'Invalid category hierarchy'); END;
--> statement-breakpoint
CREATE TRIGGER category_delete_guard BEFORE DELETE ON categories
WHEN EXISTS(SELECT 1 FROM categories WHERE parent_id=OLD.id) OR EXISTS(SELECT 1 FROM contents WHERE json_extract(data,'$.categoryId')=OLD.id) OR EXISTS(SELECT 1 FROM navigation_items WHERE json_extract(data,'$.targetId')=OLD.id)
BEGIN SELECT RAISE(ABORT, 'Category is referenced'); END;
