import { Anthropic } from "@anthropic-ai/sdk"
import * as diff from "diff"
import { execa, ExecaError, ResultPromise } from "execa"
import fs from "fs/promises"
import * as path from "path"
import { serializeError } from "serialize-error"
import treeKill from "tree-kill"
import * as vscode from "vscode"
import { LIST_FILES_LIMIT, listFiles, parseSourceCodeForDefinitionsTopLevel } from "../../parse-source-code"
import { ClaudeAsk, ClaudeSay, ClaudeSayTool } from "../../shared/ExtensionMessage"
import { ToolName } from "../../shared/Tool"
import { ToolResponse } from "../types"
import { COMMAND_OUTPUT_DELAY } from "../constants"
import {
	formatFilesList,
	formatGenericToolFeedback,
	formatToolResponse,
	getPotentiallyRelevantDetails,
	getReadablePath,
} from "../utils"
import delay from "delay"
import os from "os"
import { ClaudeAskResponse } from "../../shared/WebviewMessage"
import { extractTextFromFile } from "../../utils/extract-text"
import { regexSearchFiles } from "../../utils/ripgrep"
import { COMMAND_STDIN_STRING } from "../../shared/combineCommandSequences"
import { findLastIndex } from "../../utils"
import { KoduDev } from "."

type ToolExecutorOptions = {
	cwd: string
	alwaysAllowReadOnly: boolean
	alwaysAllowWriteOnly: boolean
	koduDev: KoduDev
}

export class ToolExecutor {
	private cwd: string
	private alwaysAllowReadOnly: boolean
	private alwaysAllowWriteOnly: boolean
	private executeCommandRunningProcess?: ResultPromise
	private koduDev: KoduDev

	constructor(options: ToolExecutorOptions) {
		this.cwd = options.cwd
		this.alwaysAllowReadOnly = options.alwaysAllowReadOnly
		this.alwaysAllowWriteOnly = options.alwaysAllowWriteOnly
		this.koduDev = options.koduDev
	}

	setAlwaysAllowReadOnly(value: boolean) {
		this.alwaysAllowReadOnly = value
	}
	setAlwaysAllowWriteOnly(value: boolean) {
		this.alwaysAllowWriteOnly = value
	}

	async executeTool(
		toolName: ToolName,
		toolInput: any,
		isLastWriteToFile: boolean = false,
		ask: (
			type: ClaudeAsk,
			question?: string
		) => Promise<{ response: ClaudeAskResponse; text?: string; images?: string[] }>,
		say: (type: ClaudeSay, text?: string, images?: string[]) => void
	): Promise<ToolResponse> {
		switch (toolName) {
			case "write_to_file":
				return this.writeToFile(toolInput.path, toolInput.content, ask, say)
			case "read_file":
				return this.readFile(toolInput.path, ask, say)
			case "list_files":
				return this.listFiles(toolInput.path, toolInput.recursive, ask, say)
			case "search_files":
				return this.searchFiles(toolInput.path, toolInput.regex, toolInput.filePattern, ask, say)
			case "list_code_definition_names":
				return this.listCodeDefinitionNames(toolInput.path, ask, say)
			// return this.viewSourceCodeDefinitionsTopLevel(toolInput.path, ask, say)
			case "execute_command":
				return this.executeCommand(toolInput.command, ask, say)
			case "ask_followup_question":
				return this.askFollowupQuestion(toolInput.question, ask, say)
			case "attempt_completion":
				return this.attemptCompletion(toolInput.result, toolInput.command, ask, say)
			default:
				return `Unknown tool: ${toolName}`
		}
	}

