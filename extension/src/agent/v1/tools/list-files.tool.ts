import * as path from "path"
import { serializeError } from "serialize-error"
import { LIST_FILES_LIMIT, listFiles } from "../../../parse-source-code"
import { ClaudeAsk, ClaudeSay, ClaudeSayTool } from "../../../shared/ExtensionMessage"
import { ToolResponse } from "../types"
import { formatGenericToolFeedback, formatToolResponse, getReadablePath } from "../utils"
import { AgentToolOptions, AgentToolParams } from "./types"
import { BaseAgentTool } from "./base-agent.tool"

export class ListFilesTool extends BaseAgentTool {
	protected params: AgentToolParams

	constructor(params: AgentToolParams, options: AgentToolOptions) {
		super(options)
		this.params = params
	}

	async execute(): Promise<ToolResponse> {
		const { input, ask, say } = this.params
		const { path: relDirPath, recursive: recursiveRaw } = input

		if (relDirPath === undefined) {
			await say(
				"error",
				"Claude tried to use list_files without value for required parameter 'path'. Retrying..."
			)
			return `Error: Missing value for required parameter 'path'. Please retry with complete response.
						A good example of a listFiles tool call is:
			{
				"tool": "list_files",
				"path": "path/to/directory"
			}
			Please try again with the correct path, you are not allowed to list files without a path.
			`
		}

		try {
			const recursive = recursiveRaw?.toLowerCase() === "true"
			const absolutePath = path.resolve(this.cwd, relDirPath)
			const files = await listFiles(absolutePath, recursive, 200)
			const result = this.formatFilesList(absolutePath, files[0])

			const message = JSON.stringify({
				tool: recursive ? "listFilesRecursive" : "listFilesTopLevel",
				path: getReadablePath(relDirPath, this.cwd),
				content: result,
			} as ClaudeSayTool)

			if (this.alwaysAllowReadOnly) {
				await say("tool", message)
			} else {
				const { response, text, images } = await ask("tool", message)

				if (response !== "yesButtonTapped") {
					if (response === "messageResponse") {
						await say("user_feedback", text, images)
						return formatToolResponse(formatGenericToolFeedback(text), images)
					}

					return "The user denied this operation."
				}
			}

			return result
		} catch (error) {
			const errorString = `Error listing files and directories: ${JSON.stringify(serializeError(error))}`
			await say(
				"error",
				`Error listing files and directories:\n${
					(error as Error).message ?? JSON.stringify(serializeError(error), null, 2)
				}`
			)

			return errorString
		}
	}

	async listFilesTopLevel(
		relDirPath: string | undefined,
		ask: (type: ClaudeAsk, question?: string) => Promise<{ response: string; text?: string; images?: string[] }>,
		say: (type: ClaudeSay, text?: string, images?: string[]) => void
	): Promise<ToolResponse> {
		if (relDirPath === undefined) {
			await say(
				"error",
				"Claude tried to use list_files_top_level without value for required parameter 'path'. Retrying..."
			)

			return `Error: Missing value for required parameter 'path'. Please retry with complete response.
			An example of a good listFilesTopLevel tool call is:
			{
				"tool": "list_files_top_level",
				"path": "path/to/directory"
			}
			Please try again with the correct path, you are not allowed to list files without a path.
			`
		}
		try {
			const absolutePath = path.resolve(this.cwd, relDirPath)
			const files = await listFiles(absolutePath, false, 200)
			const result = this.formatFilesList(absolutePath, files[0])

			const message = JSON.stringify({
				tool: "listFilesTopLevel",
				path: getReadablePath(relDirPath, this.cwd),
				content: result,
			} as ClaudeSayTool)
			if (this.alwaysAllowReadOnly) {
				await say("tool", message)
			} else {
				const { response, text, images } = await ask("tool", message)

				if (response !== "yesButtonTapped") {
					if (response === "messageResponse") {
						await say("user_feedback", text, images)
						return formatToolResponse(formatGenericToolFeedback(text), images)
					}

					return "The user denied this operation."
				}
			}

			return result
		} catch (error) {
			const errorString = `Error listing files and directories: ${JSON.stringify(serializeError(error))}`
			await say(
				"error",
				`Error listing files and directories:\n${
					(error as Error).message ?? JSON.stringify(serializeError(error), null, 2)
				}`
			)

			return errorString
		}
	}

