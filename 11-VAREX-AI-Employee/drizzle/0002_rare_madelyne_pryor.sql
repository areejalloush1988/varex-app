CREATE TABLE `ai_auth_otps` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`purpose` text NOT NULL,
	`code_hash` text NOT NULL,
	`payload` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`expires_at` text NOT NULL,
	`consumed_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_auth_otps_email_purpose_idx` ON `ai_auth_otps` (`email`,`purpose`,`created_at`);--> statement-breakpoint
CREATE INDEX `ai_auth_otps_expiry_idx` ON `ai_auth_otps` (`expires_at`);--> statement-breakpoint
ALTER TABLE `ai_users` ADD `email_verified` integer DEFAULT 1 NOT NULL;