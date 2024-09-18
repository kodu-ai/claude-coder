import * as path from "path"
import * as vscode from "vscode"
import fs from "fs/promises"
import sharp from "sharp"
import { ClaudeSayTool } from "../../../shared/ExtensionMessage"
import { ToolResponse } from "../types"
import { formatGenericToolFeedback, formatToolResponse } from "../utils"
import { BaseAgentTool } from "./base-agent.tool"
import type { AgentToolOptions, AgentToolParams } from "./types"

export class UrlScreenshotTool extends BaseAgentTool {
	protected params: AgentToolParams

	constructor(params: AgentToolParams, options: AgentToolOptions) {
		super(options)
		this.params = params
	}

	async execute(): Promise<ToolResponse> {
		const { say, ask, input } = this.params
		const { url } = input

		if (!url) {
			await say("error", "Claude tried to use `url_screenshot` without required parameter `url`. Retrying...")

			return `Error: Missing value for required parameter 'url'. Please retry with complete response.
				A good example of a web_search tool call is:
				{
					"tool": "url_screenshot",
					"url": "How to import jotai in a react project",
				}
				Please try again with the correct url, you are not allowed to search without a url.`
		}

		const message = JSON.stringify({
			tool: "url_screenshot",
			url: url,
		} as ClaudeSayTool)
		const { response, text, images } = await ask("tool", message)

		if (response !== "yesButtonTapped") {
			if (response === "messageResponse") {
				await say("user_feedback", text, images)
				return formatToolResponse(formatGenericToolFeedback(text), images)
			}

			return "The user denied this operation."
		}

		try {
			const screenshot = await this.koduDev.getApiManager().getApi()?.sendUrlScreenshotRequest?.(url)
			if (!screenshot) {
				return "Could not generate screenshot."
			}

			const relPath = `screenshots/${url.replace(/[^a-zA-Z0-9]/g, "_")}-${Date.now()}.jpeg`
			const absolutePath = path.resolve(this.cwd, relPath)

			const buffer = Buffer.from(await screenshot.arrayBuffer())
			const compressedBuffer = await sharp(Buffer.from(buffer)).webp({ quality: 20 }).toBuffer()
			const imageToBase64 = compressedBuffer.toString("base64")

			await fs.writeFile(absolutePath, buffer)
			await fs.writeFile(absolutePath.replace(".jpeg", "webp"), compressedBuffer)

			const message = JSON.stringify({
				tool: "url_screenshot",
				url: absolutePath,
				base64Image: imageToBase64,
			} as ClaudeSayTool)
			await say("tool", message)

			const uri = vscode.Uri.file(absolutePath)
			await vscode.commands.executeCommand("vscode.open", uri)

			return `The screenshot was saved to file path: ${absolutePath}.
			This is the image that user requested in base64 format: ${imageToBase64}`
		} catch (err) {
			return `Screenshot failed with error: ${err}`
		}
	}
}
