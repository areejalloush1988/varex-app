CREATE TABLE `varex_call_rate_limit` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 1 NOT NULL,
	`window_started_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_varex_call_rate_limit_expires` ON `varex_call_rate_limit` (`expires_at`);--> statement-breakpoint
CREATE TABLE `varex_call_room` (
	`id` text PRIMARY KEY NOT NULL,
	`call_type` text NOT NULL,
	`status` text DEFAULT 'waiting' NOT NULL,
	`host_token_hash` text NOT NULL,
	`guest_token_hash` text,
	`host_name` text NOT NULL,
	`guest_name` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_varex_call_room_status_expires` ON `varex_call_room` (`status`,`expires_at`);--> statement-breakpoint
CREATE TABLE `varex_call_signal` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`room_id` text NOT NULL,
	`sender_role` text NOT NULL,
	`recipient_role` text NOT NULL,
	`kind` text NOT NULL,
	`payload_json` text DEFAULT 'null' NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `varex_call_room`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_varex_call_signal_recipient_cursor` ON `varex_call_signal` (`room_id`,`recipient_role`,`id`);--> statement-breakpoint
CREATE INDEX `idx_varex_call_signal_expires` ON `varex_call_signal` (`expires_at`);--> statement-breakpoint
PRAGMA optimize;

