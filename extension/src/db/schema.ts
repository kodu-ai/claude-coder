// src/db/schema.ts

import { sqliteTable, integer, text, index } from "drizzle-orm/sqlite-core"
import { relations } from "drizzle-orm"
import { nanoid } from "nanoid"

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
})

/* ------------------------------------------------------------------
	 2) taskRequests
	 - Each time the user (human) and AI exchange a pair of messages.
	 - For convenience, you can store the "request start" and "request end" 
	   times and an isAborted flag here if you like. 
  ------------------------------------------------------------------ */
export const taskRequests = sqliteTable("task_requests", {
	id: integer("id").primaryKey({ autoIncrement: true }),

	// Link back to the parent Task
	taskId: integer("task_id")
		.notNull()
		.references(() => tasks.id),

	// agent name and ID (both optional)
	agentId: text("agent_id").references(() => taskAgents.agentId),

	isAborted: integer("is_aborted", { mode: "boolean" }).notNull().default(false),

	requestStartedAt: integer("request_started_at", { mode: "timestamp_ms" }),
	requestEndedAt: integer("request_ended_at", { mode: "timestamp_ms" }),

	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" })
		.notNull()
		.$defaultFn(() => new Date()),
})

/* ------------------------------------------------------------------
	 3) humanMessages
	 - The user's input for a given request.
	 - The user may send multiple lines of text, multiple images, etc.
	 - We store them in JSON arrays or separate rows. This example uses
	   JSON arrays (content[] and images[]).
  ------------------------------------------------------------------ */
export const humanMessages = sqliteTable("human_messages", {
	id: integer("id").primaryKey({ autoIncrement: true }),

	// Link to the task request
	taskRequestId: integer("task_request_id")
		.notNull()
		.references(() => taskRequests.id),

	// If you want to track the user’s name/ID, store it here
	userId: text("user_id"),
	userName: text("user_name"),

	// We can store multiple text chunks in a JSON array
	contents: text("contents", { mode: "json" }).$type<string[]>(),
	images: text("images", { mode: "json" }).$type<string[]>(),

	// If the user can attach files in the message:
	files: text("files", { mode: "json" }).$type<
		{
			filePath: string
			fileContent: string
		}[]
	>(),

	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.notNull()
		.$defaultFn(() => new Date()),
})

/* ------------------------------------------------------------------
	 4) aiResponses
	 - The AI's answer for a given request, including text/images plus
	   cost metrics like tokens, cost, etc.
  ------------------------------------------------------------------ */
export const aiResponses = sqliteTable(
	"ai_responses",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),

		// Link to the task request
		taskRequestId: integer("task_request_id")
			.notNull()
			.references(() => taskRequests.id),

		// If you have multiple agents, store them here
		agentId: text("agent_id"),
		agentName: text("agent_name"),

		// The AI can also return multiple lines of text or images
		contents: text("contents", { mode: "json" }).$type<string[]>(),
		images: text("images", { mode: "json" }).$type<string[]>(),

		// Cost / token metrics
		cost: integer("cost"),
		inputTokens: integer("input_tokens"),
		outputTokens: integer("output_tokens"),

		// Additional caching or logging data
		inputCacheRead: integer("input_cache_read"),
		inputCacheWrite: integer("input_cache_write"),

		// In case of errors
		isError: integer("is_error", { mode: "boolean" }),
		errorText: text("error_text"),

		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	// Example index if you want to index cost or tokens
	(t) => [index("cost_idx").on(t.cost)]
)

/* ------------------------------------------------------------------
	 5) requestTools
	 - Tools proposed by the AI in the aiResponses table.
	 - A single AI response can propose multiple tools.
	 - The next human message can accept or reject them.
  ------------------------------------------------------------------ */
