ALTER TABLE `ai_action_executions` ADD `device_id` text;--> statement-breakpoint
ALTER TABLE `ai_action_executions` ADD `claimed_at` text;--> statement-breakpoint
CREATE INDEX `ai_action_executions_device_queue_idx` ON `ai_action_executions` (`organization_id`,`device_id`,`status`,`created_at`);