	async searchFiles(
		relDirPath: string | undefined,
		regex: string | undefined,
		filePattern: string | undefined,
		ask: (
			type: ClaudeAsk,
			question?: string
		) => Promise<{ response: ClaudeAskResponse; text?: string; images?: string[] }>,
		say: (type: ClaudeSay, text?: string, images?: string[]) => void
	): Promise<ToolResponse> {
		if (relDirPath === undefined) {
			await say(
				"error",
				"Claude tried to use search_files without value for required parameter 'path'. Retrying..."
			)
			return "Error: Missing value for required parameter 'path'. Please retry with complete response."
		}

		if (regex === undefined) {
			await say(
				"error",
				"Claude tried to use search_files without value for required parameter 'regex'. Retrying..."
			)
			return "Error: Missing value for required parameter 'regex'. Please retry with complete response."
		}

		try {
			const absolutePath = path.resolve(this.cwd, relDirPath)
			const results = await regexSearchFiles(this.cwd, absolutePath, regex, filePattern)

			const message = JSON.stringify({
				tool: "searchFiles",
				path: getReadablePath(relDirPath, this.cwd),
				regex: regex,
				filePattern: filePattern,
				content: results,
			} as ClaudeSayTool)

			if (this.alwaysAllowReadOnly) {
				await say("tool", message)
				return results
			} else {
				const { response, text, images } = await ask("tool", message)
				if (response !== "yesButtonTapped") {
					if (response === "messageResponse") {
						await say("user_feedback", text, images)
						return formatToolResponse(formatGenericToolFeedback(text), images)
					}
					return "The user denied this operation."
				}
				return results
			}
		} catch (error) {
			const errorString = `Error searching files: ${JSON.stringify(serializeError(error))}`
			await say(
				"error",
				`Error searching files:\n${(error as Error).message ?? JSON.stringify(serializeError(error), null, 2)}`
			)
			return errorString
		}
	}

	createPrettyPatch(filename = "file", oldStr: string, newStr: string) {
		const patch = diff.createPatch(filename, oldStr, newStr)
		const lines = patch.split("\n")
		const prettyPatchLines = lines.slice(4)
		return prettyPatchLines.join("\n")
	}

	async writeToFile(
		relPath: string | undefined,
		newContent: string | undefined,
		ask: (
			type: ClaudeAsk,
			question?: string
		) => Promise<{ response: ClaudeAskResponse; text?: string; images?: string[] }>,
		say: (type: ClaudeSay, text?: string, images?: string[]) => void
	): Promise<ToolResponse> {
		if (relPath === undefined) {
			await say(
				"error",
				"Claude tried to use write_to_file without value for required parameter 'path'. Retrying..."
			)
			return "Error: Missing value for required parameter 'path'. Please retry with complete response."
		}

		if (newContent === undefined) {
			await say(
				"error",
				`Claude tried to use write_to_file for '${relPath}' without value for required parameter 'content'. This is likely due to output token limits. Retrying...`
			)
			return "Error: Missing value for required parameter 'content'. Please retry with complete response."
		}

		try {
			const absolutePath = path.resolve(this.cwd, relPath)
			const fileExists = await fs
				.access(absolutePath)
				.then(() => true)
				.catch(() => false)

			let originalContent: string = fileExists ? await fs.readFile(absolutePath, "utf-8") : ""

			if (fileExists) {
				const eol = originalContent.includes("\r\n") ? "\r\n" : "\n"
				if (originalContent.endsWith(eol) && !newContent.endsWith(eol)) {
					newContent += eol
				}
			}

			if (this.alwaysAllowWriteOnly) {
				return await this.writeFileDirectly(absolutePath, newContent, fileExists, relPath, say)
			} else {
				return await this.writeFileWithUserApproval(
					absolutePath,
					originalContent,
					newContent,
					fileExists,
					relPath,
					ask,
					say
				)
			}
		} catch (error) {
			const errorString = `Error writing file: ${JSON.stringify(serializeError(error))}`
			await say(
				"error",
				`Error writing file:\n${(error as Error).message ?? JSON.stringify(serializeError(error), null, 2)}`
			)
			return errorString
		}
	}

