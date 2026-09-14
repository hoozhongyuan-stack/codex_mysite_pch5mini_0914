CREATE TABLE `marketing_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`asset_id` text NOT NULL,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action
);
