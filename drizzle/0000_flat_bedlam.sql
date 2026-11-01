CREATE TABLE `answers` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` text NOT NULL,
	`question_id` text NOT NULL,
	`value` text,
	FOREIGN KEY (`submission_id`) REFERENCES `form_submissions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `answers_submission_question_idx` ON `answers` (`submission_id`,`question_id`);--> statement-breakpoint
CREATE TABLE `articles` (
	`id` text PRIMARY KEY NOT NULL,
	`author_id` text NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`category` text NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`visibility` text DEFAULT 'all' NOT NULL,
	`course_id` text,
	`class_id` text,
	`link` text,
	`image_r2_key` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `articles_created_idx` ON `articles` (`created_at`);--> statement-breakpoint
CREATE TABLE `assignment_files` (
	`id` text PRIMARY KEY NOT NULL,
	`version_id` text NOT NULL,
	`name` text NOT NULL,
	`size` integer NOT NULL,
	`mime` text NOT NULL,
	`r2_key` text NOT NULL,
	`uploaded_at` text NOT NULL,
	FOREIGN KEY (`version_id`) REFERENCES `submission_versions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `assignment_files_version_idx` ON `assignment_files` (`version_id`);--> statement-breakpoint
CREATE TABLE `assignment_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` text NOT NULL,
	`reviewer_id` text NOT NULL,
	`score` integer,
	`comment` text DEFAULT '' NOT NULL,
	`request_resubmit` integer DEFAULT false NOT NULL,
	`reviewed_at` text NOT NULL,
	`read_by` text DEFAULT '[]' NOT NULL,
	FOREIGN KEY (`submission_id`) REFERENCES `assignment_submissions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `assignment_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`assignment_id` text NOT NULL,
	`owner_type` text NOT NULL,
	`owner_id` text NOT NULL,
	`submit_status` text DEFAULT 'not_submitted' NOT NULL,
	`review_status` text DEFAULT 'pending' NOT NULL,
	`draft` text,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`assignment_id`) REFERENCES `assignments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assignment_submissions_owner_idx` ON `assignment_submissions` (`assignment_id`,`owner_type`,`owner_id`);--> statement-breakpoint
CREATE TABLE `assignment_targets` (
	`assignment_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	PRIMARY KEY(`assignment_id`, `target_type`, `target_id`),
	FOREIGN KEY (`assignment_id`) REFERENCES `assignments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`description` text NOT NULL,
	`open_at` text NOT NULL,
	`due_at` text NOT NULL,
	`formats` text DEFAULT '[]' NOT NULL,
	`max_size_mb` integer DEFAULT 10 NOT NULL,
	`allow_late` integer DEFAULT true NOT NULL,
	`allow_resubmit` integer DEFAULT true NOT NULL,
	`grading_mode` text DEFAULT 'both' NOT NULL,
	`attachments` text DEFAULT '[]' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `assignments_course_idx` ON `assignments` (`course_id`,`due_at`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`target` text NOT NULL,
	`at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_logs_at_idx` ON `audit_logs` (`at`);--> statement-breakpoint
CREATE TABLE `classes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`year` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`article_id` text NOT NULL,
	`author_id` text NOT NULL,
	`content` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `comments_article_idx` ON `comments` (`article_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `courses` (
	`id` text PRIMARY KEY NOT NULL,
	`class_id` text NOT NULL,
	`unit` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`teacher_id` text NOT NULL,
	`date` text NOT NULL,
	`location` text,
	`status` text DEFAULT 'upcoming' NOT NULL,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`teacher_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `courses_class_idx` ON `courses` (`class_id`,`date`);--> statement-breakpoint
CREATE TABLE `enrollments` (
	`user_id` text NOT NULL,
	`class_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `class_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`question_id` text,
	`author_id` text NOT NULL,
	`content` text NOT NULL,
	`created_at` text NOT NULL,
	`read_by` text DEFAULT '[]' NOT NULL,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `feedback_target_idx` ON `feedback` (`target_type`,`target_id`);--> statement-breakpoint
CREATE TABLE `form_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`form_id` text NOT NULL,
	`user_id` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`submitted_at` text,
	`updated_at` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`form_id`) REFERENCES `forms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `form_submissions_unique_idx` ON `form_submissions` (`form_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `forms` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`open_at` text NOT NULL,
	`due_at` text NOT NULL,
	`allow_edit` integer DEFAULT true NOT NULL,
	`allow_late` integer DEFAULT true NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `forms_course_idx` ON `forms` (`course_id`,`due_at`);--> statement-breakpoint
CREATE TABLE `group_members` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`user_id` text NOT NULL,
	`joined_at` text NOT NULL,
	`left_at` text,
	`changed_by` text NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `group_members_group_idx` ON `group_members` (`group_id`,`left_at`);--> statement-breakpoint
CREATE INDEX `group_members_user_idx` ON `group_members` (`user_id`,`left_at`);--> statement-breakpoint
CREATE TABLE `groups` (
	`id` text PRIMARY KEY NOT NULL,
	`class_id` text NOT NULL,
	`name` text NOT NULL,
	`leader_id` text,
	`history` text DEFAULT '[]' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`leader_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `materials` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`url` text,
	`file_name` text,
	`file_size` integer,
	`file_mime` text,
	`r2_key` text,
	`pinned` integer DEFAULT false NOT NULL,
	`uploaded_by` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `materials_course_idx` ON `materials` (`course_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`href` text DEFAULT '/' NOT NULL,
	`channel` text DEFAULT 'app' NOT NULL,
	`read` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `notifications_user_idx` ON `notifications` (`user_id`,`read`,`created_at`);--> statement-breakpoint
CREATE TABLE `questions` (
	`id` text PRIMARY KEY NOT NULL,
	`form_id` text NOT NULL,
	`order` integer NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`required` integer DEFAULT false NOT NULL,
	`options` text,
	`max` integer,
	FOREIGN KEY (`form_id`) REFERENCES `forms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `questions_form_idx` ON `questions` (`form_id`,`order`);--> statement-breakpoint
CREATE TABLE `submission_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` text NOT NULL,
	`no` integer NOT NULL,
	`submitted_by_id` text NOT NULL,
	`submitted_at` text NOT NULL,
	`text` text DEFAULT '' NOT NULL,
	`link` text,
	FOREIGN KEY (`submission_id`) REFERENCES `assignment_submissions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`submitted_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `submission_versions_idx` ON `submission_versions` (`submission_id`,`no`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`chatgpt_user_id` text,
	`name` text NOT NULL,
	`role` text DEFAULT 'student' NOT NULL,
	`title` text,
	`company` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);