export const requestTools = sqliteTable("request_tools", {
	id: integer("id").primaryKey({ autoIncrement: true }),

	// Link to the AI response that proposed these tools
	aiResponseId: integer("ai_response_id")
		.notNull()
		.references(() => aiResponses.id),

	toolId: text("tool_id").notNull(),
	toolName: text("tool_name").notNull(),

	// JSON string for parameter details
	params: text("params").notNull(),

	/**
	 * Possible statuses:
	 *   - "pending": waiting for user action
	 *   - "approved": user accepted
	 *   - "rejected": user rejected
	 *   - ...
	 */
	toolStatus: text("tool_status", {
		enum: ["pending", "rejected", "approved", "error", "loading", "approve+feedback", "reject+feedback"],
	}).notNull(),

	// Any feedback from the user
	toolFeedback: text("tool_feedback"),

	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.notNull()
		.$defaultFn(() => new Date()),
})

/* ------------------------------------------------------------------
	 6) (Optional) If you still want to track multiple agents
	 at the Task level, rather than per AI response:
  ------------------------------------------------------------------ */
export const taskAgents = sqliteTable("task_agents", {
	id: integer("id").primaryKey({ autoIncrement: true }),

	isMainThread: integer("is_main_thread", { mode: "boolean" }).notNull(),

	agentId: text("agent_id")
		.notNull()
		.$default(() => nanoid()),
	agentName: text("agent_name").notNull(),

	taskId: integer("task_id")
		.notNull()
		.references(() => tasks.id),

	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" })
		.notNull()
		.$defaultFn(() => new Date()),
})

/* ------------------------------------------------------------------
	 7) (Optional) If you still want to store files at the Task level
	 rather than in a single message
  ------------------------------------------------------------------ */
export const taskFiles = sqliteTable("task_files", {
	id: integer("id").primaryKey({ autoIncrement: true }),

	taskId: integer("task_id")
		.notNull()
		.references(() => tasks.id),

	filePath: text("file_path").notNull(),
	fileVersion: integer("file_version").notNull(),
	content: text("content").notNull(),

	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.notNull()
		.$defaultFn(() => new Date()),
})

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
export const tasksRelations = relations(tasks, ({ many }) => ({
	taskRequests: many(taskRequests),
	taskAgents: many(taskAgents),
	taskFiles: many(taskFiles),
}))

export const taskRequestsRelations = relations(taskRequests, ({ one, many }) => ({
	// Each request belongs to a single Task
	task: one(tasks, {
		fields: [taskRequests.taskId],
		references: [tasks.id],
	}),
	// Each request can have one taksAgent (usually),
	agents: one(taskAgents, {
		fields: [taskRequests.agentId],
		references: [taskAgents.agentId],
	}),
	// Each request has exactly one humanMessage (usually),
	// but you could do "many" if you allow multiple user messages per request
	humanMessages: many(humanMessages),

	// Each request has exactly one aiResponse (usually),
	// but you could do "many" if there are multiple attempts
	aiResponses: many(aiResponses),
}))

export const humanMessagesRelations = relations(humanMessages, ({ one }) => ({
	taskRequest: one(taskRequests, {
		fields: [humanMessages.taskRequestId],
		references: [taskRequests.id],
	}),
}))

export const aiResponsesRelations = relations(aiResponses, ({ one, many }) => ({
	taskRequest: one(taskRequests, {
		fields: [aiResponses.taskRequestId],
		references: [taskRequests.id],
	}),
	// An AI response may propose multiple tools
	requestTools: many(requestTools),
}))

export const requestToolsRelations = relations(requestTools, ({ one }) => ({
	aiResponse: one(aiResponses, {
		fields: [requestTools.aiResponseId],
		references: [aiResponses.id],
	}),
}))

export const taskAgentsRelations = relations(taskAgents, ({ one, many }) => ({
	task: one(tasks, {
		fields: [taskAgents.taskId],
		references: [tasks.id],
	}),
	requests: many(taskRequests),
}))

export const taskFilesRelations = relations(taskFiles, ({ one }) => ({
	task: one(tasks, {
		fields: [taskFiles.taskId],
		references: [tasks.id],
	}),
}))
