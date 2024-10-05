import * as diff from "diff"
import fs from "fs/promises"
import * as path from "path"
import { serializeError } from "serialize-error"
import * as vscode from "vscode"
import { ClaudeAsk, ClaudeSay, ClaudeSayTool } from "../../../shared/ExtensionMessage"
import { ToolResponse } from "../types"
import { formatGenericToolFeedback, formatToolResponse, getReadablePath } from "../utils"
import os from "os"
import { ClaudeAskResponse } from "../../../shared/WebviewMessage"
import { AgentToolOptions, AgentToolParams } from "./types"
import { BaseAgentTool } from "./base-agent.tool"
import { DiagnosticsHandler } from "../handlers"

export class FileUpdateTool extends BaseAgentTool {
	protected params: AgentToolParams

	constructor(params: AgentToolParams, options: AgentToolOptions) {
		super(options)
		this.params = params
	}

	async execute(): Promise<ToolResponse> {
		const { input, ask, say } = this.params
		const { path: relPath, udiff } = input

		if (!relPath || !udiff) {
			return await this.onBadInputReceived()
		}

		try {
			const absolutePath = path.resolve(this.cwd, relPath)
			const fileExists = await fs
				.access(absolutePath)
				.then(() => true)
				.catch(() => false)

			if (!fileExists) {
				await say("error", `File ${relPath} does not exist. Cannot apply udiff to a non-existent file.`)
				return `Error: File ${relPath} does not exist. Cannot apply udiff to a non-existent file.`
			}

			const originalContent = await fs.readFile(absolutePath, "utf-8")

			let newContent: string
			try {
				newContent = this.applyUdiff(originalContent, udiff)
			} catch (error) {
				// Attempt to fix common udiff issues
				const fixedUdiff = this.tryFixUdiff(udiff)
				if (fixedUdiff) {
					try {
						newContent = this.applyUdiff(originalContent, fixedUdiff)
						await say(
							"error",
							"The original udiff failed to apply. Attempted to fix common issues and retried applying the udiff."
						)
					} catch (error) {
						await say("error", `Failed to apply udiff after attempting fixes:\n${(error as Error).message}`)
						return `Error applying udiff after attempting fixes: ${(error as Error).message}`
					}
				} else {
					await say("error", `Failed to apply udiff:\n${(error as Error).message}`)
					return `Error applying udiff: ${(error as Error).message}`
				}
			}

			let response: ToolResponse
			if (this.alwaysAllowWriteOnly) {
				response = await this.updateFileDirectly(absolutePath, newContent, relPath, say)
			} else {
				response = await this.updateFileWithUserApproval(
					absolutePath,
					originalContent,
					newContent,
					relPath,
					udiff,
					ask,
					say
				)
			}

			const diagnosticsHandler = this.options.koduDev.diagnosticsHandler
			const generatedErrors = diagnosticsHandler.getErrorsGeneratedByLastStep()
			diagnosticsHandler.updateSeenErrors()

			if (generatedErrors.length > 0) {
				return response + DiagnosticsHandler.errorsToString(generatedErrors, this.cwd)
			}

			return response
		} catch (error) {
			const errorString = `Error updating file: ${JSON.stringify(serializeError(error))}
A good example of an update_file tool call is:
\`\`\`
update_file(
  path='path/to/file.txt',
  udiff=\`diff content here\`
)
\`\`\`
Please try again with the correct path and udiff.`

			await say(
				"error",
				`Error updating file:\n${(error as Error).message ?? JSON.stringify(serializeError(error), null, 2)}`
			)
			return errorString
		}
	}

	private async onBadInputReceived() {
		const { path: relPath, udiff } = this.params.input

		if (!relPath) {
			await this.params.say(
				"error",
				"Claude tried to use update_file without a value for required parameter 'path'. Retrying..."
			)

			return `Error: Missing value for required parameter 'path'. Please retry with a complete response.
A good example of an update_file tool call is:
\`\`\`
update_file(
  path='path/to/file.txt',
  udiff=\`diff content here\`
)
\`\`\`
Please try again with the correct path and udiff. You are not allowed to update files without a path.`
		}

		await this.params.say(
			"error",
			`Claude tried to use update_file for '${relPath}' without a value for required parameter 'udiff'. This is likely due to output token limits. Retrying...`
		)

		return `Error: Missing value for required parameter 'udiff'. Please retry with a complete response.
A good example of an update_file tool call is:
\`\`\`
update_file(
  path='path/to/file.txt',
  udiff=\`diff content here\`
)
\`\`\`
Please try again with the correct path and udiff. You are not allowed to update files without a udiff.`
	}

