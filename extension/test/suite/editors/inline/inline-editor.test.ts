import * as vscode from "vscode"
import * as assert from "assert"
import { InlineEditHandler } from "../../../../src/integrations/editor/inline-editor"
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
			await delay(5)
		}
	}

	return generator()
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

	await inlineEditHandler.forceFinalizeAll(editBlocks)

	// await delay(10_000)
	// Save with no tabs open
	const { finalContent: finalDocument, results } = await inlineEditHandler.saveChanges()

	await delay(10_000)

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
	const search = `/*
We can't implement a dynamically updating sliding window as it would break prompt cache
every time. To maintain the benefits of caching, we need to keep conversation history
static. This operation should be performed as infrequently as possible. If a user reaches
a 200k context, we can assume that the first half is likely irrelevant to their current task.
Therefore, this function should only be called when absolutely necessary to fit within
context limits, not as a continuous process.
*/
export function truncateHalfConversation(
	messages: Anthropic.Messages.MessageParam[]
): Anthropic.Messages.MessageParam[] {
	if (!Array.isArray(messages) || messages.length < MIN_MESSAGES_TO_KEEP) {
		return messages
	}

	// Always keep the first Task message (this includes the project's file structure in potentially_relevant_details)
	const firstMessage = messages[0]

	// Calculate how many message pairs to remove (must be even to maintain user-assistant order)
	const messagePairsToRemove = Math.max(1, Math.floor((messages.length - MIN_MESSAGES_TO_KEEP) / 4)) * 2

	// Keep the first message and the remaining messages after truncation
	const remainingMessages = messages.slice(messagePairsToRemove + 1)

	// check if the first message exists appx twice if so pop the last instance and insert the first message again as last
	// if it doesn't exist twice, insert the first message as the last message

	return [firstMessage, ...remainingMessages]
}`
	const replace = `/*
we made this short on purpose
*/
export function truncateHalfConversation(
	messages: Anthropic.Messages.MessageParam[]
): Anthropic.Messages.MessageParam[] {
	// we added comment here
	if (!Array.isArray(messages) || messages.length < MIN_MESSAGES_TO_KEEP) {
		return messages
	}

	// we added another line of comment
	// Always keep the first Task message (this includes the project's file structure in potentially_relevant_details)
	const firstMessage = messages[0]

	// Calculate how many message pairs to remove (must be even to maintain user-assistant order)
	const messagePairsToRemove = Math.max(1, Math.floor((messages.length - MIN_MESSAGES_TO_KEEP) / 4)) * 2

	// this is the best way to see if this is working or is it actually bullshiting me
	// some more comments because why not
	// Keep the first message and the remaining messages after truncation
	const renamedMsgs = messages.slice(messagePairsToRemove + 1)

	return [firstMessage, ...renamedMsgs]
}`
	const diff1 = `SEARCH\n${search}\n=======\nREPLACE\n${replace}`
	const search2 = `/**
 * Estimates total token count from an array of messages
 * @param messages Array of messages to estimate tokens for
 * @returns Total estimated token count
 */
export const estimateTokenCountFromMessages = (messages: Anthropic.Messages.MessageParam[]): number => {
	if (!Array.isArray(messages)) return 0

	return messages.reduce((acc, message) => acc + estimateTokenCount(message), 0)
}`
	const replace2 = `/**
 * Estimates total token count from an array of messages
 * @param messages Array of messages to estimate tokens for
 * @returns Total estimated token count
 */
export const estimateTokenCountFromMessages = (messages: Anthropic.Messages.MessageParam[]): number => {
	// check if messages is an array
	if (!Array.isArray(messages)) {
	return 0
	}

	// return the total token count
	return messages.reduce((acc, message) => acc + estimateTokenCount(message), 0)
}`
	const diff2 = `SEARCH\n${search2}\n=======\nREPLACE\n${replace2}`

	const streamedContent = `${diff1}\n=======\n${diff2}`
	let inlineEditHandler: InlineEditHandler

	beforeEach(async () => {
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

	it("should handle streaming updates for multiple blocks", async () => {
		const generator = await simulateStreaming(streamedContent, 25)
		const editBlocks: Array<{
			id: string
			replaceContent: string
			searchContent: string
			finalContent?: string
		}> = []
		let lastAppliedBlockId: string | undefined

		for await (const diff of generator) {
			try {
				const blocks = parseDiffBlocks(diff, testFilePath)
				if (blocks.length > 0) {
					const currentBlock = blocks.at(-1)
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

						await inlineEditHandler.open(currentBlock.id, testFilePath, currentBlock.searchContent)
						editBlocks.push({
							id: currentBlock.id,
							replaceContent: currentBlock.replaceContent,
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
			} catch (err) {
				console.warn(`Warning block not parsable yet`)
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

		// Save changes
		const { finalContent: finalDocument } = await inlineEditHandler.saveChanges()

		// Verify both changes were applied correctly
		const originalText = await vscode.workspace.fs.readFile(vscode.Uri.file(toEditFilePath))
		let expectedContent = Buffer.from(originalText).toString("utf-8")
		expectedContent = expectedContent.replace(search, replace)
		expectedContent = expectedContent.replace(search2, replace2)

		assert.strictEqual(finalDocument, expectedContent)
	})

	it("should handle long stream with tabs switches correctly", async () => {
		// Create a second file to switch between
		const secondFilePath = path.join(__dirname, "secondFile.ts")
		fs.writeFileSync(secondFilePath, "// Second file content", "utf8")

		const generator = await simulateStreaming(streamedContent, 30)
		const editBlocks: Array<{
			id: string
			replaceContent: string
			searchContent: string
			finalContent?: string
		}> = []
		let lastAppliedBlockId: string | undefined
		let finalEditBlocks: EditBlock[] = []

		try {
			// Open both files
			const secondDoc = await vscode.workspace.openTextDocument(secondFilePath)
			await vscode.window.showTextDocument(secondDoc)
			let lastSwitchTime = Date.now()
			let isFirstFile = true
			for await (const diff of generator) {
				try {
					const blocks = parseDiffBlocks(diff, testFilePath)
					finalEditBlocks = blocks
					if (blocks.length > 0) {
						const currentBlock = blocks.at(-1)
						if (!currentBlock?.replaceContent) {
							continue
						}

						// Switch between tabs every 1.5 seconds
						const currentTime = Date.now()
						if (currentTime - lastSwitchTime >= 1500) {
							if (isFirstFile) {
								const doc1 = await vscode.workspace.openTextDocument(testFilePath)
								await vscode.window.showTextDocument(doc1)
							} else {
								const doc2 = await vscode.workspace.openTextDocument(secondFilePath)
								await vscode.window.showTextDocument(doc2)
							}
							isFirstFile = !isFirstFile
							lastSwitchTime = currentTime
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

							await inlineEditHandler.open(currentBlock.id, testFilePath, currentBlock.searchContent)
							editBlocks.push({
								id: currentBlock.id,
								replaceContent: currentBlock.replaceContent,
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
				} catch (err) {
					console.warn(`Warning block not parsable yet`)
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

			// finalize all blocks
			await inlineEditHandler.forceFinalizeAll(editBlocks)

			// Save changes
			const { finalContent: finalDocument } = await inlineEditHandler.saveChanges()

			// Verify both changes were applied correctly
			const originalText = await vscode.workspace.fs.readFile(vscode.Uri.file(toEditFilePath))
			let expectedContent = Buffer.from(originalText).toString("utf-8")
			expectedContent = expectedContent.replace(search, replace)
			expectedContent = expectedContent.replace(search2, replace2)

			assert.strictEqual(finalDocument, expectedContent)
		} finally {
			// Cleanup second file
			if (fs.existsSync(secondFilePath)) {
				fs.unlinkSync(secondFilePath)
			}
		}
	})

	it("should handle saves while different tab is active", async () => {
		// Create a second file
		const secondFilePath = path.join(__dirname, "secondFile.ts")
		fs.writeFileSync(secondFilePath, "// Second file content", "utf8")

		const generator = await simulateStreaming(streamedContent, 10)
		const editBlocks: Array<{
			id: string
			replaceContent: string
			searchContent: string
			finalContent?: string
		}> = []
		let lastAppliedBlockId: string | undefined

		try {
			// Start with the main file
			const mainDoc = await vscode.workspace.openTextDocument(testFilePath)
			await vscode.window.showTextDocument(mainDoc)

			for await (const diff of generator) {
				try {
					const blocks = parseDiffBlocks(diff, testFilePath)
					if (blocks.length > 0) {
						const currentBlock = blocks.at(-1)
						if (!currentBlock?.replaceContent) {
							continue
						}

						if (!editBlocks.some((block) => block.id === currentBlock.id)) {
							if (lastAppliedBlockId) {
								const lastBlock = editBlocks.find((block) => block.id === lastAppliedBlockId)
								if (lastBlock) {
									const lines = lastBlock.replaceContent.split("\n")
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

							// Switch to second file after first block is initialized
							const secondDoc = await vscode.workspace.openTextDocument(secondFilePath)
							await vscode.window.showTextDocument(secondDoc)

							await inlineEditHandler.open(currentBlock.id, testFilePath, currentBlock.searchContent)
							editBlocks.push({
								id: currentBlock.id,
								replaceContent: currentBlock.replaceContent,
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
				} catch (err) {
					console.warn(`Warning block not parsable yet`)
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

			// Save while different tab is active
			const { finalContent: finalDocument } = await inlineEditHandler.saveChanges()

			// Verify content
			const originalText = await vscode.workspace.fs.readFile(vscode.Uri.file(toEditFilePath))
			let expectedContent = Buffer.from(originalText).toString("utf-8")
			expectedContent = expectedContent.replace(search, replace)
			expectedContent = expectedContent.replace(search2, replace2)

			assert.strictEqual(finalDocument, expectedContent)
		} finally {
			if (fs.existsSync(secondFilePath)) {
				fs.unlinkSync(secondFilePath)
			}
		}
	})

	it("should handle saves with no tabs open", async () => {
		const generator = await simulateStreaming(streamedContent, 25)
		let editBlocks: EditBlock[] = []
		let lastAppliedBlockId: string | undefined
		// Verify content
		const originalText = await vscode.workspace.fs.readFile(vscode.Uri.file(toEditFilePath))

		const interval = setInterval(() => {
			// Close all editors after first block is initialized
			vscode.commands.executeCommand("workbench.action.closeAllEditors")
		}, 500)

		for await (const diff of generator) {
			if (!(diff.includes("SEARCH") && diff.includes("REPLACE"))) {
				continue
			}
			try {
				editBlocks = parseDiffBlocks(diff, testFilePath)
			} catch (err) {
				console.log(`Error parsing diff blocks: ${err}`, "error")
				continue
			}
			if (!inlineEditHandler.isOpen()) {
				try {
					await inlineEditHandler.open(editBlocks[0].id, testFilePath, editBlocks[0].searchContent)
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

					await inlineEditHandler.open(currentBlock.id, testFilePath, currentBlock.searchContent)
					editBlocks.push({
						id: currentBlock.id,
						replaceContent: currentBlock.replaceContent,
						path: testFilePath,
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
		// clear the interval
		clearInterval(interval)
		await inlineEditHandler.forceFinalizeAll(editBlocks)

		// Save with no tabs open
		const { finalContent: finalDocument } = await inlineEditHandler.saveChanges()

		let expectedContent = Buffer.from(originalText).toString("utf-8")
		expectedContent = expectedContent.replace(search, replace)
		expectedContent = expectedContent.replace(search2, replace2)

		assert.strictEqual(finalDocument, expectedContent)
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

	it("should handle CRLF vs LF line endings correctly", async () => {
		const searchContent = "function test() {\n    console.log('test');\n}"
		const replaceContent = "function test() {\r\n    console.log('updated');\r\n}"

		// Create test file with CRLF endings
		const testContent = "// Some content\r\n" + searchContent.replace(/\n/g, "\r\n") + "\r\n// More content"
		fs.writeFileSync(testFilePath, testContent, "utf8")

		const diff = `SEARCH\n${searchContent}\n=======\nREPLACE\n${replaceContent}`
		const generator = await simulateStreaming(diff, 25)

		let editBlocks: EditBlock[] = []
		for await (const chunk of generator) {
			if (!chunk.includes("SEARCH") || !chunk.includes("REPLACE")) continue
			try {
				editBlocks = parseDiffBlocks(chunk, testFilePath)
				if (!inlineEditHandler.isOpen()) {
					await inlineEditHandler.open(editBlocks[0].id, testFilePath, editBlocks[0].searchContent)
				}
				const currentBlock = editBlocks[0]
				await inlineEditHandler.applyStreamContent(
					currentBlock.id,
					currentBlock.searchContent,
					currentBlock.replaceContent
				)
			} catch (err) {
				console.warn("Warning: Block not parsable yet")
			}
		}

		await inlineEditHandler.forceFinalizeAll(editBlocks)
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
