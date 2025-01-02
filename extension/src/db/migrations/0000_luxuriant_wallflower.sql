CREATE TABLE `prompt_templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`agent_name` text NOT NULL,
	`type` text NOT NULL,
	`content` text NOT NULL,
	`enabled_tools` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `task_agents` (
	`is_main_thread` integer NOT NULL,
	`agent_id` text NOT NULL,
	`task_id` integer NOT NULL,
	`agent_name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `task_files` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` integer NOT NULL,
	`file_path` text NOT NULL,
	`file_version` integer NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `api_history` (
	`is_main_thread` integer NOT NULL,
	`agent_name` text NOT NULL,
	`agent_id` text NOT NULL,
	`task_id` integer NOT NULL,
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`role` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`is_error` integer,
	`text` text,
	`images` text,
	`files` text,
	`error_text` text,
	`is_aborted` integer DEFAULT false NOT NULL,
	`model_id` text,
	`cost` integer,
	`input_tokens` integer,
	`output_tokens` integer,
	`input_cache_read` integer,
	`input_cache_write` integer,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `cost_idx` ON `api_history` (`cost`);--> statement-breakpoint
CREATE TABLE `task_tools` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` integer NOT NULL,
	`tool_id` text NOT NULL,
	`params` text NOT NULL,
	`tool_name` text NOT NULL,
	`tool_status` text NOT NULL,
	`tool_feedback` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`text` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL
);
