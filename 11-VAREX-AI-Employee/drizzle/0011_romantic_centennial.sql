CREATE TABLE `ai_chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`agent_id` text,
	`user_id` text,
	`role` text NOT NULL,
	`body` text NOT NULL,
	`kind` text DEFAULT 'text' NOT NULL,
	`client_message_id` text,
	`action_execution_id` text,
	`metadata` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_chat_messages_thread_idx` ON `ai_chat_messages` (`organization_id`,`agent_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `ai_chat_messages_execution_idx` ON `ai_chat_messages` (`action_execution_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `ai_chat_messages_client_unique` ON `ai_chat_messages` (`organization_id`,`user_id`,`client_message_id`);