import * as assert from "assert"
import {
	compressedTools,
	CompressToolExecution,
	compressToolFromMsg,
} from "../../../../src/utils/context-managment/compress-chat"
import { ApiHandler } from "../../../../src/api"
import type { MessageParam, TextBlockParam, ImageBlockParam } from "@anthropic-ai/sdk/resources/messages.mjs"
import apiHistory from "./api_conversation_history.json"
import apiHistory2 from "./api_conversation_history_2.json"
import { ToolName } from "@/shared/new-tools"
// XML tag constants that help us maintain consistency in our test cases
const TOOL_RESPONSE = "toolResponse" as const
const TOOL_NAME = "toolName" as const
const TOOL_STATUS = "toolStatus" as const
const TOOL_RESULT = "toolResult" as const
const WRITE_TO_FILE = "write_to_file" as const
const KODU_CONTENT = "kodu_content" as const
const PATH = "path" as const
const ENV_DETAILS = "environment_details" as const
const MOST_IMPORTANT_CONTEXT = "most_important_context" as const

// Helper functions to create consistent test data
const createToolResponse = (toolName: string, status: string, result: string) =>
	`<${TOOL_RESPONSE}><${TOOL_NAME}>${toolName}</${TOOL_NAME}><${TOOL_STATUS}>${status}</${TOOL_STATUS}><${TOOL_RESULT}>${result}</${TOOL_RESULT}></${TOOL_RESPONSE}>`

const createWriteToFile = (path: string, content: string) =>
	`<${WRITE_TO_FILE}><${PATH}>${path}</${PATH}><${KODU_CONTENT}>${content}</${KODU_CONTENT}></${WRITE_TO_FILE}>`

// Helper function to create message params for testing
const createMessageParam = (
	role: "user" | "assistant",
	content: string | (TextBlockParam | ImageBlockParam)[]
): MessageParam => ({
	role,
	content,
})

describe("CompressToolExecution", () => {
	let mockApiHandler: ApiHandler
	let compressExecution: CompressToolExecution

	beforeEach(() => {
		// Mock ApiHandler with typed generator function
		mockApiHandler = {
			createBaseMessageStream: async function* () {
				yield {
					code: 1,
					body: {
						anthropic: {
							content: [
								{
									type: "text",
									text: "Compressed output summary",
								},
							],
						},
					},
				}
			},
		} as unknown as ApiHandler

		compressExecution = new CompressToolExecution(mockApiHandler, 500)
	})

	it("should add and compress commands", async () => {
		compressExecution.addCommand("1", "npm test", "Test passed successfully".repeat(10000))
		compressExecution.addCommand("2", "git status", "Changes not staged for commit")

		const results = await compressExecution.compressAll()

		assert.strictEqual(results.length, 2)
		assert.strictEqual(results[0].command, "npm test")
		assert.strictEqual(results[0].output, "Compressed output summary")
		assert.strictEqual(results[1].command, "git status")
		assert.strictEqual(results[1].output, "Changes not staged for commit")
	})
})

