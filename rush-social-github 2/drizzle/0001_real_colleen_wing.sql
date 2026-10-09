CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`sender_id` text NOT NULL,
	`recipient_id` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	`read_at` integer,
	FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recipient_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `messages_pair_idx` ON `messages` (`sender_id`,`recipient_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `sync_state` (
	`id` text PRIMARY KEY NOT NULL,
	`last_sync` integer DEFAULT 0 NOT NULL,
	`cursor` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `trade_activity` (
	`id` text PRIMARY KEY NOT NULL,
	`trader` text NOT NULL,
	`trade_id` text NOT NULL,
	`symbol` text NOT NULL,
	`side` text NOT NULL,
	`shares` integer NOT NULL,
	`price` text NOT NULL,
	`total` text NOT NULL,
	`pnl` text,
	`traded_at` integer NOT NULL,
	`observed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `activity_time_idx` ON `trade_activity` (`traded_at`,`id`);