	async listFilesRecursive(
		relDirPath: string | undefined,
		ask: (type: ClaudeAsk, question?: string) => Promise<{ response: string; text?: string; images?: string[] }>,
		say: (type: ClaudeSay, text?: string, images?: string[]) => void
	): Promise<ToolResponse> {
		if (relDirPath === undefined) {
			await say(
				"error",
				"Claude tried to use list_files_recursive without value for required parameter 'path'. Retrying..."
			)

			return `Error: Missing value for required parameter 'path'. Please retry with complete response.
			An example of a good listFilesRecursive tool call is:
			{
				"tool": "list_files_recursive",
				"path": "path/to/directory"
			}
			Please try again with the correct path, you are not allowed to list files without a path.
			`
		}

		try {
			const absolutePath = path.resolve(this.cwd, relDirPath)
			const files = await listFiles(absolutePath, true, 200)
			const result = this.formatFilesList(absolutePath, files[0])

			const message = JSON.stringify({
				tool: "listFilesRecursive",
				path: getReadablePath(relDirPath, this.cwd),
				content: result,
			} as ClaudeSayTool)
			if (this.alwaysAllowReadOnly) {
				await say("tool", message)
			} else {
				const { response, text, images } = await ask("tool", message)
				if (response !== "yesButtonTapped") {
					if (response === "messageResponse") {
						await say("user_feedback", text, images)
						return formatToolResponse(formatGenericToolFeedback(text), images)
					}

					return "The user denied this operation."
				}
			}

			return result
		} catch (error) {
			const errorString = `Error listing files recursively: ${JSON.stringify(serializeError(error))}`
			await say(
				"error",
				`Error listing files recursively:\n${
					(error as Error).message ?? JSON.stringify(serializeError(error), null, 2)
				}`
			)

			return errorString
		}
	}

	formatFilesList(absolutePath: string, files: string[]): string {
		const sorted = files
			.map((file) => {
				// convert absolute path to relative path
				const relativePath = path.relative(absolutePath, file)
				return file.endsWith("/") ? relativePath + "/" : relativePath
			})
			// Sort so files are listed under their respective directories to make it clear what files are children of what directories. Since we build file list top down, even if file list is truncated it will show directories that claude can then explore further.
			.sort((a, b) => {
				const aParts = a.split("/")
				const bParts = b.split("/")
				for (let i = 0; i < Math.min(aParts.length, bParts.length); i++) {
					if (aParts[i] !== bParts[i]) {
						// If one is a directory and the other isn't at this level, sort the directory first
						if (i + 1 === aParts.length && i + 1 < bParts.length) {
							return -1
						}
						if (i + 1 === bParts.length && i + 1 < aParts.length) {
							return 1
						}
						// Otherwise, sort alphabetically
						return aParts[i].localeCompare(bParts[i], undefined, { numeric: true, sensitivity: "base" })
					}
				}
				// If all parts are the same up to the length of the shorter path,
				// the shorter one comes first
				return aParts.length - bParts.length
			})
		if (sorted.length >= LIST_FILES_LIMIT) {
			const truncatedList = sorted.slice(0, LIST_FILES_LIMIT).join("\n")
			return `${truncatedList}\n\n(Truncated at ${LIST_FILES_LIMIT} results. Try listing files in subdirectories if you need to explore further.)`
		} else if (sorted.length === 0 || (sorted.length === 1 && sorted[0] === "")) {
			return "No files found or you do not have permission to view this directory."
		} else {
			return sorted.join("\n")
		}
	}
}
