CREATE TABLE `ai_responses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_request_id` integer NOT NULL,
	`agent_id` text,
	`agent_name` text,
	`contents` text,
	`images` text,
	`cost` integer,
	`input_tokens` integer,
	`output_tokens` integer,
	`input_cache_read` integer,
	`input_cache_write` integer,
	`is_error` integer,
	`error_text` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`task_request_id`) REFERENCES `task_requests`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `cost_idx` ON `ai_responses` (`cost`);--> statement-breakpoint
CREATE TABLE `human_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_request_id` integer NOT NULL,
	`user_id` text,
	`user_name` text,
	`contents` text,
	`images` text,
	`files` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`task_request_id`) REFERENCES `task_requests`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
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
CREATE UNIQUE INDEX `prompt_templates_name_unique` ON `prompt_templates` (`name`);--> statement-breakpoint
CREATE INDEX `prompt_templates_name_idx` ON `prompt_templates` (`name`);--> statement-breakpoint
CREATE TABLE `request_tools` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ai_response_id` integer NOT NULL,
	`tool_id` text NOT NULL,
	`tool_name` text NOT NULL,
	`params` text NOT NULL,
	`tool_status` text NOT NULL,
	`tool_feedback` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`ai_response_id`) REFERENCES `ai_responses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `task_agents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`is_main_thread` integer NOT NULL,
	`agent_id` text NOT NULL,
	`agent_name` text NOT NULL,
	`task_id` integer NOT NULL,
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
CREATE TABLE `task_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` integer NOT NULL,
	`agent_id` text,
	`is_aborted` integer DEFAULT false NOT NULL,
	`request_started_at` integer,
	`request_ended_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`agent_id`) REFERENCES `task_agents`(`agent_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`text` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL
);
