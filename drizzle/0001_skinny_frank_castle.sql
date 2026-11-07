CREATE TABLE `report_views` (
	`id` text PRIMARY KEY NOT NULL,
	`viewer_key` text NOT NULL,
	`session_id` text NOT NULL,
	`seq` integer NOT NULL,
	`viewed_at` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `viewer_session` ON `report_views` (`viewer_key`,`session_id`);--> statement-breakpoint
CREATE TABLE `resource_events` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`kind` text NOT NULL,
	`resource_id` text NOT NULL,
	`action` text NOT NULL,
	`recorded_at` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action
);
