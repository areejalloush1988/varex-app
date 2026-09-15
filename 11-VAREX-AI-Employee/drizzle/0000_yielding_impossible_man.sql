CREATE TABLE `ai_agents` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`objective` text,
	`language` text NOT NULL,
	`tone` text NOT NULL,
	`channels` text NOT NULL,
	`status` text NOT NULL,
	`requires_approval` integer NOT NULL,
	`instructions` text,
	`created_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_agents_org_idx` ON `ai_agents` (`organization_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `ai_approvals` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`task_id` text,
	`title` text NOT NULL,
	`summary` text,
	`status` text NOT NULL,
	`requested_by` text,
	`reviewed_by` text,
	`reviewed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_approvals_org_idx` ON `ai_approvals` (`organization_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `ai_audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` text,
	`action` text NOT NULL,
	`entity_type` text,
	`entity_id` text,
	`details` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_audit_org_idx` ON `ai_audit_logs` (`organization_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `ai_integrations` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`provider` text NOT NULL,
	`status` text NOT NULL,
	`connected_account` text,
	`last_sync_at` text,
	`metadata` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_integrations_org_provider_unique` ON `ai_integrations` (`organization_id`,`provider`);--> statement-breakpoint
CREATE TABLE `ai_knowledge_items` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`title` text NOT NULL,
	`file_type` text,
	`file_size` integer,
	`storage_path` text,
	`status` text NOT NULL,
	`created_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_knowledge_org_idx` ON `ai_knowledge_items` (`organization_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `ai_leads` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`company` text,
	`service` text NOT NULL,
	`status` text NOT NULL,
	`source` text NOT NULL,
	`priority` text NOT NULL,
	`score` integer NOT NULL,
	`next_action` text,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_leads_org_idx` ON `ai_leads` (`organization_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `ai_members` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_members_org_user_unique` ON `ai_members` (`organization_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `ai_members_user_idx` ON `ai_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `ai_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`contact_name` text NOT NULL,
	`channel` text NOT NULL,
	`direction` text NOT NULL,
	`body` text NOT NULL,
	`send_status` text NOT NULL,
	`created_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_messages_org_idx` ON `ai_messages` (`organization_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `ai_organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`industry` text,
	`status` text NOT NULL,
	`trial_ends_at` text NOT NULL,
	`timezone` text NOT NULL,
	`ui_language` text NOT NULL,
	`requires_price_approval` integer NOT NULL,
	`audit_enabled` integer NOT NULL,
	`auto_publish` integer NOT NULL,
	`vat_enabled` integer NOT NULL,
	`legal_name` text,
	`trn` text,
	`billing_email` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_organizations_owner_idx` ON `ai_organizations` (`owner_id`);--> statement-breakpoint
CREATE TABLE `ai_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`access_token_hash` text NOT NULL,
	`refresh_token_hash` text NOT NULL,
	`access_expires_at` text NOT NULL,
	`refresh_expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `ai_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_sessions_access_unique` ON `ai_sessions` (`access_token_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `ai_sessions_refresh_unique` ON `ai_sessions` (`refresh_token_hash`);--> statement-breakpoint
CREATE INDEX `ai_sessions_user_idx` ON `ai_sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `ai_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`plan_code` text NOT NULL,
	`status` text NOT NULL,
	`agent_limit` integer,
	`monthly_task_limit` integer NOT NULL,
	`trial_ends_at` text,
	`starts_at` text NOT NULL,
	`renews_at` text,
	`billing_cycle` text NOT NULL,
	`payment_method` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_subscriptions_org_idx` ON `ai_subscriptions` (`organization_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `ai_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`agent_id` text,
	`title` text NOT NULL,
	`instructions` text,
	`status` text NOT NULL,
	`priority` text NOT NULL,
	`requires_approval` integer NOT NULL,
	`output` text,
	`scheduled_at` text,
	`started_at` text,
	`completed_at` text,
	`created_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_tasks_org_idx` ON `ai_tasks` (`organization_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `ai_users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`password_salt` text NOT NULL,
	`full_name` text,
	`business_name` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_users_email_unique` ON `ai_users` (`email`);