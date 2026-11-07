CREATE TABLE `chapter_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`chapter_id` text NOT NULL,
	`payload` text NOT NULL,
	`storage_key` text,
	`size` integer,
	`sha256` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE no action
);
