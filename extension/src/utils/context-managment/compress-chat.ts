// import { ApiHandler } from "@/api"
import type {
	MessageParam,
	TextBlockParam,
	ImageBlockParam,
	ToolUseBlockParam,
	ToolResultBlockParam,
} from "@anthropic-ai/sdk/resources/messages.mjs"
// import { ToolName } from "@/shared/new-tools"
// import { parseToolResponse } from "@/shared/format-tools"
import { isToolResponseV2, parseToolResponse } from "../../shared/format-tools"
import { ApiHandler } from "../../api"
import { ToolName } from "../../agent/v1/tools/types"

const KODU_DIFF = "kodu_diff" as const
const KODU_CONTENT = "kodu_content" as const

const logger = (msg: string, level: "info" | "warn" | "error" | "debug") => {
	console[level](`[CompressToolFromMsg] ${msg}`)
}

type CommandListItem = {
	id: string
	command: string
	output: string
}

/**
 * Compresses a long string to a maximum length of 200,000 characters by keeping parts
 * from the beginning, middle, and end of the string. The compression adds markers
 * to indicate which sections were removed.
 *
 * The function preserves:
 * - 40% of the target length from the start
 * - 20% of the target length from the middle
 * - 40% of the target length from the end
 *
 * @param input The input string to compress
 * @param maxLength The maximum length of the output string (defaults to 200000)
 * @returns The compressed string with compression markers
 */
function compressLongString(input: string, maxLength: number = 200000): string {
	// If the string is already under the limit, return it unchanged
	if (input.length <= maxLength) {
		return input
	}

	// Calculate the lengths for each section
	const startLength = Math.floor(maxLength * 0.4)
	const middleLength = Math.floor(maxLength * 0.2)
	const endLength = maxLength - startLength - middleLength

	// Extract the start section
	const startSection = input.slice(0, startLength)

	// Calculate middle section position
	const middleStartPos = Math.floor((input.length - middleLength) / 2)
	const middleSection = input.slice(middleStartPos, middleStartPos + middleLength)

	// Extract the end section
	const endSection = input.slice(-endLength)

	// Create compression markers
	const startCompressionMarker = `[...Compressed ${startLength} to ${middleStartPos}...]`
	const endCompressionMarker = `[...Compressed ${middleStartPos + middleLength} to ${input.length - endLength}...]`

	// Combine all sections with compression markers
	return `${startSection}${startCompressionMarker}${middleSection}${endCompressionMarker}${endSection}`
}

