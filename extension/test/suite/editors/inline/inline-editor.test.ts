import * as vscode from "vscode"
import * as assert from "assert"
import { InlineEditHandler } from "../../../../src/integrations/editor/inline-editor-v3"
import * as fs from "fs"
import * as path from "path"
import { EditBlock, normalize, parseDiffBlocks } from "../../../../src/agent/v1/tools/runners/coders/utils"

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
			await delay(25)
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
	for await (const diff of generator) {
		if (!(diff.includes("SEARCH") && diff.includes("REPLACE"))) {
			continue
		}
		try {
			editBlocks = parseDiffBlocks(diff, blockFilePath)
		} catch (err) {
			console.log(`Error parsing diff blocks: ${err}`, "error")
			continue
		}
		if (!inlineEditHandler.isOpen()) {
			try {
				await inlineEditHandler.open(editBlocks[0].id, blockFilePath, editBlocks[0].searchContent)
			} catch (e) {
				console.log("Error opening diff view: " + e, "error")
				continue
			}
		}
		// now we are going to start applying the diff blocks
		if (editBlocks.length > 0) {
			const currentBlock = editBlocks.at(-1)
			if (!currentBlock?.replaceContent) {
				continue
			}

			// If this block hasn't been tracked yet, initialize it
			if (!editBlocks.some((block) => block.id === currentBlock.id)) {
				// Clean up any SEARCH text from the last block before starting new one
				if (lastAppliedBlockId) {
					const lastBlock = editBlocks.find((block) => block.id === lastAppliedBlockId)
					if (lastBlock) {
						const lines = lastBlock.replaceContent.split("\n")
						// Only remove the last line if it ONLY contains a partial SEARCH
						if (lines.length > 0 && /^=?=?=?=?=?=?=?$/.test(lines[lines.length - 1].trim())) {
							lines.pop()
							await inlineEditHandler.applyFinalContent(
								lastBlock.id,
								lastBlock.searchContent,
								lines.join("\n")
							)
						} else {
							await inlineEditHandler.applyFinalContent(
								lastBlock.id,
								lastBlock.searchContent,
								lastBlock.replaceContent
							)
						}
					}
				}

				editBlocks.push({
					id: currentBlock.id,
					replaceContent: currentBlock.replaceContent,
					path: block3FilePath,
					searchContent: currentBlock.searchContent,
				})
				lastAppliedBlockId = currentBlock.id
			}

			const blockData = editBlocks.find((block) => block.id === currentBlock.id)
			if (blockData) {
				blockData.replaceContent = currentBlock.replaceContent
				await inlineEditHandler.applyStreamContent(
					currentBlock.id,
					currentBlock.searchContent,
					currentBlock.replaceContent
				)
			}
		}

		// Finalize the last block
		if (lastAppliedBlockId) {
			const lastBlock = editBlocks.find((block) => block.id === lastAppliedBlockId)
			if (lastBlock) {
				const lines = lastBlock.replaceContent.split("\n")
				await inlineEditHandler.applyFinalContent(lastBlock.id, lastBlock.searchContent, lines.join("\n"))
			}
		}
	}
}

async function testBlock(
	blockFilePath: string,
	blockFileContentPath: string,
	blockBlockContent: string,
	timeout?: number
) {
	const inlineEditHandler = new InlineEditHandler()
	const generator = await simulateStreaming(blockBlockContent, 20)
	let editBlocks: EditBlock[] = []
	let lastAppliedBlockId: string | undefined
	// Verify content
	const originalText = await vscode.workspace.fs.readFile(vscode.Uri.file(blockFileContentPath))

	await handleStreaming(generator, blockFilePath, inlineEditHandler)

	// await inlineEditHandler.forceFinalizeAll(editBlocks)

	// await delay(10_000)
	// Save with no tabs open
	const { finalContent: finalDocument, results } = await inlineEditHandler.saveChanges()

	// await delay(10_000)

	let expectedContent = Buffer.from(originalText).toString("utf-8")
	for (const block of editBlocks) {
		expectedContent = expectedContent.replace(block.searchContent, block.replaceContent)
	}

	assert.strictEqual(finalDocument, expectedContent)
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

		const diff = `SEARCH\n${searchContent}\n\nREPLACE\n${replaceContent}`
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
