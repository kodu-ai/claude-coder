import * as assert from "assert"
import * as vscode from "vscode"
import * as path from "path"
import { suite, test } from "mocha"
import {
	getCwd,
	getReadablePath,
	formatFilesList,
	getPotentiallyRelevantDetails,
	formatImagesIntoBlocks,
	formatToolResponse,
	formatToolResponseText,
	formatGenericToolFeedback,
	createToolMessage,
	isTextBlock,
	isImageBlock,
} from "../../agent/v1/utils"

suite("Utils Test Suite", () => {
	vscode.window.showInformationMessage("Starting utils tests")

	// test("getReadablePath handles different path scenarios", async () => {
	// 	const workspacePath = vscode.workspace.workspaceFolders![0].uri.fsPath

	// 	// Test relative path
	// 	const relPath = "src/test.ts"
	// 	const readableRelPath = getReadablePath(relPath, workspacePath)
	// 	assert.strictEqual(readableRelPath, relPath)

	// 	// Test absolute path
	// 	const absPath = path.join(workspacePath, "src/test.ts")
	// 	const readableAbsPath = getReadablePath(absPath, workspacePath)
	// 	assert.strictEqual(readableAbsPath, "src/test.ts")

	// 	// Test path outside workspace
	// 	const outsidePath = path.join(workspacePath, "../outside.ts")
	// 	const readableOutsidePath = getReadablePath(outsidePath, workspacePath)
	// 	assert.strictEqual(readableOutsidePath, outsidePath)
	// })

	test("formatFilesList formats files correctly", async () => {
		const basePath = "/test/dir"
		const files = ["/test/dir/b.ts", "/test/dir/a.ts", "/test/dir/sub/c.ts"]

		// Test normal list
		const formatted = formatFilesList(basePath, files, false)
		assert.strictEqual(formatted, "a.ts\nb.ts\nsub/c.ts")

		// Test truncated list
		const truncated = formatFilesList(basePath, files, true)
		assert.ok(truncated.includes("(File list truncated"))

		// Test empty list
		const empty = formatFilesList(basePath, [], false)
		assert.strictEqual(empty, "No files found.")
	})

	test("getPotentiallyRelevantDetails returns correct format", async () => {
		const details = getPotentiallyRelevantDetails()
		assert.ok(details.startsWith("<potentially_relevant_details>"))
		assert.ok(details.includes("VSCode Visible Files:"))
		assert.ok(details.includes("VSCode Opened Tabs:"))
		assert.ok(details.endsWith("</potentially_relevant_details>"))
	})

	test("formatImagesIntoBlocks handles image data correctly", async () => {
		// Test with valid image data
		const imageData = ["data:image/png;base64,test123"]
		const blocks = formatImagesIntoBlocks(imageData)
		assert.strictEqual(blocks.length, 1)
		assert.deepStrictEqual(blocks[0], {
			type: "image",
			source: {
				type: "base64",
				media_type: "image/png",
				data: "test123",
			},
		})

		// Test with no images
		const emptyBlocks = formatImagesIntoBlocks()
		assert.strictEqual(emptyBlocks.length, 0)
	})

	test("formatToolResponse formats responses correctly", async () => {
		// Test text only
		const textResponse = formatToolResponse("test message")
		assert.strictEqual(textResponse, "test message")

		// Test with images
		const imageResponse = formatToolResponse("test message", ["data:image/png;base64,test123"])
		assert.ok(Array.isArray(imageResponse))
		assert.strictEqual((imageResponse as any[]).length, 2)
		assert.deepStrictEqual((imageResponse as any[])[0], { type: "text", text: "test message" })
		assert.strictEqual((imageResponse as any[])[1].type, "image")
	})

	test("formatToolResponseText creates correct XML format", async () => {
		const response = formatToolResponseText("testTool", { param: "value" })
		assert.ok(response.includes("Tool response for: testTool"))
		assert.ok(response.includes("<param>value</param>"))
	})

	test("formatGenericToolFeedback formats feedback correctly", async () => {
		const feedback = formatGenericToolFeedback("test feedback")
		assert.ok(feedback.includes("The user denied this operation"))
		assert.ok(feedback.includes("<feedback>"))
		assert.ok(feedback.includes("test feedback"))
	})

	test("createToolMessage creates valid JSON message", async () => {
		const message = createToolMessage("testTool", "test.ts", "content")
		const parsed = JSON.parse(message)
		assert.strictEqual(parsed.tool, "testTool")
		assert.ok(parsed.path.includes("test.ts"))
		assert.strictEqual(parsed.content, "content")
	})

	test("isTextBlock identifies text blocks correctly", async () => {
		assert.strictEqual(isTextBlock({ type: "text" }), true)
		assert.strictEqual(isTextBlock({ type: "image" }), false)
		assert.strictEqual(isTextBlock("not a block"), false)
	})

	test("isImageBlock identifies image blocks correctly", async () => {
		assert.strictEqual(isImageBlock({ type: "image" }), true)
		assert.strictEqual(isImageBlock({ type: "text" }), false)
		assert.strictEqual(isImageBlock("not a block"), false)
	})
})
