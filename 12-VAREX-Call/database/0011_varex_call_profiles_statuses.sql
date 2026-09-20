CREATE TABLE `varex_call_status` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`media_key` text,
	`media_type` text DEFAULT 'text' NOT NULL,
	`background_color` text DEFAULT '#3157d5' NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `varex_call_account`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_varex_call_status_account_created` ON `varex_call_status` (`account_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_varex_call_status_expires` ON `varex_call_status` (`expires_at`);--> statement-breakpoint
ALTER TABLE `varex_call_account` ADD `avatar_key` text;--> statement-breakpoint
ALTER TABLE `varex_call_account` ADD `about` text DEFAULT 'مرحباً! أستخدم VAREX Call' NOT NULL;