CREATE TABLE `ai_activation_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`code_hash` text NOT NULL,
	`code_prefix` text NOT NULL,
	`status` text NOT NULL,
	`created_by` text NOT NULL,
	`redeemed_by` text,
	`redeemed_organization_id` text,
	`redeemed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_activation_codes_hash_unique` ON `ai_activation_codes` (`code_hash`);--> statement-breakpoint
CREATE INDEX `ai_activation_codes_status_idx` ON `ai_activation_codes` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `ai_activation_codes_redeemed_org_idx` ON `ai_activation_codes` (`redeemed_organization_id`);--> statement-breakpoint
CREATE TABLE `ai_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`created_by` text NOT NULL,
	`provider` text NOT NULL,
	`provider_order_id` text NOT NULL,
	`provider_capture_id` text,
	`plan_code` text NOT NULL,
	`amount` text NOT NULL,
	`currency` text NOT NULL,
	`status` text NOT NULL,
	`payer_email` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_payments_provider_order_unique` ON `ai_payments` (`provider`,`provider_order_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `ai_payments_provider_capture_unique` ON `ai_payments` (`provider`,`provider_capture_id`);--> statement-breakpoint
CREATE INDEX `ai_payments_org_idx` ON `ai_payments` (`organization_id`,`created_at`);