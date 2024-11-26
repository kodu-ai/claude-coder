import { ImageBlockParam, TextBlock, TextBlockParam } from "@anthropic-ai/sdk/resources/messages.mjs"
import type { ToolResponseV2 } from "../agent/v1/types"
import { ToolName } from "./new-tools"
import { base64StringToImageBlock } from "./format-images"
// import { GlobalStateManager } from "@/providers/claude-coder/state/GlobalStateManager"
import { GlobalStateManager } from "../providers/claude-coder/state/GlobalStateManager"
import { ApiHandler } from "../api"

type ContentBlock = TextBlock | ImageBlockParam | TextBlockParam

export const isTextBlock = (block: any): block is TextBlock => {
	if (typeof block === "object") {
		return block.type === "text"
	}
	return false
}

export const isToolResponseV2 = (result: any): result is ToolResponseV2 => {
	return (
		typeof result === "object" &&
		result !== null &&
		"status" in result &&
		"toolName" in result &&
		"result" in result
	)
}

const rejectMsg = (msg: string) => `The Tool got rejected and returned the following message: ${msg}`
const errorMsg = (msg: string) => `The Tool encountered an error and returned the following message: ${msg}`
const feedbackMsg = (msg: string) => `The Tool returned the following feedback: ${msg}`
const successMsg = (msg: string) => `The Tool was successful and returned the following message: ${msg}`

const toolFeedbackToMsg = (result: ToolResponseV2["status"]) => {
	switch (result) {
		case "rejected":
			return rejectMsg
		case "error":
			return errorMsg
		case "feedback":
			return feedbackMsg
		case "success":
			return successMsg
	}
}

export const toolResponseToAIState = (result: ToolResponseV2): ContentBlock[] => {
	const blocks: ContentBlock[] = []
	if (typeof result.text === "string") {
		blocks.push({
			type: "text",
			text: `
            <toolResponse>
            <toolName>${result.toolName}</toolName>
            <toolStatus>${result.status}</toolStatus>
            <toolResult>${toolFeedbackToMsg(result.status)(result.text)}</toolResult>
            ${result.images?.length ? `check the images attached to the request` : ""}
            </toolResponse>
            `,
		})
	}
	if (result.images?.length) {
		blocks.push({
			type: "text",
			text: `Images attached to the request:`,
		})
		result.images.forEach((image) => {
			const imageBlock = base64StringToImageBlock(image)
			blocks.push(imageBlock)
		})
	}
	return blocks
}

export function getBase64ImageType(base64String: string): ImageBlockParam["source"]["media_type"] | null {
	// Remove data URL prefix if it exists
	const base64 = base64String.replace(/^data:image\/\w+;base64,/, "")

	// Take first few bytes of the base64 string
	const decoded = atob(base64).slice(0, 4)
	const bytes = new Uint8Array(decoded.length)

	for (let i = 0; i < decoded.length; i++) {
		bytes[i] = decoded.charCodeAt(i)
	}

	// Check magic numbers
	if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
		return "image/jpeg"
	}
	if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
		return "image/png"
	}
	if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
		return "image/gif"
	}
	if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
		return "image/webp"
	}

	return null
}
const logger = (msg: string, level: "info" | "warn" | "error" | "debug") => {
	console[level](`[CompressToolFromMsg] ${msg}`)
}

type CommandListItem = {
	id: string
	command: string
	output: string
}

export class CompressToolExecution {
	private threshold: number | undefined
	private apiHandler: ApiHandler
	private commandList: CommandListItem[] = []
	constructor(apiHandler: ApiHandler, threshold?: number) {
		this.threshold = threshold
		this.apiHandler = apiHandler
	}

	public addCommand = (id: string, command: string, output: string) => {
		this.commandList.push({ command, output, id })
	}

	public compressAll = async (): Promise<CommandListItem[]> => {
		// run it in parallel
		const promises = this.commandList.map(async (commandItem) => {
			const compressedOutput = await this.compressExecution(commandItem.command, commandItem.output)
			return { command: commandItem.command, output: compressedOutput, id: commandItem.id }
		})
		return await Promise.all(promises)
	}

