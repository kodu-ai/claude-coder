import * as DMP from "diff-match-patch"

export function findAndReplace(
	content: string,
	searchContent: string,
	replaceContent: string,
	startLine: number = 0
): MatchResult {
	// Normalize line endings
	content = content.replace(/\r\n/g, "\n")
	searchContent = searchContent.replace(/\r\n/g, "\n")
	replaceContent = replaceContent.replace(/\r\n/g, "\n")

	// Pass startLine to each specialized match function
	const perfectMatch = findPerfectMatch(content, searchContent, startLine)
	if (perfectMatch.success) {
		return performReplace(content, perfectMatch.lineStart!, perfectMatch.lineEnd!, replaceContent)
	}

	const whitespaceMatch = findWhitespaceMatch(content, searchContent, startLine)
	if (whitespaceMatch.success) {
		return performReplace(content, whitespaceMatch.lineStart!, whitespaceMatch.lineEnd!, replaceContent)
	}

	const trailingMatch = findTrailingMatch(content, searchContent, startLine)
	if (trailingMatch.success) {
		return performReplace(content, trailingMatch.lineStart!, trailingMatch.lineEnd!, replaceContent)
	}

	const oneLinerMatch = findOneLinerMatch(content, searchContent, replaceContent, startLine)
	if (oneLinerMatch.success) {
		return oneLinerMatch
	}

	const dmpMatch = findDMPMatch(content, searchContent, startLine)
	if (dmpMatch.success) {
		return performReplace(content, dmpMatch.lineStart!, dmpMatch.lineEnd!, replaceContent)
	}

	return { success: false }
}

export function performReplace(
	content: string,
	startLine: number,
	endLine: number,
	replaceContent: string
): MatchResult {
	const contentLines = content.split("\n")
	let replaceLines = replaceContent.split("\n")

	// If we end up with a single blank line, treat that as "nothing"
	if (replaceLines.length === 1 && replaceLines[0] === "") {
		replaceLines = []
	}

	const newContentLines = [...contentLines.slice(0, startLine), ...replaceLines, ...contentLines.slice(endLine + 1)]

	return {
		success: true,
		newContent: newContentLines.join("\n"),
		lineStart: startLine,
		lineEnd: startLine + replaceLines.length - 1,
	}
}

export function findPerfectMatch(content: string, searchContent: string, startLine: number = 0): MatchResult {
	const contentLines = content.split("\n")
	const searchLines = searchContent.split("\n")

	for (let i = startLine; i <= contentLines.length - searchLines.length; i++) {
		if (contentLines.slice(i, i + searchLines.length).join("\n") === searchLines.join("\n")) {
			return {
				success: true,
				lineStart: i,
				lineEnd: i + searchLines.length - 1,
			}
		}
	}
	return { success: false }
}

export function findWhitespaceMatch(content: string, searchContent: string, startLine: number = 0): MatchResult {
	const contentLines = content.split("\n")
	const searchLines = searchContent.split("\n")

	for (let i = startLine; i <= contentLines.length - searchLines.length; i++) {
		const matches = searchLines.every((searchLine, j) => {
			const contentLine = contentLines[i + j]
			return contentLine.replace(/\s+/g, " ") === searchLine.replace(/\s+/g, " ")
		})
		if (matches) {
			return {
				success: true,
				lineStart: i,
				lineEnd: i + searchLines.length - 1,
			}
		}
	}
	return { success: false }
}

export function findOneLinerMatch(
	content: string,
	searchContent: string,
	replaceContent: string,
	startLine: number = 0
): MatchResult {
	const contentLines = content.split("\n")
	const searchLines = searchContent.split("\n")

	if (searchLines.length > 1) {
		return { success: false }
	}
	// Only search from startLine onward
	for (let i = startLine; i < contentLines.length; i++) {
		if (contentLines[i].includes(searchContent)) {
			const replacedLine = contentLines[i].replace(searchContent, replaceContent)
			let newContent = content
			if (replacedLine.length === 0) {
				// entire line was removed
				newContent = contentLines.filter((_, idx) => idx !== i).join("\n")
			} else {
				contentLines[i] = replacedLine
				newContent = contentLines.join("\n")
			}
			return {
				success: true,
				lineStart: i,
				lineEnd: i,
				newContent,
			}
		}
	}
	return { success: false }
}

export function findTrailingMatch(content: string, searchContent: string, startLine: number = 0): MatchResult {
	const contentLines = content.split("\n")
	const searchLines = searchContent.split("\n")

	for (let i = startLine; i <= contentLines.length - searchLines.length; i++) {
		const matches = searchLines.every((searchLine, j) => {
			return contentLines[i + j].trimEnd() === searchLine.trimEnd()
		})
		if (matches) {
			return {
				success: true,
				lineStart: i,
				lineEnd: i + searchLines.length - 1,
			}
		}
	}
	return { success: false }
}

export function findDMPMatch(content: string, searchContent: string, startLine: number = 0): MatchResult {
	const contentLines = content.split("\n")
	// Consider only the lines from startLine onward
	const subContent = contentLines.slice(startLine).join("\n")

	const dmp = new DMP.diff_match_patch()
	const diffs = dmp.diff_main(subContent, searchContent)
	dmp.diff_cleanupSemantic(diffs)

	let bestMatch = { start: -1, end: -1, length: 0 }
	let currentPos = 0

	for (const [type, text] of diffs) {
		if (type === 0 && text.length > bestMatch.length) {
			bestMatch = {
				start: currentPos,
				end: currentPos + text.length,
				length: text.length,
			}
		}
		currentPos += text.length
	}

	// If the best match covers at least ~70% of the search content
	if (bestMatch.length > searchContent.length * 0.7) {
		// Determine the line-based offset within subContent
		const linesBefore = subContent.substr(0, bestMatch.start).split("\n").length - 1
		const start = startLine + linesBefore
		const end = start + searchContent.split("\n").length - 1

		return {
			success: true,
			lineStart: start,
			lineEnd: end,
		}
	}

	return { success: false }
}

export interface MatchResult {
	success: boolean
	newContent?: string
	lineStart?: number
	lineEnd?: number
	failureReason?: string
}

export interface EditBlock {
	id: string
	searchContent: string
	currentContent: string
	finalContent?: string
	status: "pending" | "streaming" | "final"
	matchedLocation?: {
		lineStart: number
		lineEnd: number
	}
	dmpAttempted?: boolean
}

export interface BlockResult {
	id: string
	searchContent: string
	replaceContent: string
	wasApplied: boolean
	failureReason?: string
	lineStart?: number
	lineEnd?: number
	formattedSavedArea?: string
}
