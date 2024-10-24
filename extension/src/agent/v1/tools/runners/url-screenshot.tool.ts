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

	constructor(params: AgentToolParams, options: AgentToolOptions) {
		super(options)
		this.params = params
	}

	async execute(): Promise<ToolResponse> {
		const { url } = this.params.input
		if (!url) {
			return await this.onBadInputReceived()
		}

		const confirmation = await this.askToolExecConfirmation()
		if (confirmation.response !== "yesButtonTapped") {
			this.params.ask(
				"tool",
				{
					tool: {
						tool: "url_screenshot",
						approvalState: "rejected",
						url: url!,
						ts: this.ts,
					},
				},
				this.ts
			)
			return await this.onExecDenied(confirmation)
		}

		try {
			this.params.ask(
				"tool",
				{ tool: { tool: "url_screenshot", approvalState: "loading", url, ts: this.ts } },
				this.ts
			)
			const browserManager = this.koduDev.browserManager
			await browserManager.launchBrowser()
			const { buffer, logs } = await browserManager.urlToScreenshotAndLogs(url)
			await browserManager.closeBrowser()

			const relPath = `${url.replace(/[^a-zA-Z0-9]/g, "_")}-${Date.now()}.jpeg`
			const absolutePath = path.resolve(this.cwd, relPath)

			// const compressedBuffer = await sharp(Buffer.from(buffer)).webp({ quality: 20 }).toBuffer()
			const imageToBase64 = buffer.toString("base64")
			await fs.writeFile(absolutePath, buffer)

			await this.relaySuccessfulResponse({ absolutePath, imageToBase64 })

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
			this.params.ask(
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
			this.params.ask(
				"tool",
				{
					tool: {
						tool: "url_screenshot",
						approvalState: "error",
						url: url!,
						error: `Screenshot failed with error: ${err}`,
						ts: this.ts,
					},
				},
				this.ts
			)
			return `Screenshot failed with error: ${err}`
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
		return await this.params.ask(
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
			// await this.params.say("user_feedback", text, images)
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
			return formatToolResponse(formatGenericToolFeedback(text), images)
		}

		return "The user denied this operation."
	}

	private async relaySuccessfulResponse(data: Record<string, string>) {
		const message = JSON.stringify({
			tool: "url_screenshot",
			url: data.absolutePath,
			base64Image: data.imageToBase64,
			ts: this.ts,
		} as ChatTool)

		await this.params.say("tool", message)
	}
}
