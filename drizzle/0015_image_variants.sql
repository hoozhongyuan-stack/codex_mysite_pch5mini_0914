CREATE TABLE IF NOT EXISTS `asset_variants` (
  `asset_id` text NOT NULL,
  `variant` text NOT NULL,
  `object_key` text NOT NULL,
  `width` integer NOT NULL,
  `height` integer NOT NULL,
  `size` integer NOT NULL,
  `status` text NOT NULL,
  `error` text NOT NULL DEFAULT '',
  `updated_at` text NOT NULL,
  PRIMARY KEY (`asset_id`,`variant`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `asset_variants_status` ON `asset_variants` (`status`,`updated_at`);
