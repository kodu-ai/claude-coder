// src/db/schema.ts

import { sqliteTable, integer, text, index } from "drizzle-orm/sqlite-core"
import { relations } from "drizzle-orm"
import { nanoid } from "nanoid"
import { ClaudeAsk } from "../shared/messages/extension-message"
import { SpawnAgentOptions } from "../agent/v1/tools/schema/agents/agent-spawner"
import { ApiHistoryItem } from "../agent/v1/main-agent"

/* ------------------------------------------------------------------
	 1) tasks
	 - The top-level entity your app works on.
  ------------------------------------------------------------------ */
export const tasks = sqliteTable("tasks", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	text: text("text").notNull(),
	createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
	isDeleted: integer("is_deleted", { mode: "boolean" }).notNull().default(false),
	tokensIn: integer("tokens_in").notNull().default(0),
	tokensOut: integer("tokens_out").notNull().default(0),
	cacheWrites: integer("cache_writes"),
	cacheReads: integer("cache_reads"),
	totalCost: integer("total_cost").notNull().default(0),
	name: text("name"),
	dirAbsolutePath: text("dir_absolute_path"),
	isRepoInitialized: integer("is_repo_initialized", { mode: "boolean" }).notNull().default(false),
	currentSubAgentId: integer("current_sub_agent_id"),
})

export const taskAgents = sqliteTable(
	"task_agents",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		taskId: integer("task_id").notNull(),
		isMainThread: integer("is_main_thread", { mode: "boolean" }).notNull().default(true),
		name: text("agent_name", {
			enum: SpawnAgentOptions,
		}).notNull(),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.notNull()
			.$defaultFn(() => new Date()),
		modelId: text("model_id"),
		historyErrors: text("history_errors", { mode: "json" }).$type<
			Record<
				string,
				{
					lastCheckedAt: number
					error: string
				}
			>
		>(),
		state: text("state", {
			enum: ["RUNNING", "DONE", "EXITED"],
		}).notNull(),
		systemPromptId: integer("system_prompt_id"),
		autoReminderPromptId: integer("auto_reminder_prompt_id"),
	},
	(t) => [index("task_agents_task_id_idx").on(t.taskId)]
)

export const messages = sqliteTable(
	"messages",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		taskId: integer("task_id").notNull(),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
		isDeleted: integer("is_deleted", { mode: "boolean" }).notNull().default(false),
		type: text("type", {
			enum: ["ask", "say"],
		}).notNull(),
		ask: text("ask").$type<ClaudeAsk>(),
		say: text("say").$type<string>(),
		text: text("text"),
		images: text("images", { mode: "json" }).$type<string[]>(),
		autoApproved: integer("auto_approved", { mode: "boolean" }).notNull().default(false),
		completedAt: integer("completed_at", { mode: "timestamp_ms" }),
		isAborted: text("is_aborted", {
			enum: ["user", "timeout"],
		}),
		isError: integer("is_error", { mode: "boolean" }).notNull().default(false),
		isFetching: integer("is_fetching", { mode: "boolean" }).notNull().default(false),
		agentName: text("agent_name", {
			enum: SpawnAgentOptions,
		}),
		hook: text("hook", { mode: "json" }).$type<{
			name: string
			state: "pending" | "completed" | "error"
			output: string
			input: string
		}>(),
		errorText: text("error_text"),
		isSubMessage: integer("is_sub_message", { mode: "boolean" }).notNull().default(false),
		retryCount: integer("retry_count").notNull().default(0),
		status: text("status", {
			enum: ["pending", "rejected", "approved", "error", "loading"],
		}),
		isDone: integer("is_done", { mode: "boolean" }).notNull().default(false),
		modelId: text("model_id"),
		apiMetrics: text("api_metrics", { mode: "json" }).$type<{
			cost: number
			inputTokens: number
			outputTokens: number
			inputCacheRead: number
			inputCacheWrite: number
		}>(),
	},
	(t) => [index("messages_task_id_idx").on(t.taskId), index("messages_type_idx").on(t.type)]
)

