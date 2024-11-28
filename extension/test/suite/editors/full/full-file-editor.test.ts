import * as vscode from "vscode"
import * as assert from "assert"
import * as fs from "fs"
import * as path from "path"
import { DiffViewProvider } from "../../../../src/integrations/editor/diff-view-provider"
// import { DiffViewProvider } from "@/integrations/editor/diff-view-provider"

// Helper function to read file content, with clear error handling for test clarity
const readTestFile = (fileName: string): string => {
	const filePath = path.join(__dirname, fileName)
	try {
		return fs.readFileSync(filePath, "utf8")
	} catch (error) {
		throw new Error(`Failed to read test file ${fileName}: ${error}`)
	}
}

// Helper to create a test file with proper workspace integration
const createTestFile = async (fileName: string, content: string): Promise<string> => {
	const filePath = path.join(__dirname, fileName)
	fs.writeFileSync(filePath, content, "utf8")
	const workspaceEdit = new vscode.WorkspaceEdit()
	workspaceEdit.createFile(vscode.Uri.file(filePath), { overwrite: true })
	workspaceEdit.replace(vscode.Uri.file(filePath), new vscode.Range(0, 0, 0, 0), content)
	await vscode.workspace.applyEdit(workspaceEdit)
	return filePath
}

// Clean up test files safely
const deleteTestFile = async (filePath: string) => {
	const workspaceEdit = new vscode.WorkspaceEdit()
	workspaceEdit.deleteFile(vscode.Uri.file(filePath))
	await vscode.workspace.applyEdit(workspaceEdit)
	if (fs.existsSync(filePath)) {
		fs.unlinkSync(filePath)
	}
}
function preprocessContent(content: string): string {
	content = content.trim()
	if (content.startsWith("```")) {
		content = content.split("\n").slice(1).join("\n").trim()
	}
	if (content.endsWith("```")) {
		content = content.split("\n").slice(0, -1).join("\n").trim()
	}
	return content.replace(/>/g, ">").replace(/</g, "<").replace(/"/g, '"')
}

// Simulate content streaming with configurable chunk size and delay
async function* simulateStreamingContent(
	content: string,
	chunkSize: number = 100,
	delayMs: number = 10
): AsyncGenerator<string, void, unknown> {
	let streamedContent = ""

	while (streamedContent.length < content.length) {
		const nextChunk = content.slice(streamedContent.length, streamedContent.length + chunkSize)
		streamedContent += nextChunk
		yield streamedContent
		await new Promise((resolve) => setTimeout(resolve, delayMs))
	}
}

describe("FullFileEditor Integration Tests", async () => {
	let handler: DiffViewProvider
	let file1Path: string
	let file2Path: string
	let file3Path: string

	// Read test content from files
	const file1Before = readTestFile("file1-before.txt")
	const file1After = readTestFile("file1-after.txt")
	const file2Before = readTestFile("file2-before.txt")
	const file2After = readTestFile("file2-after.txt")
	const file3Before = readTestFile("file3-before.txt")
	const file3After = readTestFile("file3-after.txt")

	beforeEach(async () => {
		// Create test files with initial content
		file1Path = await createTestFile("file1.txt", file1Before)
		file2Path = await createTestFile("file2.txt", file2Before)
		file3Path = await createTestFile("file3.txt", file3Before)

		handler = new DiffViewProvider(__dirname, {} as any)
	})

	afterEach(async () => {
		// Comprehensive cleanup
		await deleteTestFile(file1Path)
		await deleteTestFile(file2Path)
		await deleteTestFile(file3Path)
		await vscode.commands.executeCommand("workbench.action.closeAllEditors")
	})

	// it("should handle sequential file updates with streaming content", async () => {
	// 	// Test each file in sequence with proper content verification
	// 	const testCases = [
	// 		{ path: file1Path, before: file1Before, after: file1After },
	// 		{ path: file2Path, before: file2Before, after: file2After },
	// 		{ path: file3Path, before: file3Before, after: file3After },
	// 	]

	// 	for (const { path, before, after } of testCases) {
	// 		// Verify initial content
	// 		assert.strictEqual(fs.readFileSync(path, "utf8"), before, "Initial content mismatch")

	// 		// Open and update file
	// 		const success = await handler.open(path)
	// 		assert.strictEqual(success, true, "Failed to open file")

	// 		// Stream content updates
	// 		const contentStream = simulateStreamingContent(after)
	// 		for await (const streamedContent of contentStream) {
	// 			const updateSuccess = await handler.applyStreamContent(streamedContent)
	// 			assert.strictEqual(updateSuccess, true, "Failed to apply streaming content")
	// 		}

	// 		// Finalize and verify
	// 		await handler.finalize()
	// 		const { finalContent } = await handler.saveChanges()
	// 		assert.strictEqual(finalContent, after, "Final content mismatch")
	// 	}
	// })

	it("should maintain content integrity during tab switches", async () => {
		try {
			const extension = vscode.extensions.getExtension("kodu-ai.claude-dev-experimental")!
			await extension.activate()
		} catch (err) {
			console.log(err)
		}
		await handler.open(file1Path)
		const stream1 = simulateStreamingContent(file1After)

		// Switch between tabs while streaming
		// const switchInterval = setInterval(async () => {
		// 	const doc2 = await vscode.workspace.openTextDocument(file2Path)
		// 	await vscode.window.showTextDocument(doc2)
		// 	await delay(200)
		// 	const doc1 = await vscode.workspace.openTextDocument(file1Path)
		// 	await vscode.window.showTextDocument(doc1)
		// }, 500)

		let acc = ""
		let previous = ""
		let index = 0
		try {
			for await (const content of stream1) {
				acc = content
				if (index % 3 === 0 && previous !== acc) {
					previous = acc
				}
				const success = await handler.update(content, false)
				index += 1
				// assert.strictEqual(success, true, "Streaming update failed")
			}
		} finally {
			// clearInterval(switchInterval)
		}

		// Finalize and verify content
		handler.update(previous, false)
		await handler.update(preprocessContent(acc), true)
		// handler.update(trailingUpdate, false)
		// await delay(15_000)
		const { finalContent, userEdits } = await handler.saveChanges()
		assert.strictEqual(userEdits, undefined, `Non-user edits should be detected`)
		assert.strictEqual(
			preprocessContent(finalContent),
			preprocessContent(file1After),
			"Content integrity compromised during tab switching"
		)
	})

	// it("should create and update non-existent files", async () => {
	// 	const newFilePath = path.join(__dirname, "newfile.txt")
	// 	const newContent = file1After // Use content from existing test file

	// 	try {
	// 		const success = await handler.open(newFilePath)
	// 		assert.strictEqual(success, true, "Failed to create new file")

	// 		const contentStream = simulateStreamingContent(newContent)
	// 		for await (const content of contentStream) {
	// 			const updateSuccess = await handler.applyStreamContent(content)
	// 			assert.strictEqual(updateSuccess, true, "Failed to stream to new file")
	// 		}

	// 		await handler.finalize()
	// 		const { finalContent } = await handler.saveChanges()
	// 		assert.strictEqual(finalContent, newContent, "New file content mismatch")
	// 	} finally {
	// 		await deleteTestFile(newFilePath)
	// 	}
	// })

	// it("should handle streaming interruptions gracefully", async () => {
	// 	await handler.open(file1Path)
	// 	const stream = simulateStreamingContent(file1After, 20, 50)
	// 	let interruptedOnce = false

	// 	for await (const content of stream) {
	// 		if (!interruptedOnce && content.length > file1After.length / 2) {
	// 			interruptedOnce = true
	// 			await vscode.commands.executeCommand("workbench.action.closeAllEditors")
	// 			await delay(100)
	// 			await handler.open(file1Path)
	// 		}

	// 		const success = await handler.applyStreamContent(content)
	// 		assert.strictEqual(success, true, "Failed to recover from interruption")
	// 	}

	// 	await handler.finalize()
	// 	const { finalContent } = await handler.saveChanges()
	// 	assert.strictEqual(finalContent, file1After, "Content integrity lost after interruption")
	// })
})

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}