	private compressExecution = async (command: string, output: string): Promise<string> => {
		const SYSTEM_PROMPT = `
		You are an assistant tasked with analyzing and summarizing the output of commands run on a user's computer. Your goals are to:
		
		- **Extract the most important and notable information** from the command output.
		- **Offer brief explanations** and any relevant insights that may be useful to the user.
		- **Format your response using Markdown** for better readability.
		
		**Instructions:**
		
		1. **Determine the type of command output** (e.g., unit test results, server access logs, compilation errors).
		
		2. **For Unit Test Outputs:**
		
		- Summarize the **total number of tests** run, skipped, passed, and failed.
		- List **which tests failed** and provide brief reasons if available.
		- Suggest potential reasons **why the tests failed or passed**.
		
		3. **For Server Access Logs:**
		
		- Summarize the **endpoints accessed** and the frequency of access.
		- Highlight any **exceptions or errors** that occurred.
		- Provide possible explanations for **any errors or unusual activity**.
		
		4. **For Other Command Outputs:**
		
		- Identify and summarize the **key messages**, such as errors, warnings, or success notifications.
		- Explain the significance of these messages to the user.
		
		**Examples:**
		
		---
		
		*Example 1: Unit Test Output*
		
		\`\`\`
		Ran 10 tests in 0.005s
		
		FAILED (failures=2)
		- test_login: AssertionError: Login failed
		- test_data_retrieval: TimeoutError: Data retrieval took too long
		\`\`\`
		
		**Summary:**
		
		- **Total Tests Run:** 10
		- **Passed:** 8
		- **Failed:** 2
		
		**Failed Tests:**
		
		1. \`test_login\` - *AssertionError*: Login failed.
		2. \`test_data_retrieval\` - *TimeoutError*: Data retrieval took too long.
		
		**Possible Reasons:**
		
		- The \`test_login\` failure may be due to incorrect credentials or authentication issues.
		- The \`test_data_retrieval\` timeout suggests a possible slowdown in the database or network latency.
		
		---
		
		*Example 2: Server Access Log*
		
		\`\`\`
		192.168.1.10 - - [10/Oct/2023:13:55:36] "GET /api/users HTTP/1.1" 200 1024
		192.168.1.15 - - [10/Oct/2023:13:56:40] "POST /api/login HTTP/1.1" 500 512
		192.168.1.10 - - [10/Oct/2023:13:57:22] "GET /api/data HTTP/1.1" 404 256
		\`\`\`
		
		**Summary:**
		
		- **Endpoints Accessed:**
		- \`/api/users\` - Successful access.
		- \`/api/login\` - Encountered a \`500 Internal Server Error\`.
		- \`/api/data\` - Returned a \`404 Not Found\` error.
		
		**Exceptions:**
		
		- **500 Internal Server Error** on \`/api/login\` may indicate a server-side issue during the login process.
		- **404 Not Found** on \`/api/data\` suggests the requested data endpoint does not exist or has been moved.
		
		**Possible Reasons:**
		
		- The server error on \`/api/login\` could be due to an unhandled exception in the login handler.
		- The \`404\` error might result from an incorrect URL or missing resource.
		
		---
		
		*Example 3: Compilation Error Output*
		
		\`\`\`
		main.cpp:15:10: error: 'iostream' file not found
		1 error generated.
		\`\`\`
		
		**Summary:**
		
		- **Error:** \`'iostream' file not found\` in \`main.cpp\` at line 15.
		
		**Possible Reasons:**
		
		- The C++ compiler cannot locate the standard library headers, possibly due to misconfigured include paths or missing installations.
		
		---
		
		**Remember:** Always tailor your summary to highlight the most critical information that will help the user understand the output and take appropriate action.
		Your summary should be informative, full of insights, with clear explanations and suggestions where necessary.
		Don't be afraid to write long summaries if the output is complex or requires detailed analysis.
		You should focus on quality and quantity of information to provide the best assistance to the user.
		`
		const resultStream = this.apiHandler.createBaseMessageStream(
			SYSTEM_PROMPT,
			[
				{
					role: "user",
					content: [
						{
							type: "text",
							text: `The output for the "${command}" command was:\n\n${output}`,
						},
					],
				},
			],
			"claude-3-5-haiku-20241022"
		)
		for await (const message of resultStream) {
			if (message.code === 1 && isTextBlock(message.body.anthropic.content[0])) {
				return message.body.anthropic.content[0].text
			}
		}
		return output
	}
}

const compressToolExecution = async (command: string, output: string): Promise<string> => {
	const terminalCompressionThreshold = GlobalStateManager.getInstance().getGlobalState("terminalCompressionThreshold")

	const outputTokensLength = output.length / 3
	if (terminalCompressionThreshold && outputTokensLength > terminalCompressionThreshold) {
		logger(`Compressing output for command: ${command}`, "info")
		return output
	}
	return output
}

/**
 * Takes a msg of ContentBlock and returns the text content without the tool result to compress it
 */
