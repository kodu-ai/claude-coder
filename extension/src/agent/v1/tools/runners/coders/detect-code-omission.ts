/**
 * Detects potential AI-generated code omissions in the given file content.
 * @param originalFileContent The original content of the file
 * @param newFileContent The new content of the file to check
 * @returns An object containing whether an omission was detected and details about the detection
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
		context?: string
	}[]
} {
	const originalLines = originalFileContent.split("\n")
	const newLines = newFileContent.split("\n")
	const details: { line?: string; keyword?: string; lineNumber?: number; context?: string }[] = []

	// Skip detection if original content is empty
	if (originalFileContent.trim().length === 0) {
		return { hasOmission: false, details: [] }
	}

	// Phrases that strongly indicate intentional code omission
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
	].map((phrase) => new RegExp(phrase, "i"))

	// Comment patterns with capturing groups for content
	const commentPatterns = [
		/^\s*\/\/\s*(.+)$/, // Single-line comment
		/^\s*#\s*(.+)$/, // Python/Ruby comment
		/^\s*\/\*\s*(.+?)\s*\*\/$/, // Single-line multi-line comment
		/^\s*\*\s*(.+)$/, // Multi-line comment continuation
		/^\s*<!--\s*(.+?)\s*-->$/, // HTML comment
	]

	// Patterns that indicate code block starts
	const codeBlockStarts = [
		{
			pattern: /^\s*(function|class|interface|module|def)\s+(\w+)/,
			extract: (match: RegExpMatchArray) => `${match[1]} ${match[2]}()`,
		},
		{
			pattern: /^\s*(const|let|var)\s+(\w+)\s*=\s*(function|\(.*\)\s*=>|\{)/,
			extract: (match: RegExpMatchArray) => `${match[1]} ${match[2]}`,
		},
		{ pattern: /^\s*(public|private|protected)\s+(\w+)/, extract: (match: RegExpMatchArray) => match[0].trim() },
		{ pattern: /^\s*class\s+(\w+)/, extract: (match: RegExpMatchArray) => `class ${match[1]}` },
	]

	// Ellipsis patterns that indicate omission (only in comments or specific patterns)
	const ellipsisPatterns = [
		/^\/\*\s*\.\.\.\s*\*\/$/, // /* ... */
		/^\/\/\s*\.\.\.\s*$/, // // ...
		/^\s*\.\.\.\s*$/, // ... (on its own line)
		/^\{\s*\.\.\.\s*\}$/, // { ... }
		/^\(\s*\.\.\.\s*\)$/, // ( ... )
		/^\[\s*\.\.\.\s*\]$/, // [ ... ]
		/^\/\*\s*\.\.\.\s*\w+\s*\*\/$/, // /* ... something */
	]

	// Ellipsis with context (must be in comments)
	const ellipsisWithContextPatterns = [
		/\/\/\s*\.\.\.\s*(rest|remaining|code|implementation|logic)/i, // // ... rest/remaining/code/implementation/logic
		/\/\*\s*\.\.\.\s*(rest|remaining|code|implementation|logic)\s*\*\//i, // /* ... rest/remaining/code/implementation/logic */
		/#\s*\.\.\.\s*(rest|remaining|code|implementation|logic)/i, // # ... rest/remaining/code/implementation/logic
	]

	let currentContext: string[] = []
	let bracketStack = 0

	// Process each line
	newLines.forEach((line, lineNumber) => {
		const trimmedLine = line.trim()
		const indentation = line.search(/\S|$/)

		// Update code block context
		for (const { pattern, extract } of codeBlockStarts) {
			const match = line.match(pattern)
			if (match) {
				const context = extract(match)
				currentContext.push(context)
				bracketStack = 0
				break
			}
		}

		// Track brackets for context
		const openBrackets = (line.match(/\{/g) || []).length
		const closeBrackets = (line.match(/\}/g) || []).length
		bracketStack += openBrackets - closeBrackets

		// Exit context when brackets close
		if (bracketStack <= 0 && currentContext.length > 0) {
			currentContext.pop()
			bracketStack = 0
		}

		// Function to add detail with current context
		const addDetail = (keyword: string) => {
			details.push({
				line: line,
				keyword: keyword,
				lineNumber: lineNumber + 1,
				context: currentContext[currentContext.length - 1] || "",
			})
		}

		// Check for strong omission phrases in comments
		for (const commentPattern of commentPatterns) {
			const commentMatch = line.match(commentPattern)
			if (commentMatch) {
				const commentContent = commentMatch[1]
				for (const pattern of strongOmissionPhrases) {
					if (pattern.test(commentContent)) {
						addDetail(commentContent.match(pattern)![0])
						return // Exit after finding a match to avoid duplicates
					}
				}
			}
		}

		// Check if the line is a comment
		const isComment = commentPatterns.some((pattern) => pattern.test(line))

		// Check for ellipsis patterns when in a comment or specific structural pattern
		for (const pattern of ellipsisPatterns) {
			if (pattern.test(trimmedLine)) {
				// Ignore if it's in a string literal
				if (!/["'`].*\.\.\..*["'`]/.test(line)) {
					addDetail("...")
					return // Exit after finding a match
				}
			}
		}

		// Check for ellipsis with context only in comments
		if (isComment) {
			for (const pattern of ellipsisWithContextPatterns) {
				if (pattern.test(line)) {
					addDetail("...")
					return // Exit after finding a match
				}
			}
		}
	})

	return {
		hasOmission: details.length > 0,
		details: details,
	}
}
