CREATE TABLE `ai_action_executions` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`agent_id` text,
	`task_id` text,
	`app_key` text NOT NULL,
	`action_key` text NOT NULL,
	`permission_mode` text NOT NULL,
	`status` text NOT NULL,
	`target` text,
	`request_payload` text NOT NULL,
	`result_summary` text,
	`result_details` text NOT NULL,
	`error_code` text,
	`approved_by` text,
	`approved_at` text,
	`started_at` text,
	`completed_at` text,
	`created_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_action_executions_org_idx` ON `ai_action_executions` (`organization_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `ai_action_executions_task_idx` ON `ai_action_executions` (`task_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `ai_agent_permissions` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`agent_id` text NOT NULL,
	`app_key` text NOT NULL,
	`action_key` text NOT NULL,
	`mode` text NOT NULL,
	`risk_level` text NOT NULL,
	`updated_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_agent_permissions_action_unique` ON `ai_agent_permissions` (`organization_id`,`agent_id`,`app_key`,`action_key`);--> statement-breakpoint
CREATE INDEX `ai_agent_permissions_agent_idx` ON `ai_agent_permissions` (`organization_id`,`agent_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `ai_device_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` text NOT NULL,
	`device_id` text NOT NULL,
	`device_name` text NOT NULL,
	`platform` text NOT NULL,
	`status` text NOT NULL,
	`app_version` text,
	`capabilities` text NOT NULL,
	`last_seen_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_device_connections_org_device_unique` ON `ai_device_connections` (`organization_id`,`device_id`);--> statement-breakpoint
CREATE INDEX `ai_device_connections_org_idx` ON `ai_device_connections` (`organization_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `ai_voice_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`agent_id` text NOT NULL,
	`provider` text NOT NULL,
	`status` text NOT NULL,
	`caller_id` text,
	`voice_id` text,
	`disclosure_text` text NOT NULL,
	`settings` text NOT NULL,
	`updated_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_voice_settings_agent_unique` ON `ai_voice_settings` (`organization_id`,`agent_id`);--> statement-breakpoint
CREATE INDEX `ai_voice_settings_org_idx` ON `ai_voice_settings` (`organization_id`,`updated_at`);