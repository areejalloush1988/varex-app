CREATE TABLE `varex_call_account` (
	`id` text PRIMARY KEY NOT NULL,
	`phone` text NOT NULL,
	`phone_hash` text NOT NULL,
	`display_name` text NOT NULL,
	`avatar_color` text DEFAULT '#3157d5' NOT NULL,
	`discoverable` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_varex_call_account_phone` ON `varex_call_account` (`phone`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_varex_call_account_phone_hash` ON `varex_call_account` (`phone_hash`);--> statement-breakpoint
CREATE INDEX `idx_varex_call_account_last_seen` ON `varex_call_account` (`last_seen_at`);--> statement-breakpoint
CREATE TABLE `varex_call_contact` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_account_id` text NOT NULL,
	`phone` text NOT NULL,
	`phone_hash` text NOT NULL,
	`local_name` text NOT NULL,
	`matched_account_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_account_id`) REFERENCES `varex_call_account`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`matched_account_id`) REFERENCES `varex_call_account`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_varex_call_contact_owner_phone` ON `varex_call_contact` (`owner_account_id`,`phone_hash`);--> statement-breakpoint
CREATE INDEX `idx_varex_call_contact_owner_updated` ON `varex_call_contact` (`owner_account_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_varex_call_contact_matched` ON `varex_call_contact` (`matched_account_id`);--> statement-breakpoint
CREATE TABLE `varex_call_conversation` (
	`id` text PRIMARY KEY NOT NULL,
	`member_low_id` text NOT NULL,
	`member_high_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`last_message_at` integer NOT NULL,
	FOREIGN KEY (`member_low_id`) REFERENCES `varex_call_account`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_high_id`) REFERENCES `varex_call_account`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_varex_call_conversation_members` ON `varex_call_conversation` (`member_low_id`,`member_high_id`);--> statement-breakpoint
CREATE INDEX `idx_varex_call_conversation_low_activity` ON `varex_call_conversation` (`member_low_id`,`last_message_at`);--> statement-breakpoint
CREATE INDEX `idx_varex_call_conversation_high_activity` ON `varex_call_conversation` (`member_high_id`,`last_message_at`);--> statement-breakpoint
CREATE TABLE `varex_call_message` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`sender_account_id` text NOT NULL,
	`client_nonce` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	`read_at` integer,
	`deleted_at` integer,
	FOREIGN KEY (`conversation_id`) REFERENCES `varex_call_conversation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sender_account_id`) REFERENCES `varex_call_account`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_varex_call_message_sender_nonce` ON `varex_call_message` (`sender_account_id`,`client_nonce`);--> statement-breakpoint
CREATE INDEX `idx_varex_call_message_conversation_cursor` ON `varex_call_message` (`conversation_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `idx_varex_call_message_unread` ON `varex_call_message` (`conversation_id`,`read_at`);--> statement-breakpoint
CREATE TABLE `varex_call_session` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`device_name` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `varex_call_account`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_varex_call_session_account` ON `varex_call_session` (`account_id`);--> statement-breakpoint
CREATE INDEX `idx_varex_call_session_expires` ON `varex_call_session` (`expires_at`);--> statement-breakpoint
ALTER TABLE `varex_call_room` ADD `caller_account_id` text REFERENCES varex_call_account(id);--> statement-breakpoint
ALTER TABLE `varex_call_room` ADD `callee_account_id` text REFERENCES varex_call_account(id);--> statement-breakpoint
ALTER TABLE `varex_call_room` ADD `answered_at` integer;--> statement-breakpoint
ALTER TABLE `varex_call_room` ADD `ended_reason` text;--> statement-breakpoint
CREATE INDEX `idx_varex_call_room_callee_status` ON `varex_call_room` (`callee_account_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_varex_call_room_caller_created` ON `varex_call_room` (`caller_account_id`,`created_at`);--> statement-breakpoint
PRAGMA optimize;
