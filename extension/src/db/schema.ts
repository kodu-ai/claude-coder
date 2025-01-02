// src/db/schema.ts
import { sqliteTable, integer, text, index, foreignKey } from "drizzle-orm/sqlite-core"
import { relations } from "drizzle-orm"
import { nanoid } from "nanoid"

// For Task
export const tasks = sqliteTable("tasks", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	text: text("text").notNull(),
	createdAt: integer("created_at", {
		mode: "timestamp_ms",
	}).notNull(),
	updatedAt: integer("updated_at", {
		mode: "timestamp_ms",
	}).notNull(),
	isDeleted: integer("is_deleted", {
		mode: "boolean",
	})
		.notNull()
		.default(false),
})

// For TaskAgents
export const taskAgents = sqliteTable("task_agents", {
	isMainThread: integer("is_main_thread", {
		mode: "boolean",
	}).notNull(),
	agentId: text("agent_id")
		.notNull()
		.$default(() => nanoid()),
	taskId: integer("task_id")
		.notNull()
		.references(() => tasks.id),
	agentName: text("agent_name").notNull(),
	createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
})

// For TaskRequest
export const taskRequests = sqliteTable(
	"api_history",
	{
		isMainThread: integer("is_main_thread", {
			mode: "boolean",
		}).notNull(),
		agentName: text("agent_name").notNull(),
		agentId: text("agent_id").notNull(),
		taskId: integer("task_id")
			.notNull()
			.references(() => tasks.id),
		id: integer("id").primaryKey({ autoIncrement: true }),
		role: text("role", {
			enum: ["user", "assistant"],
		}),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
		isError: integer("is_error", {
			mode: "boolean",
		}),
		text: text("text"),
		/**
		 * base64 encoded image
		 */
		images: text("images", {
			mode: "json",
		}).$type<string[]>(),
		files: text("files", {
			mode: "json",
		}).$type<
			{
				filePath: string
				fileContent: string
			}[]
		>(),
		errorText: text("error_text"),
		isAborted: integer("is_aborted", {
			mode: "boolean",
		})
			.notNull()
			.default(false),
		modelId: text("model_id"),
		cost: integer("cost"),
		inputTokens: integer("input_tokens"),
		outputTokens: integer("output_tokens"),
		inputCacheRead: integer("input_cache_read"),
		inputCacheWrite: integer("input_cache_write"),
	},
	(t) => [index("cost_idx").on(t.cost)]
)

// For TaskFiles
export const taskFiles = sqliteTable("task_files", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	taskId: integer("task_id")
		.notNull()
		.references(() => tasks.id),
	filePath: text("file_path").notNull(),
	fileVersion: integer("file_version").notNull(),
	content: text("content").notNull(),
	createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
})

// For TaskTools
export const taskTools = sqliteTable("task_tools", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	taskId: integer("task_id")
		.notNull()
		.references(() => tasks.id),
	toolId: text("tool_id").notNull(),
	/**
	 * JSON stringified object
	 */
	params: text("params").notNull(),
	/**
	 * The name of the tool
	 */
	toolName: text("tool_name").notNull(),
	toolStatus: text("tool_status", {
		enum: ["pending", "rejected", "approved", "error", "loading", "approve+feedback", "reject+feedback"],
	}).notNull(),
	toolFeedback: text("tool_feedback"),
	createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
})

// For PromptTemplates
export const promptTemplates = sqliteTable("prompt_templates", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	name: text("name").notNull(),
	agentName: text("agent_name").notNull(),
	type: text("type", {
		enum: ["auto-reminder", "system"],
	}).notNull(),
	content: text("content").notNull(),
	enabledTools: text("enabled_tools", {
		mode: "json",
	}).$type<string[]>(),
	createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
})

// Define relationships
export const tasksRelations = relations(tasks, ({ many }) => ({
	taskAgents: many(taskAgents),
	taskRequests: many(taskRequests),
}))

export const taskAgentsRelations = relations(taskAgents, ({ one }) => ({
	task: one(tasks, {
		fields: [taskAgents.taskId],
		references: [tasks.id],
	}),
}))

export const taskRequestsRelations = relations(taskRequests, ({ one }) => ({
	task: one(tasks, {
		fields: [taskRequests.taskId],
		references: [tasks.id],
	}),
}))

export const taskFilesRelations = relations(taskFiles, ({ one }) => ({
	task: one(tasks, {
		fields: [taskFiles.taskId],
		references: [tasks.id],
	}),
}))

export const taskToolsRelations = relations(taskTools, ({ one }) => ({
	task: one(tasks, {
		fields: [taskTools.taskId],
		references: [tasks.id],
	}),
}))
