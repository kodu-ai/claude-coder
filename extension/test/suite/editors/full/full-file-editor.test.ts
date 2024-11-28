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
	let activated = false

	// Read test content from files
	const file1Before = readTestFile("file1-before.txt")
	const file1After = readTestFile("file1-after.txt")
	const file2Before = readTestFile("file2-before.txt")
	const file2After = readTestFile("file2-after.txt")
	const file3Before = readTestFile("file3-before.txt")
	const file3After = readTestFile("file3-after.txt")

	beforeEach(async () => {
		if (!activated) {
			const extension = vscode.extensions.getExtension("kodu-ai.claude-dev-experimental")!
			await extension.activate()
			activated = true
		}
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

	it("should write to file correctly even with race conditions at partial updates", async () => {
		await handler.open(file1Path)
		const stream1 = simulateStreamingContent(file1After)

		let acc = ""
		let previous = ""
		let index = 0
		try {
			for await (const content of stream1) {
				acc = content
				if (index % 3 === 0 && previous !== acc) {
					previous = acc
				}
				await handler.update(content, false)
				index += 1
			}
		} finally {
		}

		// creating a race condition by voiding the update promise
		handler.update(previous, false)
		// Finalize the content by triggering final update
		await handler.update(preprocessContent(acc), true)
		// Save the changes immediately
		const { finalContent, userEdits } = await handler.saveChanges()
		// Verify the final content didn't include "userEdits" if this fails it means the trailing update overwrote the final content
		assert.strictEqual(userEdits, undefined, `Non-user edits should be detected`)
		// if the final content is not equal to the expected content, the final content was overwritten
		assert.strictEqual(
			preprocessContent(finalContent),
			preprocessContent(file1After),
			"Content integrity compromised during tab switching"
		)
	})
	// it("should handle streamed content updates without line reference errors", async () => {
	// 	await handler.open(file1Path)

	// 	// Helper to get random chunk sizes
	// 	function getRandomChunkSize(min: number = 10, max: number = 100): number {
	// 		return Math.floor(Math.random() * (max - min + 1)) + min
	// 	}

	// 	// helper function to get random delay between 5-20ms
	// 	function getRandomDelay(min: number = 5, max: number = 20): number {
	// 		return Math.floor(Math.random() * (max - min + 1)) + min
	// 	}

	// 	// Create an async generator that yields random chunks
	// 	async function* randomChunkStreaming(content: string): AsyncGenerator<string, void, unknown> {
	// 		let streamedContent = ""

	// 		while (streamedContent.length < content.length) {
	// 			const chunkSize = getRandomChunkSize()
	// 			const nextChunk = content.slice(streamedContent.length, streamedContent.length + chunkSize)
	// 			streamedContent += nextChunk
	// 			yield streamedContent // Always yield the full accumulated content
	// 			await delay(getRandomDelay()) // Random delay between 5-20ms
	// 		}
	// 	}

	// 	const stream = randomChunkStreaming(file1After)
	// 	let lastContent = ""

	// 	try {
	// 		for await (const content of stream) {
	// 			lastContent = content
	// 			// Don't await some updates to create potential races
	// 			if (content.length % 5 === 0) {
	// 				handler.update(content, false)
	// 			} else {
	// 				await handler.update(content, false)
	// 			}
	// 		}
	// 	} finally {
	// 		// Ensure we get to final update
	// 		await handler.update(lastContent, true)
	// 	}

	// 	const { finalContent } = await handler.saveChanges()

	// 	assert.strictEqual(
	// 		preprocessContent(finalContent),
	// 		preprocessContent(file1After),
	// 		"Content should match despite random chunk streaming"
	// 	)
	// })

	it("should handle progressively growing content without line reference errors", async () => {
		await handler.open(file1Path)

		let accumulatedContent = ""
		const fullContent = file1After // Our target complete content

		// Simulate gradual content accumulation like real LLM generation
		for (let i = 1; i <= fullContent.length; i += 10) {
			// Take 10 chars at a time
			accumulatedContent = fullContent.slice(0, i)

			// Each update gets the full accumulated content so far
			await handler.update(accumulatedContent, false)

			// Add minimal delay to simulate LLM generation time
			await delay(1)

			// Every now and then, quickly send same content again
			// to create potential race conditions with line handling
			if (i % 30 === 0) {
				handler.update(accumulatedContent, false)
				handler.update(accumulatedContent, false)
			}
		}

		await handler.update(fullContent, true)

		const { finalContent } = await handler.saveChanges()

		assert.strictEqual(
			preprocessContent(finalContent),
			preprocessContent(fullContent),
			"Content should match despite incremental updates"
		)
	})
})

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}
