CREATE TABLE `ai_voice_calls` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`agent_id` text NOT NULL,
	`action_execution_id` text,
	`provider_call_id` text,
	`openai_session_id` text,
	`from_number` text NOT NULL,
	`to_number` text NOT NULL,
	`contact_name` text,
	`purpose` text NOT NULL,
	`status` text NOT NULL,
	`error_code` text,
	`started_at` text,
	`answered_at` text,
	`completed_at` text,
	`metadata` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_voice_calls_org_idx` ON `ai_voice_calls` (`organization_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `ai_voice_calls_agent_idx` ON `ai_voice_calls` (`organization_id`,`agent_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `ai_voice_calls_provider_unique` ON `ai_voice_calls` (`provider_call_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `ai_voice_calls_execution_unique` ON `ai_voice_calls` (`action_execution_id`);