import * as path from "path"
import fs from "fs/promises"
import { ToolResponseV2 } from "../../types"
import { BaseAgentTool } from "../base-agent.tool"
import type { AskConfirmationResponse } from "../types"
import { ChatTool } from "../../../../shared/new-tools"
import { UrlScreenshotToolParams } from "../schema/url_screenshot"

export class UrlScreenshotTool extends BaseAgentTool<UrlScreenshotToolParams> {
	private abortController: AbortController = new AbortController()
	private isAborting: boolean = false

	override async abortToolExecution() {
		const { didAbort } = await super.abortToolExecution()
		if (didAbort) {
			this.isAborting = true
			this.abortController.abort()
			// Cleanup browser if it was launched
			await this.cleanup()
			return { didAbort: true }
		}
		return { didAbort }
	}

	async execute() {
		const url = this.params.input.url
		if (!url) {
			return await this.onBadInputReceived()
		}

		try {
			// Create a promise that resolves when aborted
			const abortPromise = new Promise<ToolResponseV2>((_, reject) => {
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
				return this.toolResponse(
					"error",
					`<screenshot_tool_response>
						<status>
							<result>error</result>
							<operation>url_screenshot</operation>
							<timestamp>${new Date().toISOString()}</timestamp>
						</status>
						<error_details>
							<type>execution_aborted</type>
							<message>The tool execution was aborted</message>
							<url>${url}</url>
						</error_details>
					</screenshot_tool_response>`
				)
			}
			throw err
		}
	}

	private async executeWithConfirmation(url: string) {
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

			const textBlock = `
			<screenshot_tool_response>
				<status>
					<result>success</result>
					<operation>url_screenshot</operation>
					<timestamp>${new Date().toISOString()}</timestamp>
				</status>
				<screenshot_info>
					<url>${url}</url>
					<file_path>${absolutePath}</file_path>
					<capture_time>${new Date().toISOString()}</capture_time>
				</screenshot_info>
				<browser_logs>
					<note>Only mission-critical errors are relevant. Warnings and info logs should be ignored.</note>
					<content>${logs}</content>
				</browser_logs>
			</screenshot_tool_response>`
			const imageBlock = [imageToBase64]

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

			return this.toolResponse("success", textBlock, imageBlock)
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
			"Kodu tried to use `url_screenshot` without required parameter `url`. Retrying..."
		)

		const errMsg = `
		<screenshot_tool_response>
			<status>
				<result>error</result>
				<operation>url_screenshot</operation>
				<timestamp>${new Date().toISOString()}</timestamp>
			</status>
			<error_details>
				<type>missing_parameter</type>
				<message>Missing required parameter 'url'</message>
				<help>
					<example_usage>
						<tool>url_screenshot</tool>
						<parameters>
							<url>http://localhost:3000</url>
						</parameters>
					</example_usage>
					<note>A valid URL is required to capture screenshots</note>
				</help>
			</error_details>
		</screenshot_tool_response>`
		return this.toolResponse("error", errMsg)
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
			return this.toolResponse(
				"feedback",
				`<screenshot_tool_response>
					<status>
						<result>feedback</result>
						<operation>url_screenshot</operation>
						<timestamp>${new Date().toISOString()}</timestamp>
					</status>
					<feedback_details>
						<url>${this.params.input.url!}</url>
						<user_feedback>${text || "No feedback provided"}</user_feedback>
						${images ? `<has_images>true</has_images>` : "<has_images>false</has_images>"}
					</feedback_details>
				</screenshot_tool_response>`,
				images
			)
		}

		return this.toolResponse(
			"rejected",
			`<screenshot_tool_response>
				<status>
					<result>rejected</result>
					<operation>url_screenshot</operation>
					<timestamp>${new Date().toISOString()}</timestamp>
				</status>
				<rejection_details>
					<url>${this.params.input.url!}</url>
					<message>Operation was rejected by the user</message>
				</rejection_details>
			</screenshot_tool_response>`
		)
	}
}