	private async writeFileDirectly(
		absolutePath: string,
		newContent: string,
		fileExists: boolean,
		relPath: string,
		say: (type: ClaudeSay, text?: string, images?: string[]) => void
	): Promise<ToolResponse> {
		if (!fileExists) {
			await fs.mkdir(path.dirname(absolutePath), { recursive: true })
		}
		await fs.writeFile(absolutePath, newContent)
		await vscode.window.showTextDocument(vscode.Uri.file(absolutePath), { preview: false })

		if (fileExists) {
			const { text, images } = {
				text: `Changes applied to ${relPath}:\n\n${this.createPrettyPatch(relPath, "", newContent)}`,
				images: [],
			}
			await say("user_feedback", text)
			return formatToolResponse(formatGenericToolFeedback(text), images)
		} else {
			const { text, images } = { text: `New file written to ${relPath}`, images: [] }
			await say("user_feedback", text)
			return formatToolResponse(formatGenericToolFeedback(text), images)
		}
	}

	private async writeFileWithUserApproval(
		absolutePath: string,
		originalContent: string,
		newContent: string,
		fileExists: boolean,
		relPath: string,
		ask: (
			type: ClaudeAsk,
			question?: string
		) => Promise<{ response: ClaudeAskResponse; text?: string; images?: string[] }>,
		say: (type: ClaudeSay, text?: string, images?: string[]) => void
	): Promise<ToolResponse> {
		const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "claude-dev-"))
		const tempFilePath = path.join(tempDir, path.basename(absolutePath))
		await fs.writeFile(tempFilePath, newContent)

		vscode.commands.executeCommand(
			"vscode.diff",
			vscode.Uri.parse(`claude-dev-diff:${path.basename(absolutePath)}`).with({
				query: Buffer.from(originalContent).toString("base64"),
			}),
			vscode.Uri.file(tempFilePath),
			`${path.basename(absolutePath)}: ${fileExists ? "Original ↔ Claude's Changes" : "New File"} (Editable)`
		)
		const userResponse = await ask(
			"tool",
			JSON.stringify({
				tool: fileExists ? "editedExistingFile" : "newFileCreated",
				path: getReadablePath(relPath, this.cwd),
				[fileExists ? "diff" : "content"]: fileExists
					? this.createPrettyPatch(relPath, originalContent, newContent)
					: newContent,
			} as ClaudeSayTool)
		)

		const { response, text, images } = userResponse

		const diffDocument = vscode.workspace.textDocuments.find((doc) => doc.uri.fsPath === tempFilePath)
		if (diffDocument && diffDocument.isDirty) {
			await diffDocument.save()
		}

		if (response !== "yesButtonTapped") {
			await this.closeDiffViews()
			try {
				await fs.rm(tempDir, { recursive: true, force: true })
			} catch (error) {
				console.error(`Error deleting temporary directory: ${error}`)
			}
			if (response === "messageResponse") {
				await say("user_feedback", text, images)
				return formatToolResponse(formatGenericToolFeedback(text), images)
			}
			return "The user denied this operation."
		}

		const editedContent = await fs.readFile(tempFilePath, "utf-8")
		if (!fileExists) {
			await fs.mkdir(path.dirname(absolutePath), { recursive: true })
		}
		await fs.writeFile(absolutePath, editedContent)

		try {
			await fs.rm(tempDir, { recursive: true, force: true })
		} catch (error) {
			console.error(`Error deleting temporary directory: ${error}`)
		}

		await vscode.window.showTextDocument(vscode.Uri.file(absolutePath), { preview: false })
		await this.closeDiffViews()

		if (editedContent !== newContent) {
			const diffResult = diff.createPatch(relPath, originalContent, editedContent)
			const userDiff = diff.createPatch(relPath, newContent, editedContent)
			await say(
				"user_feedback_diff",
				JSON.stringify({
					tool: fileExists ? "editedExistingFile" : "newFileCreated",
					path: getReadablePath(relPath, this.cwd),
					diff: this.createPrettyPatch(relPath, newContent, editedContent),
				} as ClaudeSayTool)
			)
			return `The user accepted but made the following changes to your content:\n\n${userDiff}\n\nFinal result ${
				fileExists ? "applied to" : "written as new file"
			} ${relPath}:\n\n${diffResult}`
		} else {
			const diffResult = diff.createPatch(relPath, originalContent, newContent)
			return `${
				fileExists ? `Changes applied to ${relPath}:\n\n${diffResult}` : `New file written to ${relPath}`
			}`
		}
	}

	async closeDiffViews() {
		const tabs = vscode.window.tabGroups.all
			.map((tg) => tg.tabs)
			.flat()
			.filter(
				(tab) =>
					tab.input instanceof vscode.TabInputTextDiff &&
					tab.input?.modified?.scheme === "claude-dev-experimental"
			)
		for (const tab of tabs) {
			await vscode.window.tabGroups.close(tab)
		}
	}

	async readFile(
		relPath: string | undefined,
		ask: (type: ClaudeAsk, question?: string) => Promise<{ response: string; text?: string; images?: string[] }>,
		say: (type: ClaudeSay, text?: string, images?: string[]) => void
	): Promise<ToolResponse> {
		if (relPath === undefined) {
			await say("error", "Claude tried to use read_file without value for required parameter 'path'. Retrying...")
			return "Error: Missing value for required parameter 'path'. Please retry with complete response."
		}
		try {
			const absolutePath = path.resolve(this.cwd, relPath)
			const content = await extractTextFromFile(absolutePath)

			const message = JSON.stringify({
				tool: "readFile",
				path: getReadablePath(relPath, this.cwd),
				content,
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

			return content
		} catch (error) {
			const errorString = `Error reading file: ${JSON.stringify(serializeError(error))}`
			await say(
				"error",
				`Error reading file:\n${(error as Error).message ?? JSON.stringify(serializeError(error), null, 2)}`
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

	async listFiles(
		relDirPath: string | undefined,
		recursiveRaw: string | undefined,
		ask: (
			type: ClaudeAsk,
			question?: string
		) => Promise<{ response: ClaudeAskResponse; text?: string; images?: string[] }>,
		say: (type: ClaudeSay, text?: string, images?: string[]) => void
	): Promise<ToolResponse> {
		if (relDirPath === undefined) {
			await say(
				"error",
				"Claude tried to use list_files without value for required parameter 'path'. Retrying..."
			)
			return "Error: Missing value for required parameter 'path'. Please retry with complete response."
		}

		try {
			const recursive = recursiveRaw?.toLowerCase() === "true"
			const absolutePath = path.resolve(this.cwd, relDirPath)
			const files = await listFiles(absolutePath, recursive)
			const result = formatFilesList(absolutePath, files)

			const message = JSON.stringify({
				tool: recursive ? "listFilesRecursive" : "listFilesTopLevel",
				path: getReadablePath(relDirPath, this.cwd),
				content: result,
			} as ClaudeSayTool)

			if (this.alwaysAllowReadOnly) {
				await say("tool", message)
				return result
			} else {
				const { response, text, images } = await ask("tool", message)
				if (response !== "yesButtonTapped") {
					if (response === "messageResponse") {
						await say("user_feedback", text, images)
						return formatToolResponse(formatGenericToolFeedback(text), images)
					}
					return "The user denied this operation."
				}
				return result
			}
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
			return "Error: Missing value for required parameter 'path'. Please retry with complete response."
		}
		try {
			const absolutePath = path.resolve(this.cwd, relDirPath)
			const files = await listFiles(absolutePath, false)
			const result = formatFilesList(absolutePath, files)

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
			return "Error: Missing value for required parameter 'path'. Please retry with complete response."
		}
		try {
			const absolutePath = path.resolve(this.cwd, relDirPath)
			const files = await listFiles(absolutePath, true)
			const result = formatFilesList(absolutePath, files)

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

	async listCodeDefinitionNames(
		relDirPath: string | undefined,
		ask: (type: ClaudeAsk, question?: string) => Promise<{ response: string; text?: string; images?: string[] }>,
		say: (type: ClaudeSay, text?: string, images?: string[]) => void
	): Promise<ToolResponse> {
		if (relDirPath === undefined) {
			await say(
				"error",
				"Claude tried to use list_code_definition_names without value for required parameter 'path'. Retrying..."
			)
			return "Error: Missing value for required parameter 'path'. Please retry with complete response."
		}
		try {
			const absolutePath = path.resolve(this.cwd, relDirPath)
			const result = await parseSourceCodeForDefinitionsTopLevel(absolutePath)

			const message = JSON.stringify({
				tool: "listCodeDefinitionNames",
				path: getReadablePath(relDirPath),
				content: result,
			} as ClaudeSayTool)
			if (this.alwaysAllowReadOnly) {
				await say("tool", message)
			} else {
				const { response, text, images } = await ask("tool", message)
				if (response !== "yesButtonTapped") {
					if (response === "messageResponse") {
						await say("user_feedback", text, images)
						return formatToolResponse(await formatGenericToolFeedback(text), images)
					}
					return "The user denied this operation."
				}
			}

			return result
		} catch (error) {
			const errorString = `Error parsing source code definitions: ${JSON.stringify(serializeError(error))}`
			await say(
				"error",
				`Error parsing source code definitions:\n${
					error.message ?? JSON.stringify(serializeError(error), null, 2)
				}`
			)
			return errorString
		}
	}

	async executeCommand(
		command: string | undefined,
		ask: (type: ClaudeAsk, question?: string) => Promise<{ response: string; text?: string; images?: string[] }>,
		say: (type: ClaudeSay, text?: string, images?: string[]) => void,
		returnEmptyStringOnSuccess: boolean = false
	): Promise<ToolResponse> {
		if (command === undefined) {
			await say(
				"error",
				"Claude tried to use execute_command without value for required parameter 'command'. Retrying..."
			)
			return "Error: Missing value for required parameter 'command'. Please retry with complete response."
		}

		let response = "yesButtonTapped"
		if (!this.alwaysAllowWriteOnly) {
			const result = await ask("command", command)
			response = result.response
			if (response === "messageResponse") {
				await say("user_feedback", result.text, result.images)
				return formatToolResponse(formatGenericToolFeedback(result.text), result.images)
			}
		} else {
			ask("command", command)
		}

		if (response !== "yesButtonTapped") {
			return "The user denied this operation."
		}
		let userFeedback: { text?: string; images?: string[] } | undefined
		const sendCommandOutput = async (subprocess: ResultPromise, line: string): Promise<void> => {
			try {
				if (this.alwaysAllowWriteOnly) {
					await say("command_output", line)
				} else {
					const { response, text, images } = await ask("command_output", line)
					const isStdin = (text ?? "").startsWith(COMMAND_STDIN_STRING)
					if (response === "yesButtonTapped") {
						if (subprocess.pid) {
							treeKill(subprocess.pid, "SIGINT")
						}
					} else {
						if (isStdin) {
							const stdin = text?.slice(COMMAND_STDIN_STRING.length) ?? ""

							// replace last commandoutput with + stdin
							const lastCommandOutput = findLastIndex(
								this.koduDev.getStateManager().state.claudeMessages,
								(m) => m.ask === "command_output"
							)
							if (lastCommandOutput !== -1) {
								this.koduDev.getStateManager().state.claudeMessages[lastCommandOutput].text += stdin
							}

							// if the user sent some input, we send it to the command stdin
							// add newline as cli programs expect a newline after each input
							// (stdin needs to be set to `pipe` to send input to the command, execa does this by default when using template literals - other options are inherit (from parent process stdin) or null (no stdin))
							subprocess.stdin?.write(stdin + "\n")
							// Recurse with an empty string to continue listening for more input
							sendCommandOutput(subprocess, "") // empty strings are effectively ignored by the webview, this is done solely to relinquish control over the exit command button
						} else {
							userFeedback = { text, images }
							if (subprocess.pid) {
								treeKill(subprocess.pid, "SIGINT")
							}
						}
					}
				}
			} catch {
				// Ignore errors from ignored ask promises
			}
		}

		try {
			let result = ""
			const subprocess = execa({ shell: true, cwd: this.cwd })`${command}`
			this.executeCommandRunningProcess = subprocess

			const timeoutPromise = new Promise<string>((_, reject) => {
				setTimeout(() => {
					reject(new Error("Command execution timed out after 90 seconds"))
				}, 90000) // 90 seconds timeout
			})

			subprocess.stdout?.on("data", (data) => {
				if (data) {
					const output = data.toString()
					sendCommandOutput(subprocess, output)
					result += output
				}
			})

			try {
				await Promise.race([subprocess, timeoutPromise])
				if (subprocess.exitCode !== 0) {
					throw new Error(`Command failed with exit code ${subprocess.exitCode}`)
				}
			} catch (e) {
				if ((e as ExecaError).signal === "SIGINT") {
					await say("command_output", `\nUser exited command...`)
					result += `\n====\nUser terminated command process via SIGINT. This is not an error. Please continue with your task, but keep in mind that the command is no longer running. For example, if this command was used to start a server for a react app, the server is no longer running and you cannot open a browser to view it anymore.`
				} else if ((e as Error).message.includes("timed out")) {
					await say("command_output", `\nCommand execution timed out after 90 seconds`)
					result += `\n====\nCommand execution timed out after 90 seconds. Please review the partial output and consider breaking down the command into smaller steps or optimizing the operation.`
				} else {
					throw e
				}
			}

			await delay(COMMAND_OUTPUT_DELAY)
			this.executeCommandRunningProcess = undefined
			if (userFeedback) {
				await say("user_feedback", userFeedback.text, userFeedback.images)
				return formatToolResponse(
					`Command Output:\n${result}\n\nThe user interrupted the command and provided the following feedback:\n<feedback>\n${
						userFeedback.text
					}\n</feedback>\n\n${await getPotentiallyRelevantDetails()}`,
					userFeedback.images
				)
			}

			if (returnEmptyStringOnSuccess) {
				return ""
			}
			return `Command Output:\n${result}`
		} catch (e) {
			const error = e as any
			let errorMessage = error.message || JSON.stringify(serializeError(error), null, 2)
			const errorString = `Error executing command:\n${errorMessage}`
			await say("error", `Error executing command:\n${errorMessage}`)
			this.executeCommandRunningProcess = undefined
			return errorString
		}
	}

	async askFollowupQuestion(
		question: string | undefined,
		ask: (type: ClaudeAsk, question?: string) => Promise<{ response: string; text?: string; images?: string[] }>,
		say: (type: ClaudeSay, text?: string, images?: string[]) => void
	): Promise<ToolResponse> {
		if (question === undefined) {
			await say(
				"error",
				"Claude tried to use ask_followup_question without value for required parameter 'question'. Retrying..."
			)
			return "Error: Missing value for required parameter 'question'. Please retry with complete response."
		}
		const { text, images } = await ask("followup", question)
		await say("user_feedback", text ?? "", images)
		return formatToolResponse(`<answer>\n${text}\n</answer>`, images)
	}

	async attemptCompletion(
		result: string | undefined,
		command: string | undefined,
		ask: (type: ClaudeAsk, question?: string) => Promise<{ response: string; text?: string; images?: string[] }>,
		say: (type: ClaudeSay, text?: string, images?: string[]) => void
	): Promise<ToolResponse> {
		if (result === undefined) {
			await say(
				"error",
				"Claude tried to use attempt_completion without value for required parameter 'result'. Retrying..."
			)
			return "Error: Missing value for required parameter 'result'. Please retry with complete response."
		}
		let resultToSend = result
		if (command) {
			await say("completion_result", resultToSend)
			const commandResult = await this.executeCommand(command, ask, say, true)
			if (commandResult) {
				return commandResult
			}
			resultToSend = ""
		}

		if (this.alwaysAllowWriteOnly) {
			await ask("completion_result", resultToSend) // this prompts webview to show 'new task' button, and enable text input (which would be the 'text' here)
			return ""
		}

		const { response, text, images } = await ask("completion_result", resultToSend)
		if (response === "yesButtonTapped") {
			return ""
		}
		await say("user_feedback", text ?? "", images)
		return formatToolResponse(
			`The user is not pleased with the results. Use the feedback they provided to successfully complete the task, and then attempt completion again.\n<feedback>\n${text}\n</feedback>`,
			images
		)
	}

	abortTask() {
		const runningProcessId = this.executeCommandRunningProcess?.pid
		if (runningProcessId) {
			treeKill(runningProcessId, "SIGTERM")
		}
	}
}