export const compressToolFromMsg = async (
	msgs: ContentBlock[],
	apiHandler: ApiHandler,
	executeCommandThreshold?: number
): Promise<ContentBlock[]> => {
	const executionCompressor = new CompressToolExecution(apiHandler)
	const blocks: ContentBlock[] = []
	const compressedTools: ToolName[] = ["read_file", "edit_file_blocks", "execute_command"]
	/**
	 * we complete blocks that include the following text
	 */
	const includedTextToRemove = ["</most_important_context>", "</environment_details>"]
	for (const msg of msgs) {
		if (isTextBlock(msg)) {
			// skip messages that include the following text to remove them
			if (includedTextToRemove.some((text) => msg.text.includes(text))) {
				// if there is also opening tag we will skip this message
				if (msg.text.includes("<most_important_context>") || msg.text.includes("<environment_details>")) {
					continue
				}
			}
			if (msg.text.includes("</write_to_file>")) {
				// find <content> tag and replace it with a placeholder
				const koduContentType = msg.text.includes("</kodu_content>") ? "kodu_content" : "content"
				const contentStart = msg.text.indexOf(`<${koduContentType}>`)
				const contentEnd = msg.text.indexOf(`</${koduContentType}>`)

				if (contentStart !== -1 && contentEnd !== -1) {
					// replace content with placeholder Compressed and keep the existing text before and after the content
					const textBeforeContent = msg.text.slice(0, contentStart)
					const textAfterContent = msg.text.slice(contentEnd + `</${koduContentType}>`.length)
					const truncatedLength = contentEnd - contentStart
					const truncatedContentReplace = `<${koduContentType}>Content Compressed (Original length:${truncatedLength})</${koduContentType}>`
					const truncatedText = textBeforeContent + truncatedContentReplace + textAfterContent
					blocks.push({
						type: "text",
						text: truncatedText,
					})
					logger(`Compressed write_to_file content with length ${truncatedLength}`, "info")
					continue
				}
			}
			if (msg.text.includes("<toolResponse>")) {
				try {
					// Parse the tool response and add Compressed version
					const toolResponse = parseToolResponse(msg.text)
					if (!compressedTools.includes(toolResponse.toolName as ToolName)) {
						// Keep non-compressible tools as is
						blocks.push(msg)
						logger(`Tool ${toolResponse.toolName} skipped compression`, "info")
						continue
					}
					if (toolResponse.toolName === "execute_command") {
						executionCompressor.addCommand(msg.text, toolResponse.toolResult, toolResponse.toolResult)
						continue
					}
					const textLength = toolResponse.toolResult.length
					toolResponse.toolResult = `the output for the "${toolResponse.toolName}" command was compressed for readability`
					if (!isToolResponseV2(toolResponse)) {
						blocks.push({
							type: "text",
							text: `<toolResponse><toolName>${toolResponse.toolName}</toolName><toolStatus>${toolResponse.toolStatus}</toolStatus><toolResult>${toolResponse.toolResult}</toolResult></toolResponse>`,
						})
						logger(
							`Compressed tool ${toolResponse.toolName} with status (${toolResponse.toolStatus}) (output original length: ${textLength})`,
							"info"
						)
						continue
					}
					const newBlock = toolResponseToAIState(toolResponse)
					logger(
						`Compressed tool ${toolResponse.toolName} with status (${toolResponse.status}) (output original length: ${textLength})`,
						"info"
					)
					blocks.push(...newBlock)
				} catch (error) {
					// If parsing fails, add a generic Compressed message
					blocks.push({
						type: "text",
						text: "[Compressed] Tool response errored",
					})
				}
			} else {
				// Keep non-tool messages as is
				blocks.push(msg)
			}
		} else if (msg.type === "image") {
			// Keep image blocks
			blocks.push(msg)
		}
	}

	return blocks
}

interface ToolResponse {
	toolName: string
	toolStatus: string
	toolResult: string
	hasImages?: boolean
}

/**
 * Parses XML string containing tool response into a structured object
 * @param xmlString The XML string to parse
 * @returns Parsed ToolResponse object
 * @throws Error if XML is invalid or required fields are missing
 */
export function parseToolResponse(xmlString: string): ToolResponse {
	try {
		// Helper function to extract content between XML tags, handling nested tags
		const getTagContent = (xml: string, tag: string): string => {
			const startTag = `<${tag}>`
			const endTag = `</${tag}>`

			const startIndex = xml.indexOf(startTag)
			if (startIndex === -1) {
				throw new Error(`Missing ${tag} in tool response`)
			}

			let endIndex = -1
			let depth = 1
			let searchStartIndex = startIndex + startTag.length

			while (depth > 0 && searchStartIndex < xml.length) {
				const nextStartTag = xml.indexOf(startTag, searchStartIndex)
				const nextEndTag = xml.indexOf(endTag, searchStartIndex)

				if (nextEndTag === -1) {
					throw new Error(`Malformed XML: Missing closing tag for ${tag}`)
				}

				if (nextStartTag !== -1 && nextStartTag < nextEndTag) {
					depth++
					searchStartIndex = nextStartTag + startTag.length
				} else {
					depth--
					if (depth === 0) {
						endIndex = nextEndTag
					}
					searchStartIndex = nextEndTag + endTag.length
				}
			}

			if (endIndex === -1) {
				throw new Error(`Malformed XML: Unable to find matching end tag for ${tag}`)
			}

			return xml.substring(startIndex + startTag.length, endIndex).trim()
		}

		// Extract values
		const toolResponseContent = getTagContent(xmlString, "toolResponse")
		const toolName = getTagContent(xmlString, "toolName")
		const toolStatus = getTagContent(xmlString, "toolStatus")
		const toolResult = getTagContent(xmlString, "toolResult")

		// Check for image text
		const hasImages = toolResponseContent.includes("check the images attached to the request")

		return {
			toolName,
			toolStatus,
			toolResult,
			hasImages,
		}
	} catch (error) {
		if (error instanceof Error) {
			throw new Error(`Failed to parse tool response: ${error.message}`)
		}
		throw new Error("Failed to parse tool response")
	}
}
