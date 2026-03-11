CREATE INDEX `memos_user_deleted_created_idx` ON `memos` (`user_id`, `deleted_at`, `created_at`);
