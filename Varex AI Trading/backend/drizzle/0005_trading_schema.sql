CREATE TABLE `trading_invite` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`role` text DEFAULT 'trader' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_by_user_id` text NOT NULL,
	`accepted_by_user_id` text,
	`accepted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`accepted_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trading_invite_email_uidx` ON `trading_invite` (`email`);--> statement-breakpoint
CREATE INDEX `trading_invite_status_idx` ON `trading_invite` (`status`);--> statement-breakpoint
CREATE TABLE `trading_profile` (
	`user_id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`role` text DEFAULT 'trader' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`paper_balance_cents` integer DEFAULT 2500000 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `trading_profile_role_idx` ON `trading_profile` (`role`);--> statement-breakpoint
CREATE INDEX `trading_profile_status_idx` ON `trading_profile` (`status`);--> statement-breakpoint
CREATE TABLE `trading_state` (
	`user_id` text PRIMARY KEY NOT NULL,
	`state_json` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `trading_state_updated_idx` ON `trading_state` (`updated_at`);
