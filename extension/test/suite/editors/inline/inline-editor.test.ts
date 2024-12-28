import * as vscode from "vscode"
import * as assert from "assert"
import { InlineEditHandler } from "../../../../src/integrations/editor/inline-editor"
import * as fs from "fs"
import * as path from "path"
import {
	DiffBlockManager,
	EditBlock,
	normalize,
	REPLACE_HEAD,
	SEARCH_HEAD,
	SEPARATOR,
} from "../../../../src/agent/v1/tools/runners/coders/utils"

const readBlock = (filePath: string, extension = "ts") => {
	const block6FilePath = path.join(__dirname, `${filePath}File.${extension}`)
	const block6FileContentPath = path.join(__dirname, `${filePath}-pre-content.txt`)
	const block6FileContent = fs.readFileSync(block6FileContentPath, "utf8")
	const block6BlockContentPath = path.join(__dirname, `${filePath}.txt`)
	const block6BlockContent = fs.readFileSync(block6BlockContentPath, "utf8")
	return [block6FilePath, block6FileContentPath, block6FileContent, block6BlockContentPath, block6BlockContent]
}

const writeBlock = async (testFilePath: string, toEditFilePath: string, toEditFileContent: string) => {
	await vscode.workspace.fs.writeFile(vscode.Uri.file(testFilePath), Buffer.from(toEditFileContent, "utf-8"))
}

const removeBlock = async (blockFilePath: string) => {
	vscode.workspace.fs.delete(vscode.Uri.file(blockFilePath))
}

async function simulateStreaming(diff: string, delayMs: number): Promise<AsyncGenerator<string, void, unknown>> {
	// Get random chunk size between 6-24 chars
	function getRandomChunkSize() {
		return Math.floor(Math.random() * (25 - 6 + 1)) + 24
	}

	// Accumulate the string as we stream
	let streamedContent = ""

	async function* generator() {
		while (streamedContent.length < diff.length) {
			const chunkSize = getRandomChunkSize()
			const nextChunk = diff.slice(streamedContent.length, streamedContent.length + chunkSize)
			streamedContent += nextChunk
			yield streamedContent
			await delay(50)
		}
	}

	return generator()
}

async function handleStreaming(
	generator: AsyncGenerator<string, void, unknown>,
	blockFilePath: string,
	inlineEditHandler: InlineEditHandler
) {
	let editBlocks: EditBlock[] = []
	let lastAppliedBlockId: string | undefined
	const diffBlockManager = new DiffBlockManager()
	for await (const diff of generator) {
		try {
			editBlocks = diffBlockManager.parseAndMergeDiff(diff, blockFilePath)
		} catch (err) {
			console.log(`Error parsing diff blocks: ${err}`, "error")
			continue
		}
		const lastBlock = editBlocks.at(-1)
		// now we are going to start applying the diff blocks
		if (editBlocks.length > 0) {
			if (!inlineEditHandler.isOpen()) {
				try {
					await inlineEditHandler.open(editBlocks[0].id, blockFilePath, editBlocks[0].searchContent)
				} catch (e) {
					console.log("Error opening diff view: " + e, "error")
					continue
				}
			}
			if (lastBlock?.id) {
				// Now we can see if the last block is finalized
				if (lastBlock?.isFinalized) {
					// If that block is now fully finalized, we can apply final content, e.g.:

					lastAppliedBlockId = lastBlock.id
					await inlineEditHandler.applyFinalContent(
						lastBlock.id,
						lastBlock.searchContent,
						lastBlock.replaceContent
					)
				} else {
					// Otherwise we do partial streaming
					await inlineEditHandler.applyStreamContent(
						lastBlock.id,
						lastBlock.searchContent,
						lastBlock.replaceContent
					)
				}
			}
		}
	}
	// now we force the final content to be applied

	diffBlockManager.finalizeAllBlocks()

	// 4) Then apply them in the inline editor
	if (!inlineEditHandler.isOpen() && editBlocks.length > 0) {
		await inlineEditHandler.open(editBlocks[0]?.id, blockFilePath, editBlocks[0].searchContent)
	}

	const {
		failedCount,
		results: allResults,
		isAnyFailed,
		isAllFailed,
		failedBlocks,
	} = await inlineEditHandler.forceFinalize(editBlocks)
}

async function testBlock(
	blockFilePath: string,
	blockFileContentPath: string,
	blockBlockContent: string,
	timeout?: number
) {
	const inlineEditHandler = new InlineEditHandler()
	const generator = await simulateStreaming(blockBlockContent, 50)
	let editBlocks: EditBlock[] = []
	let lastAppliedBlockId: string | undefined
	// Verify content
	const originalText = await vscode.workspace.fs.readFile(vscode.Uri.file(blockFileContentPath))

	await handleStreaming(generator, blockFilePath, inlineEditHandler)

	// await delay(10_000)
	// Save with no tabs open
	const { finalContentRaw: finalDocument, results } = await inlineEditHandler.saveChanges()

	// await delay(10_000)

	let expectedContent = Buffer.from(originalText).toString("utf-8")
	for (const block of editBlocks) {
		expectedContent = expectedContent.replace(block.searchContent, block.replaceContent)
	}

	assert.strictEqual(normalize(finalDocument), normalize(expectedContent))
}
const testFilePath = path.join(__dirname, "testFile.ts")
const toEditFilePath = path.join(__dirname, "toEditFile.txt")
const [block3FilePath, block3FileContentPath, block3FileContent, block3BlockContentPath, block3BlockContent] =
	readBlock("block3")
