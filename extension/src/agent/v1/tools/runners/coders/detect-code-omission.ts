/**
 * Detects potential AI-generated code omissions in the given file content.
 * Triggers if:
 *   - We find specific keywords/phrases indicating omitted code, OR
 *   - More than X% of the content is missing (by line count).
 *
 * NOTE: Omission cannot happen if the original file is empty at the start.
 *
 * @param originalFileContent The original content of the file.
 * @param newFileContent The new content of the file to check.
 * @returns An object containing whether an omission was detected and details about the detection.
 */
export function detectCodeOmission(
	originalFileContent: string,
	newFileContent: string
): {
	hasOmission: boolean
	details: {
		line?: string
		keyword?: string
		lineNumber?: number
	}[]
} {
	// Early exit if original is empty => cannot flag omission
	if (!originalFileContent.trim() || originalFileContent.length < 10) {
		return { hasOmission: false, details: [] }
	}

	// Split into lines
	const originalLines = originalFileContent.split("\n")
	const newLines = newFileContent.split("\n")

	// Prepare array for storing details about any flagged lines
	const details: { line?: string; keyword?: string; lineNumber?: number }[] = []

	// Threshold: if more than 30% of content is missing, flag as omission
	const MISSING_THRESHOLD = 0.3 // 30%
	const originalLineCount = originalLines.length
	const newLineCount = newLines.length

	// Check if enough content is missing to count as an omission
	// (e.g., if missingRatio > 0.3, we consider it "omitted")
	if (originalLineCount > 0) {
		const missingCount = originalLineCount - newLineCount
		const missingRatio = missingCount / originalLineCount

		if (missingRatio > MISSING_THRESHOLD) {
			details.push({
				line: "",
				keyword: `More than ${MISSING_THRESHOLD * 100}% of content missing`,
				lineNumber: 0,
			})
		}
	}

	// Define omission-indicating phrases (case-insensitive)
	const strongOmissionPhrases = [
		"rest of (the )?code remains( the same)?",
		"previous implementation",
		"same as before",
		"rest of file unchanged",
		"remaining code unchanged",
		"existing implementation",
		"implementation remains",
		"\\.\\.\\. rest of",
		"rest of \\w+",
		"remaining logic",
		"previous initialization",
		"rest of calculation",
		"rest of processing logic",
		"submission logic",
		"initialization code",
	].map((p) => new RegExp(p, "i"))

	// Scan each line in the new content for omission-indicating phrases
	for (let i = 0; i < newLines.length; i++) {
		const line = newLines[i]

		// Check each pattern
		for (const pattern of strongOmissionPhrases) {
			const match = line.match(pattern)
			if (match) {
				details.push({
					line,
					keyword: match[0],
					lineNumber: i + 1,
				})
				// We can break once we find a phrase, to avoid duplicating
				break
			}
		}
	}

	return {
		hasOmission: details.length > 0,
		details,
	}
}
