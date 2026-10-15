CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `people` (
	`event` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`arrived` text,
	`device` text,
	PRIMARY KEY(`event`, `code`),
	FOREIGN KEY (`event`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action
);