describe("compressToolFromMsg", () => {
	let mockApiHandler: ApiHandler

	beforeEach(() => {
		mockApiHandler = {
			createBaseMessageStream: async function* () {
				yield {
					code: 1,
					body: {
						anthropic: {
							content: [
								{
									type: "text",
									text: "Compressed output summary",
								},
							],
						},
					},
				}
			},
		} as unknown as ApiHandler
	})

	it("should compress a compressed conversation correctly", async () => {
		const results = await compressToolFromMsg(apiHistory2 as MessageParam[], mockApiHandler, 30_000)

		// First verify we haven't lost any messages
		assert.strictEqual(results.length, apiHistory2.length)

		// Helper functions to verify different compression formats
		const verifyWriteToFileCompression = (text: string): boolean => {
			// Should compress both the content and the tool result
			const hasCompressedContent = text.includes("<kodu_content>Content Compressed (Original length:")
			const hasCompressedResult = text.includes(
				'The output for the "write_to_file" command was compressed for readability'
			)
			return hasCompressedContent && hasCompressedResult
		}

		const verifyEditFileBlocksCompression = (text: string): boolean => {
			if (!text.includes("<toolName>edit_file_blocks</toolName>")) return false

			// Check that the content is actually compressed
			const result = text.match(/<toolResult>(.*?)<\/toolResult>/s)
			if (!result) return false

			const toolResult = result[1]
			return toolResult === 'The output for the "edit_file_blocks" command was compressed for readability'
		}

		const verifyExecuteCommandCompression = (text: string): boolean => {
			if (!text.includes("<toolName>execute_command</toolName>")) return false

			// If status is not success, it shouldn't be compressed
			if (!text.includes("<toolStatus>success</toolStatus>")) return true

			const result = text.match(/<toolResult>(.*?)<\/toolResult>/s)
			if (!result) return false

			// Should either be the original content (if below threshold) or compressed summary
			const toolResult = result[1]
			return (
				toolResult.includes("Compressed output summary") ||
				toolResult.length < (mockApiHandler as any).threshold
			)
		}

		// Track compression statistics
		const stats = {
			writeToFile: { total: 0, compressed: 0 },
			editFileBlocks: { total: 0, compressed: 0 },
			executeCommand: { total: 0, compressed: 0 },
			readFile: { total: 0, compressed: 0 },
		}

		// Examine each message and block
		results.forEach((msg, msgIndex) => {
			if (!Array.isArray(msg.content)) return

			msg.content.forEach((block, blockIndex) => {
				if (typeof block !== "object" || !("text" in block)) return

				const text = block.text

				// Check write_to_file compression
				if (text.includes("<write_to_file>")) {
					stats.writeToFile.total++
					if (verifyWriteToFileCompression(text)) {
						stats.writeToFile.compressed++
					} else {
						assert.fail(
							`Write to file not properly compressed at message ${msgIndex}, block ${blockIndex}:\n${text}`
						)
					}
				}

				// Check edit_file_blocks compression
				if (text.includes("<toolName>edit_file_blocks</toolName>")) {
					stats.editFileBlocks.total++
					if (verifyEditFileBlocksCompression(text)) {
						stats.editFileBlocks.compressed++
					} else {
						assert.fail(
							`Edit file blocks not properly compressed at message ${msgIndex}, block ${blockIndex}:\n${text}`
						)
					}
				}

				// Check execute_command compression
				if (text.includes("<toolName>execute_command</toolName>")) {
					stats.executeCommand.total++
					if (verifyExecuteCommandCompression(text)) {
						stats.executeCommand.compressed++
					} else {
						assert.fail(
							`Execute command not properly compressed at message ${msgIndex}, block ${blockIndex}:\n${text}`
						)
					}
				}

				// Check read_file compression
				if (text.includes("<toolName>read_file</toolName>")) {
					stats.readFile.total++
					if (text.includes('The output for the "read_file" command was compressed for readability')) {
						stats.readFile.compressed++
					} else {
						assert.fail(
							`Read file not properly compressed at message ${msgIndex}, block ${blockIndex}:\n${text}`
						)
					}
				}
			})
		})

		// Log compression statistics for debugging
		console.log("Compression statistics:", JSON.stringify(stats, null, 2))

		// Verify we found and compressed at least some instances of each tool
		const verifyToolCompression = (toolName: string, stats: { total: number; compressed: number }) => {
			assert.ok(stats.total > 0, `Should have found at least one ${toolName} tool usage`)
			// assert.ok(
			// 	stats.compressed === stats.total,
			// 	`All ${toolName} tools should be compressed (found ${stats.total}, compressed ${stats.compressed})`
			// )
		}

		// Verify each tool type
		verifyToolCompression("write_to_file", stats.writeToFile)
		verifyToolCompression("edit_file_blocks", stats.editFileBlocks)
		verifyToolCompression("read_file", stats.readFile)
		// Execute command is special since it depends on threshold
		if (stats.executeCommand.total > 0) {
			assert.ok(
				stats.executeCommand.compressed > 0,
				"Should have compressed at least some execute_command responses"
			)
		}
	})

	it("should compress api conversation history and not have empty content array or empty content string", async () => {
		const results = await compressToolFromMsg(apiHistory as MessageParam[], mockApiHandler)
		// make sure there is no empty array
		const emptyContentArray = results.some((msg) => Array.isArray(msg.content) && msg.content.length === 0)
		// make sure there is no empty string inside content array
		const emptyContentString = results.some(
			(msg) =>
				Array.isArray(msg.content) &&
				msg.content.some((block) => typeof block === "object" && "text" in block && block.text === "")
		)
		assert.ok(!emptyContentArray)
		assert.ok(!emptyContentString)
		assert.strictEqual(results.length, apiHistory.length)
	})

	it("should compress a compressed conversation correctly 2", async () => {
		const results = await compressToolFromMsg(apiHistory2 as MessageParam[], mockApiHandler)

		// First verify we haven't lost any messages
		assert.strictEqual(results.length, apiHistory2.length)

		// Helper function to check if a block contains a compressed tool response
		const isCompressedToolResponse = (text: string): boolean => {
			// A compressed tool response should have the pattern:
			// <toolResponse><toolName>{name}</toolName><toolStatus>{status}</toolStatus><toolResult>The output for the "{name}" command was compressed for readability</toolResult></toolResponse>
			const match = text.match(/<toolResponse><toolName>([^<]+)<\/toolName>/)
			if (!match) return false

			const toolName = match[1]
			if (!compressedTools.includes(toolName as ToolName)) return false

			// For compressed tools, verify the compression message
			if (text.includes(`The output for the "${toolName}" command was compressed for readability`)) {
				return true
			}

			// Special case for write_to_file which has a different compression format
			if (toolName === "write_to_file" && text.includes("Content Compressed (Original length:")) {
				return true
			}

			return false
		}

		// Track which tools we've seen compressed
		const seenCompressedTools = new Set<string>()

		// Check each message for proper compression
		results.forEach((msg) => {
			if (Array.isArray(msg.content)) {
				msg.content.forEach((block) => {
					if (typeof block === "object" && "text" in block) {
						// If the block contains a tool response, verify it's properly compressed
						if (block.text.includes("<toolResponse>")) {
							const toolNameMatch = block.text.match(/<toolName>([^<]+)<\/toolName>/)
							if (toolNameMatch) {
								const toolName = toolNameMatch[1]
								if (compressedTools.includes(toolName as ToolName)) {
									assert.ok(
										isCompressedToolResponse(block.text),
										`Tool ${toolName} should be properly compressed`
									)
									seenCompressedTools.add(toolName)
								}
							}
						}
					}
				})
			}
		})

		// Verify we've seen at least one compressed tool
		assert.ok(seenCompressedTools.size > 0, "Should have found at least one compressed tool response")

		// Log which tools we found for debugging purposes
		console.log("Compressed tools found:", Array.from(seenCompressedTools))
	})

	it("should not compress execute_command tool responses for short output", async () => {
		const msgs: MessageParam[] = [
			createMessageParam("user", [
				{
					type: "text",
					text: `<execute_command><command>echo "Hello, World!"</command></execute_command>`,
				},
			]),
			createMessageParam("assistant", [
				{
					type: "text",
					text: createToolResponse(
						"execute_command",
						"success",
						"Command executed successfully with short output"
					),
				},
			]),
		]

		const result = await compressToolFromMsg(msgs, mockApiHandler, 500)
		assert.strictEqual(result.length, 2)
		const content = result[1].content as TextBlockParam[]
		assert.ok(
			content[0].type === "text" && content[0].text.includes("Command executed successfully with short output")
		)
	})

	it("should compress execute_command tool responses", async () => {
		const msgs: MessageParam[] = [
			createMessageParam("user", [
				{
					type: "text",
					text: `<execute_command><command>echo "Hello, World!"</command></execute_command>`,
				},
			]),
			createMessageParam("assistant", [
				{
					type: "text",
					text: createToolResponse(
						"execute_command",
						"success",
						"Command executed successfully with long output".repeat(10000)
					),
				},
			]),
		]

		const result = await compressToolFromMsg(msgs, mockApiHandler, 500)
		assert.strictEqual(result.length, 2)
		const content = result[1].content as TextBlockParam[]
		assert.ok(content[0].type === "text" && content[0].text.includes("Compressed output summary"))
	})

	it("should compress read_file tool responses", async () => {
		const msgs: MessageParam[] = [
			createMessageParam("assistant", [
				{
					type: "text",
					text: createToolResponse("read_file", "success", "Very long file content"),
				},
			]),
		]

		const result = await compressToolFromMsg(msgs, mockApiHandler)
		assert.strictEqual(result.length, 1)
		const content = result[0].content as TextBlockParam[]
		assert.ok(content[0].type === "text" && content[0].text.includes("compressed for readability"))
	})

	it("should handle write_to_file content compression", async () => {
		const msgs: MessageParam[] = [
			createMessageParam("assistant", [
				{
					type: "text",
					text: createWriteToFile("test.txt", "Very long content here that needs to be compressed"),
				},
			]),
		]

		const result = await compressToolFromMsg(msgs, mockApiHandler)
		assert.strictEqual(result.length, 1)
		const content = result[0].content as TextBlockParam[]
		assert.ok(content[0].type === "text" && content[0].text.includes("Content Compressed"))
		assert.ok(content[0].type === "text" && content[0].text.includes("Original length:"))
	})

	it("should not compress non-compressible tools", async () => {
		const originalMsg = createToolResponse("list_files", "success", "file1.txt\nfile2.txt")
		const msgs: MessageParam[] = [
			createMessageParam("assistant", [
				{
					type: "text",
					text: originalMsg,
				},
			]),
		]

		const result = await compressToolFromMsg(msgs, mockApiHandler)
		assert.strictEqual(result.length, 1)
		const content = result[0].content as TextBlockParam[]
		assert.ok(content[0].type === "text" && content[0].text === originalMsg)
	})

	it("should preserve image blocks", async () => {
		const msgs: MessageParam[] = [
			createMessageParam("assistant", [
				{
					type: "image",
					source: {
						type: "base64",
						media_type: "image/png",
						data: "test-image-data",
					},
				},
			]),
		]

		const result = await compressToolFromMsg(msgs, mockApiHandler)
		assert.strictEqual(result.length, 1)
		const content = result[0].content as ImageBlockParam[]
		assert.strictEqual(content[0].type, "image")
	})

	it("should handle multiple mixed content blocks", async () => {
		const msgs: MessageParam[] = [
			createMessageParam("assistant", [
				{
					type: "text",
					text: createToolResponse("execute_command", "success", "Long output"),
				},
				{
					type: "image",
					source: {
						type: "base64",
						media_type: "image/png",
						data: "test-image-data",
					},
				},
				{
					type: "text",
					text: createToolResponse("list_files", "success", "file1.txt"),
				},
			]),
		]

		const result = await compressToolFromMsg(msgs, mockApiHandler)
		assert.strictEqual(result.length, 1)
		const content = result[0].content as (TextBlockParam | ImageBlockParam)[]
		assert.ok(content.length >= 2)
		assert.strictEqual(content[0].type, "text")
		assert.strictEqual(content[1].type, "image")
	})

	it("should handle environment details removal", async () => {
		const msgs: MessageParam[] = [
			createMessageParam("assistant", [
				{
					type: "text",
					text: `<${ENV_DETAILS}>Some environment details</${ENV_DETAILS}>`,
				},
				{
					type: "text",
					text: createToolResponse("execute_command", "success", "Command output"),
				},
			]),
		]

		const result = await compressToolFromMsg(msgs, mockApiHandler)
		assert.strictEqual(result.length, 1)
		const content = result[0].content as TextBlockParam[]
		const hasEnvDetails = content.some((block) => block.text.includes(ENV_DETAILS))
		assert.ok(!hasEnvDetails)
	})

	it("should handle most important context removal", async () => {
		const msgs: MessageParam[] = [
			createMessageParam("user", [
				{
					type: "text",
					text: "User message content",
				},
				{
					type: "text",
					text: `<${MOST_IMPORTANT_CONTEXT}>Important context details</${MOST_IMPORTANT_CONTEXT}>`,
				},
			]),
			createMessageParam("assistant", [
				{
					type: "text",
					text: createToolResponse("execute_command", "success", "Command output"),
				},
			]),
		]

		const result = await compressToolFromMsg(msgs, mockApiHandler)
		const hasImportantContext = result.some((msg) =>
			(msg.content as TextBlockParam[]).some((block) => block.text.includes(MOST_IMPORTANT_CONTEXT))
		)
		assert.ok(!hasImportantContext)
	})
})