export class CompressToolExecution {
	private threshold: number | undefined
	private apiHandler: ApiHandler
	private commandList: CommandListItem[] = []
	constructor(apiHandler: ApiHandler, threshold?: number) {
		this.threshold = threshold ?? 30_000
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

	public compress = async (command: string, output: string): Promise<string> => {
		return await this.compressExecution(command, output)
	}

	private compressExecution = async (command: string, output: string, isError = -1): Promise<string> => {
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
		if (!this.threshold || output.length < this.threshold) {
			logger(`Output is below threshold, skipping compression`, "info")
			return output
		}
		logger(`Compressing output for command: ${command}`, "info")
		try {
			const resultStream = this.apiHandler.createMessageStream({
				systemPrompt: [SYSTEM_PROMPT],
				messages: [
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
				abortSignal: null,
				modelId: this.apiHandler.getModel().id,
			})
			for await (const message of resultStream) {
				if (message.code === 1 && isTextBlock(message.body.anthropic.content[0])) {
					return message.body.anthropic.content[0].text
				}
				if (message.code === -1) {
					throw new Error("Failed to compress output")
				}
			}
			return output
		} catch (err) {
			logger(`Error compressing output for command: ${command}`, "error")
			if (isError === 3) {
				// try to compress the output again but with a compressed version of the output
				return this.compressExecution(command, compressLongString(output), isError + 1)
			}
			// if the error is not resolved after 3 tries, return the output (should be already compressed using compressLongString)
			if (isError > 3) {
				return output
			}
			return this.compressExecution(command, output, isError + 1)
		}
	}
}

// Define our content block types for better type safety
type ContentBlockType = TextBlockParam | ImageBlockParam | ToolUseBlockParam | ToolResultBlockParam
type MessageContent = string | ContentBlockType[]

// Type guard for content blocks
const isTextBlock = (block: ContentBlockType): block is TextBlockParam => {
	return block?.type === "text"
}

/**
 * Processes a message's content blocks and compresses tool outputs where appropriate
 */
const processContentBlock = async (
	content: ContentBlockType,
	currentCommandString: string,
	executionCompressor: CompressToolExecution,
	compressedTools: ToolName[],
	setCurrentCommandString: (command: string) => void
): Promise<ContentBlockType | undefined> => {
	if (!isTextBlock(content)) {
		return content
	}
	const shouldNotBeCompressed = compressedTools.every(
		(tool) => !content.text.includes(`<toolName>${tool}</toolName>`)
	)
	const isToolResponse = content.text.includes("<toolResponse>") && content.text.includes("</toolResponse>")

	// Handle execute_command blocks
	if (!isToolResponse && content.text.includes("<command>") && content.text.includes("</command>")) {
		const indexOfStartTag = content.text.indexOf("<command>")
		const indexOfEndTag = content.text.indexOf("</command>")
		if (indexOfStartTag !== -1 && indexOfEndTag !== -1) {
			const command = content.text.slice(indexOfStartTag + "<command>".length, indexOfEndTag)
			setCurrentCommandString(command)
			logger(`Found command block (${command})`, "info")
		}
	}

	// Skip specific context blocks
	const includedTextToRemove = [
		"</most_important_context>",
		"</environment_details>",
		"</automatic_reminders>",
		"</compression_additional_context>",
	]
	if (includedTextToRemove.some((text) => content.text.includes(text))) {
		if (
			content.text.includes("<most_important_context>") ||
			content.text.includes("<environment_details>") ||
			content.text.includes("<automatic_reminders>")
		) {
			logger(`Found and Removing either most_important_context or environment_details block`, "info")
			return undefined
		}
	}

	// Handle write_to_file compression
	if (content.text.includes("</write_to_file>") && !isToolResponse) {
		const koduContentType = content.text.includes(`</${KODU_CONTENT}>`) ? KODU_CONTENT : "content"
		const contentStart = content.text.indexOf(`<${koduContentType}>`)
		const contentEnd = content.text.indexOf(`</${koduContentType}>`)

		if (contentStart !== -1 && contentEnd !== -1) {
			const textBeforeContent = content.text.slice(0, contentStart)
			const textAfterContent = content.text.slice(contentEnd + `</${koduContentType}>`.length)
			const fullContent = content.text.slice(contentStart + `<${koduContentType}>`.length, contentEnd)

			// Ensure extracted content is logged for verification
			logger(`Extracted content: "${fullContent}"`, "debug")

			// Get first 3 lines
			const lines = fullContent.split("\n")
			const firstThreeLines = lines.slice(0, 3).join("\n")
			const truncatedContent = firstThreeLines + (lines.length > 3 ? "\n..." : "")
			const truncatedContentReplace = `<${koduContentType}>${truncatedContent}\n(Original length: ${fullContent.length}, lines: ${lines.length})</${koduContentType}>`

			logger(
				`Compressed content for ${koduContentType}: original length: ${fullContent.length}, new length: ${truncatedContentReplace.length}`,
				"info"
			)

			return {
				type: "text",
				text: textBeforeContent + truncatedContentReplace + textAfterContent,
			}
		} else {
			logger(`Failed to detect ${koduContentType} block boundaries, skipping compression`, "warn")
		}
	}

	// Handle edit_file_blocks compression
	if (content.text.includes(`<${KODU_DIFF}>`) && content.text.includes(`</${KODU_DIFF}>`) && !isToolResponse) {
		const koduDiffStart = content.text.indexOf(`<${KODU_DIFF}>`)
		const koduDiffEnd = content.text.indexOf(`</${KODU_DIFF}>`)

		if (koduDiffStart !== -1 && koduDiffEnd !== -1) {
			const textBeforeContent = content.text.slice(0, koduDiffStart)
			const textAfterContent = content.text.slice(koduDiffEnd + `</${KODU_DIFF}>`.length)
			const fullContent = content.text.slice(koduDiffStart + `<${KODU_DIFF}>`.length, koduDiffEnd)

			// Log extracted content for debugging
			logger(`Extracted ${KODU_DIFF} content: "${fullContent}"`, "debug")

			// Count SEARCH and REPLACE blocks
			const searchCount = (fullContent.match(/SEARCH/g) || []).length
			const replaceCount = (fullContent.match(/REPLACE/g) || []).length

			const truncatedContent = `<${KODU_DIFF}>Compressed diff with ${searchCount} SEARCH/REPLACE blocks</${KODU_DIFF}>`
			logger(
				`Compressed ${KODU_DIFF}: original length: ${fullContent.length}, SEARCH: ${searchCount}, REPLACE: ${replaceCount}`,
				"info"
			)

			return {
				type: "text",
				text: textBeforeContent + truncatedContent + textAfterContent,
			}
		} else {
			logger(`Failed to detect ${KODU_DIFF} boundaries, skipping compression`, "warn")
		}
	}

	// Handle tool response compression
	if (isToolResponse) {
		try {
			const toolResponse = parseToolResponse(content.text)
			if (!compressedTools.includes(toolResponse.toolName as ToolName) && shouldNotBeCompressed) {
				return content
			}

			if (toolResponse.toolName === "execute_command") {
				if (toolResponse.toolResult.includes("<compressedToolResult>")) {
					logger(`Skipping compression for already compressed execute_command`, "info")
					return content
				}
				if (
					(isToolResponseV2(toolResponse) && toolResponse.status === "success") ||
					toolResponse.toolStatus === "success"
				) {
					const output = await executionCompressor.compress(currentCommandString, toolResponse.toolResult)
					logger(`Compressed execute_command output ${currentCommandString}`, "info")
					return {
						type: "text",
						text: `<toolResponse><toolName>${toolResponse.toolName}</toolName><toolStatus>${toolResponse.toolStatus}</toolStatus>
						<<toolResult>
						<compressedToolResult>
						${output}
						</compressedToolResult>
						</toolResult></toolResponse>`,
					}
				} else {
					logger(`Skipping compression for rejected/pending execute_command`, "info")
					return content
				}
			}

			const textLength = toolResponse.toolResult.length
			toolResponse.toolResult = `The output for tool "${toolResponse.toolName}" was compressed for readability if the context was needed please re read the file.`
			logger(`Compressed tool ${toolResponse.toolName} output`, "info")

			return {
				type: "text",
				text: `<toolResponse><toolName>${toolResponse.toolName}</toolName><toolStatus>${toolResponse.toolStatus}</toolStatus><toolResult>${toolResponse.toolResult}</toolResult></toolResponse>`,
			}
		} catch (error) {
			logger(`Error compressing tool response: ${error}`, "error")
			return {
				type: "text",
				text: "[Compressed] Tool response errored",
			}
		}
	}

	return content
}

export const compressedTools: ToolName[] = [
	"read_file",
	"execute_command",
	"write_to_file",
	"edit_file_blocks",
	"file_editor",
]

/**
 * Main function to compress tool outputs in a message array
 */
export const compressToolFromMsg = async (
	msgs: MessageParam[],
	apiHandler: ApiHandler,
	executeCommandThreshold?: number
): Promise<MessageParam[]> => {
	const executionCompressor = new CompressToolExecution(apiHandler, executeCommandThreshold)
	let currentCommandString = ""
	const setCurrentCommandString = (command: string) => {
		currentCommandString = command
	}

	const processMessage = async (msg: MessageParam): Promise<MessageParam> => {
		if (typeof msg.content === "string") {
			return {
				...msg,
				content: [
					{
						type: "text",
						text: msg.content,
					},
				] as ContentBlockType[],
			}
		}

		const processedContent: (ContentBlockType | null)[] = []

		for (const block of msg.content) {
			const processedBlock = await processContentBlock(
				block,
				currentCommandString,
				executionCompressor,
				compressedTools,
				setCurrentCommandString
			)
			processedContent.push(processedBlock ?? null)
		}
		const content = processedContent.filter((block) => block !== null) as ContentBlockType[]
		if (content.length === 0) {
			// put the original content back
			return msg
		}
		return {
			...msg,
			content,
		}
	}
	// const processedMsgs: MessageParam[] = []
	// for (const msg of msgs) {
	// 	processedMsgs.push(await processMessage(msg))
	// }
	const processedMsgs = await Promise.all(msgs.map(processMessage))
	return processedMsgs
}
