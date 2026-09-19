CREATE TABLE `trading_broker_connection` (
	`user_id` text PRIMARY KEY NOT NULL,
	`provider` text DEFAULT 'binance' NOT NULL,
	`account_label` text DEFAULT 'حساب Binance Spot' NOT NULL,
	`api_key_ciphertext` text NOT NULL,
	`api_key_iv` text NOT NULL,
	`api_secret_ciphertext` text NOT NULL,
	`api_secret_iv` text NOT NULL,
	`key_fingerprint` text NOT NULL,
	`status` text DEFAULT 'connected' NOT NULL,
	`live_trading_enabled` integer DEFAULT false NOT NULL,
	`max_live_order_cents` integer DEFAULT 10000 NOT NULL,
	`permission_snapshot` text DEFAULT '{}' NOT NULL,
	`last_error` text,
	`last_checked_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `trading_broker_connection_status_idx` ON `trading_broker_connection` (`status`);--> statement-breakpoint
CREATE TABLE `trading_live_order` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text DEFAULT 'binance' NOT NULL,
	`client_order_id` text NOT NULL,
	`provider_order_id` text,
	`symbol` text NOT NULL,
	`side` text NOT NULL,
	`quote_amount_cents` integer NOT NULL,
	`executed_quote_amount` text,
	`executed_quantity` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`requested_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trading_live_order_client_uidx` ON `trading_live_order` (`client_order_id`);--> statement-breakpoint
CREATE INDEX `trading_live_order_user_requested_idx` ON `trading_live_order` (`user_id`,`requested_at`);