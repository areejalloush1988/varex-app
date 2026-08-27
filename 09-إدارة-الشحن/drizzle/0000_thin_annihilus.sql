CREATE TABLE `shipping_businesses` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`owner_email` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `shipping_pending_auth` (
	`email` text NOT NULL,
	`purpose` text NOT NULL,
	`business_name` text,
	`password_hash` text,
	`password_salt` text,
	`sent_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`email`, `purpose`)
);
--> statement-breakpoint
CREATE INDEX `shipping_pending_expiry_idx` ON `shipping_pending_auth` (`expires_at`);--> statement-breakpoint
CREATE TABLE `shipping_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`business_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `shipping_users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`business_id`) REFERENCES `shipping_businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `shipping_sessions_user_idx` ON `shipping_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `shipping_sessions_expiry_idx` ON `shipping_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `shipping_settings` (
	`business_id` text PRIMARY KEY NOT NULL,
	`settings_json` text DEFAULT '{}' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `shipping_businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `shipping_shipments` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`customer` text NOT NULL,
	`phone` text NOT NULL,
	`origin` text NOT NULL,
	`destination` text NOT NULL,
	`service` text NOT NULL,
	`status` text NOT NULL,
	`eta` text NOT NULL,
	`driver` text NOT NULL,
	`vehicle` text NOT NULL,
	`progress` integer NOT NULL,
	`amount` real DEFAULT 0 NOT NULL,
	`weight` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `shipping_businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `shipping_shipments_business_created_idx` ON `shipping_shipments` (`business_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `shipping_shipments_business_status_idx` ON `shipping_shipments` (`business_id`,`status`);--> statement-breakpoint
CREATE TABLE `shipping_users` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`password_salt` text NOT NULL,
	`role` text DEFAULT 'owner' NOT NULL,
	`email_verified` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `shipping_businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shipping_users_email_unique` ON `shipping_users` (`email`);--> statement-breakpoint
CREATE INDEX `shipping_users_business_idx` ON `shipping_users` (`business_id`);