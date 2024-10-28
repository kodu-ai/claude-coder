import * as path from "path"
import { serializeError } from "serialize-error"
import { LIST_FILES_LIMIT, listFiles } from "../../../../parse-source-code"
import { ClaudeAsk } from "../../../../shared/ExtensionMessage"
import { ToolResponse } from "../../types"
import { formatGenericToolFeedback, formatToolResponse, getReadablePath } from "../../utils"
import { AgentToolOptions, AgentToolParams } from "../types"
import { BaseAgentTool } from "../base-agent.tool"
import { AskDetails } from "../../task-executor/utils"

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

			const { response, text, images } = await ask!(
				"tool",
				{
					tool: {
						tool: "list_files",
						path: getReadablePath(relDirPath, this.cwd),
						approvalState: "pending",
						content: result,
						recursive: recursive ? "true" : "false",
						ts: this.ts,
					},
				},
				this.ts
			)

			if (response !== "yesButtonTapped") {
				this.params.updateAsk(
					"tool",
					{
						tool: {
							tool: "list_files",
							path: getReadablePath(relDirPath, this.cwd),
							approvalState: "rejected",
							recursive: recursive ? "true" : "false",
							ts: this.ts,
						},
					},
					this.ts
				)
				if (response === "messageResponse") {
					// await say("user_feedback", text, images)
					await this.params.updateAsk(
						"tool",
						{
							tool: {
								tool: "list_files",
								userFeedback: text,
								approvalState: "rejected",
								ts: this.ts,
								path: getReadablePath(relDirPath, this.cwd),
								recursive: recursive ? "true" : "false",
							},
						},
						this.ts
					)
					return formatToolResponse(formatGenericToolFeedback(text), images)
				}

				return "The user denied this operation."
			}

			this.params.updateAsk(
				"tool",
				{
					tool: {
						tool: "list_files",
						path: getReadablePath(relDirPath, this.cwd),
						approvalState: "approved",
						content: result,
						recursive: recursive ? "true" : "false",
						ts: this.ts,
					},
				},
				this.ts
			)

			return result
		} catch (error) {
			this.params.updateAsk(
				"tool",
				{
					tool: {
						tool: "list_files",
						path: getReadablePath(relDirPath, this.cwd),
						approvalState: "error",
						error: serializeError(error).message,
						ts: this.ts,
					},
				},
				this.ts
			)
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
