import * as path from "path"
import * as vscode from "vscode"
import fs from "fs/promises"
import { ClaudeSayTool } from "../../../../shared/ExtensionMessage"
import { ToolResponse } from "../../types"
import { formatGenericToolFeedback, formatToolResponse } from "../../utils"
import { BaseAgentTool } from "../base-agent.tool"
import type { AgentToolOptions, AgentToolParams, AskConfirmationResponse } from "../types"
import Anthropic from "@anthropic-ai/sdk"
import { ChatTool } from "../../../../shared/new-tools"

export class UrlScreenshotTool extends BaseAgentTool {
	protected params: AgentToolParams
	private abortController: AbortController
	private isAborting: boolean = false

	constructor(params: AgentToolParams, options: AgentToolOptions) {
		super(options)
		this.params = params
		this.abortController = new AbortController()
	}

	override async abortToolExecution(): Promise<void> {
		this.isAborting = true
		this.abortController.abort()
	}

	async execute(): Promise<ToolResponse> {
		const { url } = this.params.input
		if (!url) {
			return await this.onBadInputReceived()
		}

		try {
			// Create a promise that resolves when aborted
			const abortPromise = new Promise<ToolResponse>((_, reject) => {
				this.abortController.signal.addEventListener("abort", () => {
					reject(new Error("Tool execution was aborted"))
				})
			})

			// Create the main execution promise
			const execPromise = this.executeWithConfirmation(url)

			// Race between execution and abort
			return await Promise.race([execPromise, abortPromise])
		} catch (err) {
			if (this.isAborting) {
				await this.cleanup()
				return "Operation was aborted"
			}
			throw err
		}
	}

	private async executeWithConfirmation(url: string): Promise<ToolResponse> {
		try {
			const confirmation = await this.askToolExecConfirmation()

			// Check if aborted during confirmation
			if (this.abortController.signal.aborted) {
				throw new Error("Tool execution was aborted")
			}

			if (confirmation.response !== "yesButtonTapped") {
				await this.params.updateAsk(
					"tool",
					{
						tool: {
							tool: "url_screenshot",
							approvalState: "rejected",
							url,
							ts: this.ts,
						},
					},
					this.ts
				)
				return await this.onExecDenied(confirmation)
			}

			await this.params.updateAsk(
				"tool",
				{ tool: { tool: "url_screenshot", approvalState: "loading", url, ts: this.ts } },
				this.ts
			)

			// Check if aborted before browser launch
			if (this.abortController.signal.aborted) {
				throw new Error("Tool execution was aborted")
			}

			const browserManager = this.koduDev.browserManager
			await browserManager.launchBrowser()

			// Check if aborted before screenshot
			if (this.abortController.signal.aborted) {
				await browserManager.closeBrowser()
				throw new Error("Tool execution was aborted")
			}

			const { buffer, logs } = await browserManager.urlToScreenshotAndLogs(url)

			// Check if aborted before saving
			if (this.abortController.signal.aborted) {
				await browserManager.closeBrowser()
				throw new Error("Tool execution was aborted")
			}

			await browserManager.closeBrowser()

			const relPath = `${url.replace(/[^a-zA-Z0-9]/g, "_")}-${Date.now()}.jpeg`
			const absolutePath = path.resolve(this.cwd, relPath)

			const imageToBase64 = buffer.toString("base64")
			await fs.writeFile(absolutePath, buffer)

			const textBlock: Anthropic.TextBlockParam = {
				type: "text",
				text: `
                The screenshot was saved to file path: ${absolutePath}.
                Here is the updated browser logs, THIS IS THE ONLY RELEVANT INFORMATION, all previous logs are irrelevant:
                <browser_logs>
                You should only care about mission critical errors, you shouldn't care about warnings or info logs.
                YOU SHOULD ONLY care about errors that mention there is a clear error like a missing import or a syntax error.
                <log>
                ${logs}
                </log>
                </browser_logs>
                `,
			}
			const imageBlock: Anthropic.ImageBlockParam = {
				type: "image",
				source: {
					type: "base64",
					media_type: "image/jpeg",
					data: imageToBase64,
				},
			}

			// Final abort check before completing
			if (this.abortController.signal.aborted) {
				throw new Error("Tool execution was aborted")
			}

			await this.params.updateAsk(
				"tool",
				{
					tool: {
						tool: "url_screenshot",
						base64Image: imageToBase64,
						approvalState: "approved",
						url,
						ts: this.ts,
					},
				},
				this.ts
			)

			return [imageBlock, textBlock]
		} catch (err) {
			// Always cleanup browser on any error
			await this.cleanup()
			throw err
		}
	}

	private async cleanup() {
		try {
			await this.koduDev.browserManager.closeBrowser()
		} catch (err) {
			console.error("Error during cleanup:", err)
		}
	}

	private async onBadInputReceived() {
		await this.params.say(
			"error",
			"Claude tried to use `url_screenshot` without required parameter `url`. Retrying..."
		)

		return `Error: Missing value for required parameter 'url'. Please retry with complete response.
            A good example of a web_search tool call is:
            {
                "tool": "url_screenshot",
                "url": "How to import jotai in a react project",
            }
            Please try again with the correct url, you are not allowed to search without a url.`
	}

	private async askToolExecConfirmation(): Promise<AskConfirmationResponse> {
		if (this.abortController.signal.aborted) {
			throw new Error("Tool execution was aborted")
		}
		return await this.params.ask!(
			"tool",
			{
				tool: {
					tool: "url_screenshot",
					url: this.params.input.url!,
					approvalState: "pending",
					ts: this.ts,
				},
			},
			this.ts
		)
	}

	private async onExecDenied(confirmation: AskConfirmationResponse) {
		const { response, text, images } = confirmation

		if (response === "messageResponse") {
			await this.params.updateAsk(
				"tool",
				{
					tool: {
						tool: "url_screenshot",
						url: this.params.input.url!,
						approvalState: "rejected",
						ts: this.ts,
						userFeedback: text,
					},
				},
				this.ts
			)
			await this.params.say("user_feedback", text ?? "The user denied this operation.", images)
			return formatToolResponse(formatGenericToolFeedback(text), images)
		}

		return "The user denied this operation."
	}
}