	private applyUdiff(originalContent: string, udiff: string): string {
		const patchedContent = diff.applyPatch(originalContent, udiff)

		if (typeof patchedContent === "boolean") {
			// If false is returned, the patch could not be applied
			const tryFix = this.tryFixUdiff(udiff)
			if (tryFix) {
				const fixedPatchedContent = diff.applyPatch(originalContent, tryFix)
				if (typeof fixedPatchedContent === "string") {
					return fixedPatchedContent
				}
			}
			throw new Error("Failed to apply udiff. The patch could not be applied.")
		}

		return patchedContent
	}

	private tryFixUdiff(udiff: string): string | null {
		// Attempt to fix common issues with udiff
		// For example, normalize line endings
		const normalizedUdiff = udiff.replace(/\r\n/g, "\n")

		// Additional fixes can be added here

		return normalizedUdiff !== udiff ? normalizedUdiff : null
	}

	private async updateFileDirectly(
		absolutePath: string,
		newContent: string,
		relPath: string,
		say: (type: ClaudeSay, text?: string, images?: string[]) => void
	): Promise<ToolResponse> {
		await fs.writeFile(absolutePath, newContent)
		await vscode.window.showTextDocument(vscode.Uri.file(absolutePath), { preview: false })

		const text = `Changes applied to ${relPath}`
		await say("user_feedback", text)

		return formatToolResponse(formatGenericToolFeedback(text))
	}

	private async updateFileWithUserApproval(
		absolutePath: string,
		originalContent: string,
		newContent: string,
		relPath: string,
		udiff: string,
		ask: (
			type: ClaudeAsk,
			question?: string
		) => Promise<{ response: ClaudeAskResponse; text?: string; images?: string[] }>,
		say: (type: ClaudeSay, text?: string, images?: string[]) => void
	): Promise<ToolResponse> {
		const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "claude-coder-"))
		const tempFilePath = path.join(tempDir, path.basename(absolutePath))
		await fs.writeFile(tempFilePath, newContent)

		try {
			await vscode.commands.executeCommand(
				"vscode.diff",
				vscode.Uri.file(absolutePath),
				vscode.Uri.file(tempFilePath),
				`${path.basename(absolutePath)}: Original ↔ Changes (Editable)`
			)

			const userResponse = await ask(
				"tool",
				JSON.stringify({
					tool: "editedExistingFile",
					path: getReadablePath(relPath, this.cwd),
					diff: udiff,
				} as ClaudeSayTool)
			)

			const { response, text, images } = userResponse

			const diffDocument = vscode.workspace.textDocuments.find((doc) => doc.uri.fsPath === tempFilePath)
			if (diffDocument && diffDocument.isDirty) {
				await diffDocument.save()
			}

			if (response !== "yesButtonTapped") {
				await this.closeDiffViews()
				await fs.rm(tempDir, { recursive: true, force: true })

				if (response === "messageResponse") {
					await say("user_feedback", text, images)
					return formatToolResponse(formatGenericToolFeedback(text), images)
				}

				return "The user denied this operation."
			}

			const editedContent = await fs.readFile(tempFilePath, "utf-8")
			await fs.writeFile(absolutePath, editedContent)

			await vscode.window.showTextDocument(vscode.Uri.file(absolutePath), { preview: false })
			await this.closeDiffViews()
			await fs.rm(tempDir, { recursive: true, force: true })

			if (editedContent !== newContent) {
				const userDiff = diff.createTwoFilesPatch(
					relPath,
					relPath,
					newContent,
					editedContent,
					"Proposed Changes",
					"User Edited Changes"
				)
				await say(
					"user_feedback_diff",
					JSON.stringify({
						tool: "editedExistingFile",
						path: getReadablePath(relPath, this.cwd),
						diff: userDiff,
					} as ClaudeSayTool)
				)

				return `The user accepted but made the following changes to your content:\n\n${userDiff}\n\nFinal result applied to ${relPath}`
			} else {
				return `Changes applied to ${relPath}:\n\n${udiff}`
			}
		} catch (error) {
			await say("error", `Error during file update with user approval: ${(error as Error).message}`)
			throw error
		}
	}

	private async closeDiffViews() {
		const diffTabs = vscode.window.tabGroups.all
			.flatMap((group) => group.tabs)
			.filter(
				(tab) =>
					tab.input instanceof vscode.TabInputTextDiff &&
					(tab.input.modified.scheme === "file" || tab.input.modified.scheme === "untitled")
			)

		for (const tab of diffTabs) {
			await vscode.window.tabGroups.close(tab)
		}
	}
}
