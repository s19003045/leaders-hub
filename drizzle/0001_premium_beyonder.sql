CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `users` ADD `line_user_id` text;--> statement-breakpoint
ALTER TABLE `users` ADD `line_bind_code` text;