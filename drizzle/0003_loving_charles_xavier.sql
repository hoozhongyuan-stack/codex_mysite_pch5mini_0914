CREATE INDEX `audit_created` ON `audit_logs` (`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `audit_action_created` ON `audit_logs` (`action`,`created_at`);--> statement-breakpoint
CREATE INDEX `content_kind_updated` ON `contents` (`kind`,`updated_at`,`id`);--> statement-breakpoint
CREATE INDEX `submissions_created` ON `submissions` (`created_at`,`id`);