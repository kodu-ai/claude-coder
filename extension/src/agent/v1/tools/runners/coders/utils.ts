// import { getCwd } from "@/agent/v1/utils"
// import { fileExistsAtPath } from "@/utils/path-helpers"
import { getCwd } from "../../../utils"
import { fileExistsAtPath } from "../../../../../utils/path-helpers"
import { compareTwoStrings } from "string-similarity"
import path from "path"

interface EditBlock {
	path: string
	searchContent: string
	replaceContent: string
	isDelete?: boolean
}

interface BlockMatch {
	start: number
	end: number
	score: number
}

export function findCodeBlock(content: string, startIndex: number): { start: number; end: number } | null {
	const lines = content.split("\n")
	let openBraces = 0
	let blockStart = -1

	for (let i = startIndex; i < lines.length; i++) {
		const line = lines[i]

		// Check for block start indicators
		if (line.includes("{")) {
			if (openBraces === 0) {
				blockStart = i
			}
			openBraces += (line.match(/{/g) || []).length
		}

		// Check for block end
		if (line.includes("}")) {
			openBraces -= (line.match(/}/g) || []).length
			if (openBraces === 0 && blockStart !== -1) {
				return {
					start: blockStart,
					end: i,
				}
			}
		}
	}

	return null
}

export function findBestBlockMatch(
	searchContent: string,
	fileContent: string,
	threshold: number = 0.6
): BlockMatch | null {
	const lines = fileContent.split("\n")
	const searchLines = searchContent.split("\n")
	let bestMatch: BlockMatch | null = null

	// Try exact match first
	const exactIndex = fileContent.indexOf(searchContent)
	if (exactIndex !== -1) {
		const startLine = fileContent.substring(0, exactIndex).split("\n").length - 1
		return {
			start: startLine,
			end: startLine + searchLines.length - 1,
			score: 1.0,
		}
	}

	// Look for potential block boundaries
	for (let i = 0; i < lines.length; i++) {
		// Check if this could be the start of a matching block
		if (lines[i].includes("class") || lines[i].includes("function") || lines[i].includes("export")) {
			// Try to find block boundaries
			const block = findCodeBlock(lines.slice(i).join("\n"), 0)
			if (block) {
				const blockContent = lines.slice(i, i + block.end + 1).join("\n")
				const similarity = compareTwoStrings(searchContent, blockContent)

				if (similarity > threshold && (!bestMatch || similarity > bestMatch.score)) {
					bestMatch = {
						start: i,
						end: i + block.end,
						score: similarity,
					}
				}
			}
		}
	}

	// If no block match found, try sliding window approach
	if (!bestMatch) {
		for (let i = 0; i <= lines.length - searchLines.length; i++) {
			const chunk = lines.slice(i, i + searchLines.length).join("\n")
			const similarity = compareTwoStrings(searchContent, chunk)

			if (similarity > threshold && (!bestMatch || similarity > bestMatch.score)) {
				bestMatch = {
					start: i,
					end: i + searchLines.length - 1,
					score: similarity,
				}
			}
		}
	}

	return bestMatch
}

export async function applyEditBlocksToFile(content: string, editBlocks: EditBlock[]): Promise<string> {
	let lines = content.split("\n")

	// Process blocks from bottom to top to maintain line numbers
	editBlocks.sort((a, b) => {
		const matchA = findBestBlockMatch(a.searchContent, content)
		const matchB = findBestBlockMatch(b.searchContent, content)
		return (matchB?.start || 0) - (matchA?.start || 0)
	})

	for (const block of editBlocks) {
		const match = findBestBlockMatch(block.searchContent, lines.join("\n"))

		if (match) {
			const beforeLines = lines.slice(0, match.start)
			const afterLines = lines.slice(match.end + 1)
			const replaceLines = block.replaceContent.trim().split("\n")

			// Handle complete deletions
			if (block.replaceContent.trim() === "") {
				lines = [...beforeLines, ...afterLines]
			} else {
				// Maintain indentation of the first line
				const originalIndent = lines[match.start].match(/^\s*/)?.[0] || ""
				const indentedReplace = replaceLines.map((line, i) => (i === 0 ? line : originalIndent + line))
				lines = [...beforeLines, ...indentedReplace, ...afterLines]
			}
		} else {
			// logger(`Failed to find match for block: ${block.searchContent.slice(0, 100)}...`, "warn")
			throw new Error(`Failed to find matching block in file`)
		}
	}

	return lines.join("\n")
}

export function parseDiffBlocks(diffContent: string, path: string): EditBlock[] {
	const editBlocks: EditBlock[] = []
	const lines = diffContent.split("\n")
	let i = 0

	while (i < lines.length) {
		if (lines[i].startsWith("SEARCH")) {
			const searchLines: string[] = []
			i++
			while (i < lines.length && lines[i] !== "=======") {
				searchLines.push(lines[i])
				i++
			}

			if (i < lines.length && lines[i] === "=======") {
				i++
			}

			const replaceLines: string[] = []
			if (i < lines.length && lines[i] === "REPLACE") {
				i++
			}
			while (i < lines.length && lines[i] !== "SEARCH") {
				replaceLines.push(lines[i])
				i++
			}

			const searchContent = searchLines.join("\n").trimEnd()
			const replaceContent = replaceLines.join("\n").trimEnd()

			editBlocks.push({
				path: path,
				searchContent,
				replaceContent,
				isDelete: replaceContent.trim() === "",
			})
		} else {
			i++
		}
	}
	return editBlocks
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
