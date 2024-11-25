import * as vscode from "vscode"
import * as assert from "assert"
import { InlineEditHandler } from "../../src/integrations/editor/inline-editor"
import * as fs from "fs"
import * as path from "path"
import { EditBlock, parseDiffBlocks } from "../../src/agent/v1/tools/runners/coders/utils"

describe("InlineEditHandler End-to-End Test", () => {
	const testFilePath = path.join(__dirname, "testFile.ts")
	const toEditFilePath = path.join(__dirname, "toEditFile.txt")
	const block3FilePath = path.join(__dirname, "block3File.ts")
	const block3FileContentPath = path.join(__dirname, "block3-pre-content.txt")
	const block3FileContent = fs.readFileSync(block3FileContentPath, "utf8")
	const block3BlockContentPath = path.join(__dirname, "block3.txt")
	const block3BlockContent = fs.readFileSync(block3BlockContentPath, "utf8")
	const block4FilePath = path.join(__dirname, "block4File.ts")
	const block4FileContentPath = path.join(__dirname, "block4-pre-content.txt")
	const block4FileContent = fs.readFileSync(block4FileContentPath, "utf8")
	const block4BlockContentPath = path.join(__dirname, "block4.txt")
	const block4BlockContent = fs.readFileSync(block4BlockContentPath, "utf8")
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

	async function simulateStreaming(diff: string, delayMs: number): Promise<AsyncGenerator<string, void, unknown>> {
		// Get random chunk size between 6-24 chars
		function getRandomChunkSize() {
			return Math.floor(Math.random() * (64 - 6 + 1)) + 6
		}

		// Accumulate the string as we stream
		let streamedContent = ""

		async function* generator() {
			while (streamedContent.length < diff.length) {
				const chunkSize = getRandomChunkSize()
				const nextChunk = diff.slice(streamedContent.length, streamedContent.length + chunkSize)
				streamedContent += nextChunk
				yield streamedContent
				await delay(delayMs)
			}
		}

		return generator()
	}

	beforeEach(async () => {
		const toEditFileContent = fs.readFileSync(toEditFilePath, "utf8")
		// Create a dummy file for testing
		fs.writeFileSync(testFilePath, toEditFileContent, "utf8")
		const workspaceEdit = new vscode.WorkspaceEdit()
		workspaceEdit.createFile(vscode.Uri.file(testFilePath), { overwrite: true })
		workspaceEdit.replace(vscode.Uri.file(testFilePath), new vscode.Range(0, 0, 0, 0), toEditFileContent)
		await vscode.workspace.applyEdit(workspaceEdit)

		// create block3 file
		fs.writeFileSync(block3FilePath, block3FileContent, "utf8")
		const block3WorkspaceEdit = new vscode.WorkspaceEdit()
		block3WorkspaceEdit.createFile(vscode.Uri.file(block3FilePath), { overwrite: true })
		block3WorkspaceEdit.replace(vscode.Uri.file(block3FilePath), new vscode.Range(0, 0, 0, 0), block3FileContent)
		await vscode.workspace.applyEdit(block3WorkspaceEdit)
		// create block4 file
		fs.writeFileSync(block3FilePath, block4FileContent, "utf8")
		const block4WorkspaceEdit = new vscode.WorkspaceEdit()
		block4WorkspaceEdit.createFile(vscode.Uri.file(block4FilePath), { overwrite: true })
		block4WorkspaceEdit.replace(vscode.Uri.file(block4FilePath), new vscode.Range(0, 0, 0, 0), block4FileContent)
		await vscode.workspace.applyEdit(block4WorkspaceEdit)

		// Open the file in VSCode
		const document = await vscode.workspace.openTextDocument(testFilePath)
		await vscode.window.showTextDocument(document)
		await document.save()

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

		// delete block3 file
		const block3WorkspaceEdit = new vscode.WorkspaceEdit()
		block3WorkspaceEdit.deleteFile(vscode.Uri.file(block3FilePath))
		await vscode.workspace.applyEdit(block3WorkspaceEdit)
		// delete block4 file
		const block4WorkspaceEdit = new vscode.WorkspaceEdit()
		block4WorkspaceEdit.deleteFile(vscode.Uri.file(block4FilePath))
		await vscode.workspace.applyEdit(block4WorkspaceEdit)

		if (fs.existsSync(testFilePath)) {
			fs.unlinkSync(testFilePath)
		}
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
		const finalDocument = await inlineEditHandler.saveChanges()

		// Verify both changes were applied correctly
		const originalText = await vscode.workspace.fs.readFile(vscode.Uri.file(toEditFilePath))
		let expectedContent = Buffer.from(originalText).toString("utf-8")
		expectedContent = expectedContent.replace(search, replace)
		expectedContent = expectedContent.replace(search2, replace2)

		assert.strictEqual(finalDocument.finalContent, expectedContent)
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
			const finalDocument = await inlineEditHandler.saveChanges()

			// Verify both changes were applied correctly
			const originalText = await vscode.workspace.fs.readFile(vscode.Uri.file(toEditFilePath))
			let expectedContent = Buffer.from(originalText).toString("utf-8")
			expectedContent = expectedContent.replace(search, replace)
			expectedContent = expectedContent.replace(search2, replace2)

			assert.strictEqual(finalDocument.finalContent, expectedContent)
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
			const finalDocument = await inlineEditHandler.saveChanges()

			// Verify content
			const originalText = await vscode.workspace.fs.readFile(vscode.Uri.file(toEditFilePath))
			let expectedContent = Buffer.from(originalText).toString("utf-8")
			expectedContent = expectedContent.replace(search, replace)
			expectedContent = expectedContent.replace(search2, replace2)

			assert.strictEqual(finalDocument.finalContent, expectedContent)
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
		const finalDocument = await inlineEditHandler.saveChanges()

		let expectedContent = Buffer.from(originalText).toString("utf-8")
		expectedContent = expectedContent.replace(search, replace)
		expectedContent = expectedContent.replace(search2, replace2)

		assert.strictEqual(finalDocument.finalContent, expectedContent)
	})

	it("should test that block 3 is parsed and apllied correctly", async () => {
		const generator = await simulateStreaming(block3BlockContent, 25)
		let editBlocks: EditBlock[] = []
		let lastAppliedBlockId: string | undefined
		// Verify content
		const originalText = await vscode.workspace.fs.readFile(vscode.Uri.file(block3FileContentPath))

		for await (const diff of generator) {
			if (!(diff.includes("SEARCH") && diff.includes("REPLACE"))) {
				continue
			}
			try {
				editBlocks = parseDiffBlocks(diff, block3FilePath)
			} catch (err) {
				console.log(`Error parsing diff blocks: ${err}`, "error")
				continue
			}
			if (!inlineEditHandler.isOpen()) {
				try {
					await inlineEditHandler.open(editBlocks[0].id, block3FilePath, editBlocks[0].searchContent)
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

					await inlineEditHandler.open(currentBlock.id, block3FilePath, currentBlock.searchContent)
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

		// Save with no tabs open
		const finalDocument = await inlineEditHandler.saveChanges()

		let expectedContent = Buffer.from(originalText).toString("utf-8")
		for (const block of editBlocks) {
			expectedContent = expectedContent.replace(block.searchContent, block.replaceContent)
		}

		assert.strictEqual(finalDocument.finalContent, expectedContent)
	})

	it("should test that block 4 is parsed and apllied correctly", async () => {
		const generator = await simulateStreaming(block4BlockContent, 25)
		let editBlocks: EditBlock[] = []
		let lastAppliedBlockId: string | undefined
		// Verify content
		const originalText = await vscode.workspace.fs.readFile(vscode.Uri.file(block4FileContentPath))

		for await (const diff of generator) {
			if (!(diff.includes("SEARCH") && diff.includes("REPLACE"))) {
				continue
			}
			try {
				editBlocks = parseDiffBlocks(diff, block4FilePath)
			} catch (err) {
				console.log(`Error parsing diff blocks: ${err}`, "error")
				continue
			}
			if (!inlineEditHandler.isOpen()) {
				try {
					await inlineEditHandler.open(editBlocks[0].id, block4FilePath, editBlocks[0].searchContent)
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

					await inlineEditHandler.open(currentBlock.id, block4FilePath, currentBlock.searchContent)
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

		// Save with no tabs open
		const finalDocument = await inlineEditHandler.saveChanges()

		let expectedContent = Buffer.from(originalText).toString("utf-8")
		for (const block of editBlocks) {
			expectedContent = expectedContent.replace(block.searchContent, block.replaceContent)
		}

		assert.strictEqual(finalDocument.finalContent, expectedContent)
	})
})

/**
 * Utility function to simulate delays (for streaming updates).
 */
function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}
