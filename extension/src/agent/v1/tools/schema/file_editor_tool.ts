// schema/file_editor_tool.ts
import { z } from "zod"

export const FileEditorModes = ["edit", "whole_write", "rollback"] as const

const schema = z.object({
	path: z.string().describe("The path of the file to write to (relative to the current working directory)."),
	mode: z.preprocess((val) => {
		// Ensure that val is a string before passing it to the enum validator
		if (typeof val === "string") {
			return val
		}
		return undefined // This will fail the enum check if not a string
	}, z.enum(FileEditorModes).describe("The mode of the file editor tool.")),
	commit_message: z.string().optional().describe("The commit message to use when committing changes to the file."),
	kodu_content: z
		.string()
		.describe(
			"The full content to write to the file when creating a new file. Always provide the complete content without any truncation."
		)
		.optional(),
	kodu_diff: z
		.string()
		.describe(
			"The `SEARCH/REPLACE` blocks representing the changes to be made to an existing file. These blocks must be formatted correctly, matching exact existing content for `SEARCH` and precise modifications for `REPLACE`."
		)
		.optional(),
})

const examples = [""]

export const fileEditorTool = {
	schema: {
		name: "file_editor",
		schema,
	},
	examples,
}

export type FileEditorToolParams = {
	name: "file_editor"
	input: z.infer<typeof schema>
}
