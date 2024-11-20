// import { getCwd } from "@/agent/v1/utils"
// import { fileExistsAtPath } from "@/utils/path-helpers"
import { getCwd } from "../../../utils"
import { fileExistsAtPath } from "../../../../../utils/path-helpers"
import { compareTwoStrings } from "string-similarity"
import path from "path"
// @ts-expect-error - not typed
import { SequenceMatcher } from "@ewoudenberg/difflib"

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

export async function findSimilarLines(
	searchContent: string,
	content: string,
	threshold: number = 0.6
): Promise<string> {
	const searchLines = searchContent.split("\n")
	const contentLines = content.split("\n")

	let bestRatio = 0
	let bestMatch: string[] = []

	for (let i = 0; i <= contentLines.length - searchLines.length; i++) {
		const chunk = contentLines.slice(i, i + searchLines.length)
		const matcher = new SequenceMatcher(null, searchLines.join("\n"), chunk.join("\n"))
		const similarity = matcher.ratio()
		if (similarity > bestRatio) {
			bestRatio = similarity
			bestMatch = chunk
		}
	}

	return bestRatio >= threshold ? bestMatch.join("\n") : ""
}

export async function applyEditBlocksToFile(content: string, editBlocks: EditBlock[]): Promise<string> {
	let newContent = content
	for (const block of editBlocks) {
		const searchContent = block.searchContent
		const replaceContent = block.replaceContent

		const result = replaceIgnoringIndentation(newContent, searchContent, replaceContent)
		if (result !== null) {
			newContent = result
		} else {
			// Try to find similar lines (optional)
			const similarLines = await findSimilarLines(searchContent, newContent)
			if (similarLines) {
				const similarIndex = newContent.indexOf(similarLines)
				newContent =
					newContent.substring(0, similarIndex) +
					replaceContent +
					newContent.substring(similarIndex + similarLines.length)
			} else {
				console.log(`Failed to find match for block: ${block.searchContent.slice(0, 100)}...`, "warn")
				throw new Error(`Failed to find matching block in file`)
			}
		}
	}
	return newContent
}

// Add the new replaceIgnoringIndentation method
export function replaceIgnoringIndentation(
	content: string,
	searchContent: string,
	replaceContent: string
): string | null {
	const contentLines = content.split(/\r?\n/)
	const searchLines = searchContent.split(/\r?\n/)
	const replaceLines = replaceContent.split(/\r?\n/)

	// Strip leading whitespace from searchLines for matching
	const strippedSearchLines = searchLines.map((line) => line.trimStart())

	// Try to find a match in contentLines
	for (let i = 0; i <= contentLines.length - searchLines.length; i++) {
		const contentSlice = contentLines.slice(i, i + searchLines.length)
		// Strip leading whitespace from contentSlice
		const strippedContentSlice = contentSlice.map((line) => line.trimStart())

		// Compare the stripped lines
		if (strippedContentSlice.join("\n") === strippedSearchLines.join("\n")) {
			// Match found, calculate indentation difference for each line
			const indentedReplaceLines = adjustIndentationPerLine(contentSlice, searchLines, replaceLines)

			// Replace the original lines with the indented replacement lines
			const newContentLines = [
				...contentLines.slice(0, i),
				...indentedReplaceLines,
				...contentLines.slice(i + searchLines.length),
			]

			return newContentLines.join("\n")
		}
	}

	// No match found
	return null
}

// Helper method to adjust indentation per line
export function adjustIndentationPerLine(
	contentSlice: string[],
	searchLines: string[],
	replaceLines: string[]
): string[] {
	const adjustedLines: string[] = []

	for (let idx = 0; idx < replaceLines.length; idx++) {
		const replaceLine = replaceLines[idx]
		const searchLine = searchLines[idx] || ""
		const contentLine = contentSlice[idx] || ""

		// Get indentation levels
		const searchIndentation = searchLine.match(/^\s*/)?.[0] || ""
		const contentIndentation = contentLine.match(/^\s*/)?.[0] || ""
		const replaceIndentation = replaceLine.match(/^\s*/)?.[0] || ""

		// Calculate indentation difference
		const indentationDifference = contentIndentation.length - searchIndentation.length

		// Adjust replace line indentation
		let newIndentationLength = replaceIndentation.length + indentationDifference
		if (newIndentationLength < 0) {
			newIndentationLength = 0
		}
		const newIndentation = " ".repeat(newIndentationLength)
		const lineContent = replaceLine.trimStart()
		adjustedLines.push(newIndentation + lineContent)
	}

	return adjustedLines
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
