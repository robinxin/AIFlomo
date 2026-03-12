PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_memo_tags` (
	`memo_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`memo_id`, `tag_id`),
	FOREIGN KEY (`memo_id`) REFERENCES `memos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_memo_tags`("memo_id", "tag_id") SELECT "memo_id", "tag_id" FROM `memo_tags`;--> statement-breakpoint
DROP TABLE `memo_tags`;--> statement-breakpoint
ALTER TABLE `__new_memo_tags` RENAME TO `memo_tags`;--> statement-breakpoint
PRAGMA foreign_keys=ON;