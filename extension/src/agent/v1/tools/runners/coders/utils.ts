// file-editor.tool.ts

import path from "path"
import { getCwd } from "../../../utils"
import { fileExistsAtPath } from "../../../../../utils/path-helpers"

/**
 * Data structure for each diff block (HEAD vs updated).
 */
export interface EditBlock {
	id: string
	path: string
	searchContent: string
	replaceContent: string
	isDelete?: boolean
	isFinalized?: boolean
}
export const SEARCH_HEAD = "<<<<<<< HEAD" as const
export const SEPARATOR = "=======" as const
export const REPLACE_HEAD = ">>>>>>> updated" as const

/**
 * Manage partial diff blocks, parse them, merge them, and generate stable IDs.
 */
export class DiffBlockManager {
	private _blocks: EditBlock[] = []

	get blocks(): EditBlock[] {
		return this._blocks
	}

	/**
	 * Return the "last" block we appended or updated, if any.
	 * (You may or may not need this, depending on how you track partial streaming.)
	 */
	public getLastBlock(): EditBlock | undefined {
		return this._blocks.at(-1)
	}

	/**
	 * Parse new diff content, create or update blocks,
	 * and return the blocks that were newly discovered from this parse operation.
	 */
	public parseAndMergeDiff(diffContent: string, filePath: string): EditBlock[] {
		// 1. Parse the newly-provided diff into temp blocks
		const newBlocks = this.parseDiffBlocks(diffContent, filePath)

		// 2. Merge with this.blocks
		//    - If a block ID doesn’t exist in this.blocks, push it
		//    - If it does exist and is not finalized, update or re-append any new lines
		for (const newBlock of newBlocks) {
			const existingIdx = this._blocks.findIndex((b) => b.id === newBlock.id)
			if (existingIdx === -1) {
				// It's brand new
				this._blocks.push(newBlock)
			} else {
				const existing = this._blocks[existingIdx]
				// If the block isn't finalized yet, merge search/replace content
				if (!existing.isFinalized) {
					Object.assign(existing, newBlock)
				}
			}
		}
		return newBlocks
	}

	/**
	 * If you need to do a final pass over all blocks once the streaming is complete.
	 */
	public finalizeAllBlocks() {
		for (const block of this._blocks) {
			block.isFinalized = true
		}
	}

	/**
	 * Actually parse the raw diff content and produce EditBlock objects.
	 */
	public parseDiffBlocks(diffContent: string, filePath: string): EditBlock[] {
		const lines = diffContent.split("\n")
		const blocks: EditBlock[] = []

		let blockId = 0

		// Temporary buffers and state for the conflict block we’re building
		let searchContent = ""
		let replaceContent = ""
		let isCollectingSearch = false
		let isCollectingReplace = false
		let didSeeSeparator = false // used to confirm we actually have a complete "searchContent"

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i]
			const trimmed = line.trim()

			// 1) Detect start of a new conflict block: <<<<<<< HEAD
			if (trimmed === SEARCH_HEAD) {
				// If we were in the middle of a block that never saw '=======',
				// we discard it because we only append a block if entire search content arrived.
				if (isCollectingSearch || isCollectingReplace) {
					// We never got to finalize, so discard it (no push).
					// Reset everything:
					searchContent = ""
					replaceContent = ""
					isCollectingSearch = false
					isCollectingReplace = false
					didSeeSeparator = false
				}

				// Now start a new block: collect HEAD content
				isCollectingSearch = true
				isCollectingReplace = false
				didSeeSeparator = false
				continue
			}

			// 2) Detect the separator: =======
			if (trimmed === SEPARATOR && isCollectingSearch) {
				// We have a valid search section only if we were collecting search
				// and now we see the separator
				didSeeSeparator = true
				isCollectingSearch = false
				isCollectingReplace = true
				continue
			}

			// 3) Detect the end of a block: >>>>>>> updated
			if (trimmed === REPLACE_HEAD && isCollectingReplace) {
				// We only append a block if we had a valid search section
				// (meaning we saw the separator)
				if (didSeeSeparator) {
					// Build a new block
					const block: EditBlock = {
						id: blockId.toString(),
						path: filePath,
						searchContent: searchContent.trimEnd(),
						replaceContent: replaceContent.trimEnd(),
						isDelete: replaceContent.trim().length === 0,
						isFinalized: true, // we encountered >>>>>>> updated
					}
					blocks.push(block)
					blockId++
				}
				// else, if we never saw '=======', we skip adding it

				// Reset for next potential block
				searchContent = ""
				replaceContent = ""
				isCollectingSearch = false
				isCollectingReplace = false
				didSeeSeparator = false
				continue
			}

			// -----------------------------
			// If none of the markers matched, handle normal lines:
			// -----------------------------

			// If currently collecting search lines, add them
			if (isCollectingSearch) {
				// Skip the marker line itself
				if (trimmed !== SEARCH_HEAD && trimmed !== SEPARATOR && trimmed !== REPLACE_HEAD) {
					searchContent += line + "\n"
				}
			}
			// If currently collecting replace lines, add them
			else if (isCollectingReplace) {
				if (trimmed !== SEARCH_HEAD && trimmed !== SEPARATOR && trimmed !== REPLACE_HEAD) {
					replaceContent += line + "\n"
				}
			}
		}

		// If the diff ended while collecting search/replace but never saw >>>>>>> updated:
		// - we only append a "partial" block if we had a valid search section
		//   (meaning we did see '=======')
		// - if didSeeSeparator is false, that means we never had a complete search section -> discard
		if (isCollectingReplace && didSeeSeparator) {
			// It's an incomplete block (no >>>>>>> updated)
			const block: EditBlock = {
				id: blockId.toString(),
				path: filePath,
				searchContent: searchContent.trimEnd(),
				replaceContent: replaceContent.trimEnd(),
				isDelete: replaceContent.trim().length === 0,
				isFinalized: false, // never saw the >>>>>>> updated
			}
			blocks.push(block)
			blockId++
		}
		return blocks
	}
}

/*
 * Normalizes text content for cross-platform comparison
 * Handles different line endings (CRLF vs LF) and path separators
 *
 * @param text - The text content to normalize
 * @returns Normalized text suitable for cross-platform comparison
 */
export function normalize(text: string): string {
	if (!text) {
		return text
	}

	return (
		text
			// First normalize all line endings to LF
			.replace(/\r\n/g, "\n")
			// Normalize all backslashes in path-like strings
			.replace(/\\+/g, "/")
			// Collapse multiple forward slashes to single
			.replace(/\/+/g, "/")
			// Trim any trailing/leading whitespace
			.trim()
	)
}

export async function checkFileExists(relPath: string): Promise<boolean> {
	const absolutePath = path.resolve(getCwd(), relPath)
	return await fileExistsAtPath(absolutePath)
}

export function preprocessContent(content: string): string {
	content = content.trim()
	if (content.startsWith("```")) {
		content = content.split("\n").slice(1).join("\n").trim()
	}
	if (content.endsWith("```")) {
		content = content.split("\n").slice(0, -1).join("\n").trim()
	}
	return content.replace(/>/g, ">").replace(/</g, "<").replace(/"/g, '"')
}