export const apiHistory = sqliteTable(
	"api_history",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		taskId: integer("task_id").notNull(),
		agentName: text("agent_name").notNull(),
		modelId: text("model_id"),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.notNull()
			.$defaultFn(() => new Date()),
		content: text("data", { mode: "json" }).$type<ApiHistoryItem["content"]>().notNull(),
		commitHash: text("commit_hash"),
		branch: text("branch"),
		preCommitHash: text("pre_commit_hash"),
	},
	(t) => [index("api_history_task_id_idx").on(t.taskId), index("api_history_agent_name_idx").on(t.agentName)]
)

export const files = sqliteTable(
	"files",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		taskId: integer("task_id").notNull(),
		content: text("content").notNull(),
		path: text("path").notNull(),
		version: integer("version").notNull(),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(t) => [index("files_task_id_idx").on(t.taskId)]
)

/* ------------------------------------------------------------------
	 8) promptTemplates (unchanged if you prefer)
  ------------------------------------------------------------------ */
export const promptTemplates = sqliteTable(
	"prompt_templates",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		name: text("name").notNull().unique(),
		agentName: text("agent_name").notNull(),
		type: text("type", {
			enum: ["auto-reminder", "system"],
		}).notNull(),
		content: text("content").notNull(),
		enabledTools: text("enabled_tools", { mode: "json" }).$type<string[]>(),

		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(t) => [index("prompt_templates_name_idx").on(t.name)]
)

/* ------------------------------------------------------------------
	 RELATIONS
  ------------------------------------------------------------------ */
// export const tasksRelations = relations(tasks, ({ many }) => ({
// 	taskRequests: many(taskRequests),
// 	taskAgents: many(taskAgents),
// 	taskFiles: many(taskFiles),
// }))

// export const taskRequestsRelations = relations(taskRequests, ({ one, many }) => ({
// 	// Each request belongs to a single Task
// 	task: one(tasks, {
// 		fields: [taskRequests.taskId],
// 		references: [tasks.id],
// 	}),
// 	// Each request can have one taksAgent (usually),
// 	agents: one(taskAgents, {
// 		fields: [taskRequests.agentId],
// 		references: [taskAgents.agentId],
// 	}),
// 	// Each request has exactly one humanMessage (usually),
// 	// but you could do "many" if you allow multiple user messages per request
// 	humanMessages: many(humanMessages),

// 	// Each request has exactly one aiResponse (usually),
// 	// but you could do "many" if there are multiple attempts
// 	aiResponses: many(aiResponses),
// }))

// export const humanMessagesRelations = relations(humanMessages, ({ one }) => ({
// 	taskRequest: one(taskRequests, {
// 		fields: [humanMessages.taskRequestId],
// 		references: [taskRequests.id],
// 	}),
// }))

// export const aiResponsesRelations = relations(aiResponses, ({ one, many }) => ({
// 	taskRequest: one(taskRequests, {
// 		fields: [aiResponses.taskRequestId],
// 		references: [taskRequests.id],
// 	}),
// 	// An AI response may propose multiple tools
// 	requestTools: many(requestTools),
// }))

// export const requestToolsRelations = relations(requestTools, ({ one }) => ({
// 	aiResponse: one(aiResponses, {
// 		fields: [requestTools.aiResponseId],
// 		references: [aiResponses.id],
// 	}),
// }))

// export const taskAgentsRelations = relations(taskAgents, ({ one, many }) => ({
// 	task: one(tasks, {
// 		fields: [taskAgents.taskId],
// 		references: [tasks.id],
// 	}),
// 	requests: many(taskRequests),
// }))

// export const taskFilesRelations = relations(taskFiles, ({ one }) => ({
// 	task: one(tasks, {
// 		fields: [taskFiles.taskId],
// 		references: [tasks.id],
// 	}),
// }))
