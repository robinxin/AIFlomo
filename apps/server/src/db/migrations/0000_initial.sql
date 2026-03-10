CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`nickname` text DEFAULT '' NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
--> statement-breakpoint
CREATE TABLE `memos` (
	`id` text PRIMARY KEY NOT NULL,
	`content` text NOT NULL,
	`user_id` text NOT NULL,
	`has_image` integer DEFAULT 0 NOT NULL,
	`has_link` integer DEFAULT 0 NOT NULL,
	`deleted_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_user_idx` ON `tags` (`name`,`user_id`);
--> statement-breakpoint
CREATE TABLE `memo_tags` (
	`memo_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`memo_id`, `tag_id`),
	FOREIGN KEY (`memo_id`) REFERENCES `memos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `memo_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`memo_id` text NOT NULL,
	`type` text NOT NULL,
	`url` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL,
	FOREIGN KEY (`memo_id`) REFERENCES `memos`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "memo_attachments_type_check" CHECK(`type` IN ('image', 'link'))
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`sid` text PRIMARY KEY NOT NULL,
	`sess` text NOT NULL,
	`expired` text NOT NULL
);