const [block4FilePath, block4FileContentPath, block4FileContent, block4BlockContentPath, block4BlockContent] =
	readBlock("block4")
const [block5FilePath, block5FileContentPath, block5FileContent, block5BlockContentPath, block5BlockContent] =
	readBlock("block5")
const [block6FilePath, block6FileContentPath, block6FileContent, block6BlockContentPath, block6BlockContent] =
	readBlock("block6", "py")

describe("InlineEditHandler End-to-End Test", () => {
	let inlineEditHandler: InlineEditHandler
	let activated = false

	beforeEach(async () => {
		// activate the extension

		if (!activated) {
			const extension = vscode.extensions.getExtension("kodu-ai.claude-dev-experimental")!
			await extension.activate()
			activated = true
		}
		const toEditFileContent = fs.readFileSync(toEditFilePath, "utf8")
		// Create a dummy file for testing
		fs.writeFileSync(testFilePath, toEditFileContent, "utf8")
		const workspaceEdit = new vscode.WorkspaceEdit()
		workspaceEdit.createFile(vscode.Uri.file(testFilePath), { overwrite: true })
		workspaceEdit.replace(vscode.Uri.file(testFilePath), new vscode.Range(0, 0, 0, 0), toEditFileContent)
		await vscode.workspace.applyEdit(workspaceEdit)
		// Open the file in VSCode
		const document = await vscode.workspace.openTextDocument(testFilePath)
		await vscode.window.showTextDocument(document)
		await document.save()

		// create blocks
		await writeBlock(block3FilePath, block3FileContentPath, block3FileContent)
		await writeBlock(block4FilePath, block4FileContentPath, block4FileContent)
		await writeBlock(block5FilePath, block5FileContentPath, block5FileContent)
		await writeBlock(block6FilePath, block6FileContentPath, block6FileContent)

		if (inlineEditHandler) {
			inlineEditHandler.dispose()
		}
		// Initialize InlineEditHandler
		inlineEditHandler = new InlineEditHandler()
	})

	afterEach(async () => {
		// Close all editors and delete the test file
		await vscode.commands.executeCommand("workbench.action.closeAllEditors")
		// remove the test file
		const workspaceEdit = new vscode.WorkspaceEdit()
		workspaceEdit.deleteFile(vscode.Uri.file(testFilePath))
		await vscode.workspace.applyEdit(workspaceEdit)
		await vscode.workspace.saveAll()

		// delete blocks
		await Promise.all([
			removeBlock(block3FilePath),
			removeBlock(block4FilePath),
			removeBlock(block5FilePath),
			removeBlock(block6FilePath),
		])
	})

	// it("should handle long stream with tabs switches correctly", async () => {
	// 	// Create a second file to switch between

	// 	const generator = await simulateStreaming(, 30)

	// 	try {
	// 		// Open both files
	// 		const secondDoc = await vscode.workspace.openTextDocument(secondFilePath)
	// 		const interval = setInterval(() => {
	// 			vscode.window.showTextDocument(secondDoc)
	// 		}, 50)
	// 		await vscode.window.showTextDocument(secondDoc)

	// 		await handleStreaming(generator, secondFilePath, inlineEditHandler)

	// 		// Save changes
	// 		const { finalContent: finalDocument } = await inlineEditHandler.saveChanges()
	// 		clearInterval(interval)
	// 		// Verify both changes were applied correctly
	// 		const originalText = await vscode.workspace.fs.readFile(vscode.Uri.file(toEditFilePath))
	// 		let expectedContent = Buffer.from(originalText).toString("utf-8")
	// 		expectedContent = expectedContent.replace(search, replace)
	// 		expectedContent = expectedContent.replace(search2, replace2)

	// 		assert.strictEqual(finalDocument, expectedContent)
	// 	} finally {
	// 		// Cleanup second file
	// 		if (fs.existsSync(secondFilePath)) {
	// 			fs.unlinkSync(secondFilePath)
	// 		}
	// 	}
	// })

	// it("should handle saves while different tab is active", async () => {
	// 	// Create a second file
	// 	const secondFilePath = path.join(__dirname, "secondFile.ts")
	// 	fs.writeFileSync(secondFilePath, "// Second file content", "utf8")

	// 	const generator = await simulateStreaming(streamedContent, 10)
	// 	const editBlocks: Array<{
	// 		id: string
	// 		replaceContent: string
	// 		searchContent: string
	// 		finalContent?: string
	// 	}> = []
	// 	let lastAppliedBlockId: string | undefined

	// 	try {
	// 		// Start with the main file
	// 		const mainDoc = await vscode.workspace.openTextDocument(testFilePath)
	// 		await vscode.window.showTextDocument(mainDoc)

	// 		await handleStreaming(generator, secondFilePath, inlineEditHandler)
	// 		await vscode.window.showTextDocument(mainDoc)

	// 		// Save while different tab is active
	// 		const { finalContent: finalDocument } = await inlineEditHandler.saveChanges()
	// 		await vscode.window.showTextDocument(mainDoc)

	// 		// Verify content
	// 		const originalText = await vscode.workspace.fs.readFile(vscode.Uri.file(toEditFilePath))
	// 		let expectedContent = Buffer.from(originalText).toString("utf-8")
	// 		expectedContent = expectedContent.replace(search, replace)
	// 		expectedContent = expectedContent.replace(search2, replace2)

	// 		assert.strictEqual(finalDocument, expectedContent)
	// 	} finally {
	// 		if (fs.existsSync(secondFilePath)) {
	// 			fs.unlinkSync(secondFilePath)
	// 		}
	// 	}
	// })

	// it("should handle saves with no tabs open", async () => {
	// 	const generator = await simulateStreaming(streamedContent, 25)
	// 	let editBlocks: EditBlock[] = []
	// 	// Verify content
	// 	const originalText = await vscode.workspace.fs.readFile(vscode.Uri.file(toEditFilePath))

	// 	const interval = setInterval(() => {
	// 		// Close all editors after first block is initialized
	// 		vscode.commands.executeCommand("workbench.action.closeAllEditors")
	// 	}, 500)

	// 	await handleStreaming(generator, toEditFilePath, inlineEditHandler)

	// 	clearInterval(interval)
	//
	// 	// Save with no tabs open
	// 	const { finalContent: finalDocument } = await inlineEditHandler.saveChanges()

	// 	let expectedContent = Buffer.from(originalText).toString("utf-8")
	// 	expectedContent = expectedContent.replace(search, replace)
	// 	expectedContent = expectedContent.replace(search2, replace2)

	// 	assert.strictEqual(finalDocument, expectedContent)
	// })

	it("should test that block 3 is parsed and apllied correctly", async () => {
		await testBlock(block3FilePath, block3FileContentPath, block3BlockContent)
	})

	it("should test that block 4 is parsed and apllied correctly", async () => {
		await testBlock(block4FilePath, block4FileContentPath, block4BlockContent)
	})

	it("should test that block 5 is parsed and apllied correctly", async () => {
		await testBlock(block5FilePath, block5FileContentPath, block5BlockContent)
	})

	it("make sure that incorrect LLM spacing / tabs is auto fixed (python", async () => {
		// blockFilePath: string, blockFileContentPath: string, blockBlockContent: string
		await testBlock(block6FilePath, block6FileContentPath, block6BlockContent)
	})

	// Helper function to simulate rapid streaming with potential race conditions
	async function simulateRaceConditionStreaming(diff: string): Promise<AsyncGenerator<string, void, unknown>> {
		const chunks: string[] = []
		let streamedContent = ""

		// Split content into very small chunks (3-10 chars)
		while (streamedContent.length < diff.length) {
			const chunkSize = Math.floor(Math.random() * 8) + 3
			const nextChunk = diff.slice(streamedContent.length, streamedContent.length + chunkSize)
			streamedContent += nextChunk
			chunks.push(streamedContent)
		}

		async function* generator() {
			// Introduce random delays and potentially out-of-order delivery
			const promises = chunks.map((chunk, index) => {
				return new Promise<{ content: string; index: number }>((resolve) => {
					const delay = Math.random() * 2 // 0-2ms delay
					setTimeout(() => resolve({ content: chunk, index }), delay)
				})
			})

			// Simulate out-of-order delivery
			const results = await Promise.all(promises)
			results.sort((a, b) => {
				// 20% chance to deliver out of order
				if (Math.random() < 0.2) {
					return Math.random() - 0.5
				}
				return a.index - b.index
			})

			for (const result of results) {
				yield result.content
			}
		}

		return generator()
	}

	it("should handle CRLF vs LF line endings correctly", async () => {
		const searchContent = "function test() {\n    console.log('test');\n}"
		const replaceContent = "function test() {\r\n    console.log('updated');\r\n}"

		// Create test file with CRLF endings
		const testContent = "// Some content\r\n" + searchContent.replace(/\n/g, "\r\n") + "\r\n// More content"
		fs.writeFileSync(testFilePath, testContent, "utf8")

		// const diff = `SEARCH\n${searchContent}\n\nREPLACE\n${replaceContent}`
		const diff = `${SEARCH_HEAD}\n${searchContent}\n${SEPARATOR}\n${replaceContent}\n${REPLACE_HEAD}`
		const generator = await simulateStreaming(diff, 25)

		await handleStreaming(generator, testFilePath, inlineEditHandler)

		const { finalContent: finalDocument } = await inlineEditHandler.saveChanges()
		const expectedContent = testContent.replace(searchContent.replace(/\n/g, "\r\n"), replaceContent)
		assert.strictEqual(finalDocument, expectedContent)
	})
})

/**
 * Utility function to simulate delays (for streaming updates).
 */
function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}
