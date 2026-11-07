CREATE TABLE `report_pdfs` (
	`id` text PRIMARY KEY NOT NULL,
	`revision_id` text NOT NULL,
	`student_id` text NOT NULL,
	`storage_key` text NOT NULL,
	`name` text NOT NULL,
	`size` integer NOT NULL,
	`sha256` text NOT NULL,
	`template_version` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`revision_id`) REFERENCES `revisions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `report_pdfs_revision_id_unique` ON `report_pdfs` (`revision_id`);