CREATE TABLE `ai_oauth_states` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`state_hash` text NOT NULL,
	`code_verifier` text,
	`return_to` text NOT NULL,
	`expires_at` text NOT NULL,
	`consumed_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_oauth_states_hash_unique` ON `ai_oauth_states` (`state_hash`);--> statement-breakpoint
CREATE INDEX `ai_oauth_states_expiry_idx` ON `ai_oauth_states` (`expires_at`);--> statement-breakpoint
CREATE INDEX `ai_oauth_states_org_idx` ON `ai_oauth_states` (`organization_id`,`created_at`);