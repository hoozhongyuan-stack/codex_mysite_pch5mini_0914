CREATE TABLE `submission_history` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` text NOT NULL,
	`actor` text NOT NULL,
	`status` text NOT NULL,
	`note` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `submission_history_lookup` ON `submission_history` (`submission_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `submission_workflows` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`updated_at` text NOT NULL
);
